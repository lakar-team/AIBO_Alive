from flask import Flask, render_template, request, jsonify, url_for, session, redirect
from flask_login import LoginManager, login_required, login_user, current_user, logout_user
import os
import time
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import edge_tts
import asyncio
import hashlib # For Smart Caching

# --- MODULES ---
from models import db, User, Persona
import brain

# ========================================================
# 1. WINDOWS PATH CONFIGURATION
# ========================================================
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_FILE = os.path.join(BASE_DIR, 'instance', 'aibo_core.db')

# Ensure instance folder exists
if not os.path.exists(os.path.join(BASE_DIR, 'instance')):
    os.makedirs(os.path.join(BASE_DIR, 'instance'))

app = Flask(__name__)
app.secret_key = "local_super_secret_key" 

# --- 2. CONFIGURE DATABASE ---
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_FILE}'
app.config['SQLALCHEMY_BINDS'] = { 'aibo': f'sqlite:///{DB_FILE}' }
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# --- 3. LOGIN MANAGER ---
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- 4. STARTUP: AUTO-CREATE USER ---
with app.app_context():
    db.create_all() 
    if not User.query.filter_by(name="Adam").first():
        print("--- SYSTEM: Creating Default User 'Adam' ---")
        admin = User(
            email="adam@local.host", 
            name="Adam", 
            password=generate_password_hash("password")
        )
        db.session.add(admin)
        db.session.commit()

# --- 5. ROUTES ---

@app.route('/login')
def login():
    user = User.query.filter_by(name="Adam").first()
    if user:
        login_user(user)
        return redirect(url_for('index'))
    return "Error: No user found."

@app.route('/')
@login_required
def index():
    persona = Persona.query.filter_by(user_id=current_user.id).first()
    if not persona:
        persona = Persona(
            user_id=current_user.id, 
            user_nickname="Director",
            bot_name="AIBO",
            api_endpoint="http://localhost:11434" 
        )
        db.session.add(persona)
        db.session.commit()
    return render_template('index.html', persona=persona)

@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    data = request.json
    user_text = data.get('text', '')
    image_data = data.get('image', None)

    if not user_text and not image_data:
        return jsonify({"error": "Empty thought."}), 400

    try:
        persona = Persona.query.filter_by(user_id=current_user.id).first()
        
        # Memory Management
        if persona.short_term_buffer and len(persona.short_term_buffer) > 2000:
            success, new_mem = brain.consolidate_memory(persona)
            if success:
                persona.core_biography = new_mem
                persona.short_term_buffer = ""
                db.session.commit()

        reply_text, status = brain.get_chat_response(persona, user_text, image_data)
        
        if status == "success":
            entry = f"User: {user_text}\n{persona.bot_name}: {reply_text}\n---\n"
            if not persona.short_term_buffer: persona.short_term_buffer = ""
            persona.short_term_buffer += entry
            db.session.commit()

        session['last_active'] = time.time()
        return jsonify({"reply": reply_text, "status": status})

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/pulse', methods=['GET'])
@login_required
def pulse():
    now = time.time()
    last_active = session.get('last_active', now)
    
    if now - last_active > 30.0: 
        if not session.get('thinking_spontaneously'):
            session['thinking_spontaneously'] = True
            try:
                persona = Persona.query.filter_by(user_id=current_user.id).first()
                spontaneous_thought = brain.free_will(persona)
                session['last_active'] = time.time() 
                session['thinking_spontaneously'] = False
                if spontaneous_thought:
                    return jsonify({"pulse": spontaneous_thought})
            except:
                session['thinking_spontaneously'] = False
    return jsonify({"pulse": None})

@app.route('/api/dream', methods=['POST'])
@login_required
def dream_cycle():
    persona = Persona.query.filter_by(user_id=current_user.id).first()
    success, new_mem = brain.consolidate_memory(persona)
    if success:
        persona.core_biography = new_mem
        persona.short_term_buffer = ""
        db.session.commit()
        return jsonify({"status": "success", "new_memory": new_mem})
    return jsonify({"error": new_mem}), 500

@app.route('/api/persona', methods=['POST'])
@login_required
def update_persona():
    try:
        data = request.json
        p = Persona.query.filter_by(user_id=current_user.id).first()
        
        p.bot_name = data.get('bot_name', p.bot_name)
        p.user_nickname = data.get('user_nickname', p.user_nickname)
        p.system_prompt = data.get('system_prompt', p.system_prompt)
        if 'api_endpoint' in data: p.api_endpoint = data['api_endpoint']
        p.voice_id = data.get('voice_id', p.voice_id)
        p.voice_pitch = int(data.get('voice_pitch', p.voice_pitch))
        p.voice_rate = int(data.get('voice_rate', p.voice_rate))
        p.voice_volume = int(data.get('voice_volume', p.voice_volume))
        if 'core_biography' in data: p.core_biography = data.get('core_biography')

        db.session.commit()
        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- SMART CACHING VOICE GENERATOR ---
@app.route('/api/speak', methods=['POST'])
@login_required
def speak():
    data = request.json
    text = data.get('text', '')
    voice = data.get('voice', 'en-US-AriaNeural')
    
    # Sanitize Inputs for Edge-TTS
    raw_pitch = data.get('pitch', '0Hz').replace('+', '')
    raw_rate = data.get('rate', '0%').replace('+', '')
    pitch = raw_pitch if raw_pitch.startswith('-') else f"+{raw_pitch}"
    rate = raw_rate if raw_rate.startswith('-') else f"+{raw_rate}"

    if not text:
        return jsonify({"error": "No text"}), 400

    # 1. CREATE UNIQUE ID (HASH)
    # This creates a unique filename for this exact phrase+voice combination
    combo_string = f"{text}_{voice}_{pitch}_{rate}"
    file_hash = hashlib.md5(combo_string.encode('utf-8')).hexdigest()
    
    filename = f"{file_hash}.mp3"
    cache_dir = os.path.join(BASE_DIR, 'static', 'audio_cache')
    filepath = os.path.join(cache_dir, filename)
    
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)

    # 2. CHECK CACHE (INSTANT PLAYBACK)
    if os.path.exists(filepath):
        print(f"--- CACHE HIT: '{text[:15]}...' (Instant) ---")
        return jsonify({"url": url_for('static', filename=f'audio_cache/{filename}')})

    # 3. DOWNLOAD NEW (If not in cache)
    print(f"--- CACHE MISS: Downloading '{text[:15]}...' ---")
    
    async def generate_audio():
        communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate)
        await communicate.save(filepath)

    try:
        asyncio.run(generate_audio())
        return jsonify({"url": url_for('static', filename=f'audio_cache/{filename}')})
    except Exception as e:
        print(f"TTS Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)