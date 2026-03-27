import os
import time
import json
import hashlib
import asyncio
import sqlite3
from flask import Flask, render_template, request, jsonify, url_for, session, redirect
from flask_login import LoginManager, login_required, login_user, current_user, logout_user
from werkzeug.security import generate_password_hash, check_password_hash
import edge_tts

# --- MODULES ---
from models import db, User, Persona
import brain

# ========================================================
# CONFIGURATION
# ========================================================
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_FILE = os.path.join(BASE_DIR, 'instance', 'aibo_core.db')
POSE_FILE = os.path.join(BASE_DIR, 'instance', 'custom_poses.json')

if not os.path.exists(os.path.join(BASE_DIR, 'instance')):
    os.makedirs(os.path.join(BASE_DIR, 'instance'))

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "fallback_secret_key_change_me_in_production")

# --- DATABASE CONFIG ---
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_FILE}'
# FIX: This line was missing! It tells SQLAlchemy what 'aibo' means.
app.config['SQLALCHEMY_BINDS'] = { 'aibo': f'sqlite:///{DB_FILE}' }
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# --- POSE MANAGEMENT UTILS ---
def load_custom_poses():
    if not os.path.exists(POSE_FILE): return {}
    try:
        with open(POSE_FILE, 'r') as f: return json.load(f)
    except: return {}

def save_custom_poses(poses):
    with open(POSE_FILE, 'w') as f: json.dump(poses, f, indent=4)

def get_known_moves_list():
    # Returns a list of strings like "ARMS: WAVE", "LEGS: KICK"
    # We combine Hardcoded defaults (we know them) + Learned ones
    base_moves = ["HEAD: NOD", "HEAD: SHAKE", "ARMS: WAVE", "ARMS: CLAP", "ARMS: CROSS", "LEGS: MARCH", "BODY: DANCE"]
    custom = load_custom_poses()
    for key in custom:
        # Assuming keys are saved like "ARMS_HERO"
        parts = key.split('_')
        if len(parts) > 1:
            category = parts[0] # ARMS
            action = "_".join(parts[1:]) # HERO
            base_moves.append(f"{category}: {action}")
    return ", ".join(base_moves)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- ROUTES ---

@app.route('/login')
def login():
    with app.app_context():
        # Auto-create user if missing
        if not User.query.first():
            db.create_all()
            admin_email = os.environ.get("AIBO_ADMIN_EMAIL", "admin@aibo.local")
            admin_password = os.environ.get("AIBO_ADMIN_PASSWORD", "A1B0_S3cur3_P@ssw0rd")
            admin = User(email=admin_email, name="Adam", password=generate_password_hash(admin_password))
            db.session.add(admin)
            db.session.commit()
            
    user = User.query.filter_by(name="Adam").first()
    if user:
        login_user(user)
        return redirect(url_for('index'))
    return "Error: User system failed."

@app.route('/')
@login_required
def index():
    persona = Persona.query.filter_by(user_id=current_user.id).first()
    if not persona:
        persona = Persona(user_id=current_user.id, user_nickname="Director", bot_name="AIBO")
        db.session.add(persona)
        db.session.commit()
    return render_template('index.html', persona=persona)

# --- THE TEACHING API ---
@app.route('/api/poses', methods=['GET', 'POST'])
@login_required
def handle_poses():
    if request.method == 'GET':
        return jsonify(load_custom_poses())
    
    if request.method == 'POST':
        data = request.json
        name = data.get('name').upper().replace(" ", "_") # Normalize "Arms Wave" -> "ARMS_WAVE"
        pose_data = data.get('pose')
        
        current = load_custom_poses()
        current[name] = pose_data
        save_custom_poses(current)
        return jsonify({"status": "learned", "name": name})

@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    data = request.json
    user_text = data.get('text', '')
    image_data = data.get('image', None)

    try:
        persona = Persona.query.filter_by(user_id=current_user.id).first()
        
        # MEMORY MANAGEMENT
        if persona.short_term_buffer and len(persona.short_term_buffer) > 2500:
            success, new_mem = brain.consolidate_memory(persona)
            if success:
                persona.core_biography = new_mem
                persona.short_term_buffer = ""
                db.session.commit()

        # PASS KNOWN MOVES TO BRAIN
        known_moves = get_known_moves_list()
        
        reply_text, status = brain.get_chat_response(persona, user_text, image_data, known_moves)
        
        if status == "success":
            entry = f"User: {user_text}\n{persona.bot_name}: {reply_text}\n"
            if not persona.short_term_buffer: persona.short_term_buffer = ""
            persona.short_term_buffer += entry
            db.session.commit()

        session['last_active'] = time.time()
        return jsonify({"reply": reply_text, "status": status})

    except Exception as e:
        print(f"Chat Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/speak', methods=['POST'])
@login_required
def speak():
    data = request.json
    text = data.get('text', '')
    voice = data.get('voice', 'en-US-AriaNeural')
    raw_pitch = data.get('pitch', '0Hz').replace('+', '')
    raw_rate = data.get('rate', '0%').replace('+', '')
    pitch = raw_pitch if raw_pitch.startswith('-') else f"+{raw_pitch}"
    rate = raw_rate if raw_rate.startswith('-') else f"+{raw_rate}"

    if not text: return jsonify({"error": "No text"}), 400

    combo_string = f"{text}_{voice}_{pitch}_{rate}"
    file_hash = hashlib.md5(combo_string.encode('utf-8')).hexdigest()
    filename = f"{file_hash}.mp3"
    cache_dir = os.path.join(BASE_DIR, 'static', 'audio_cache')
    filepath = os.path.join(cache_dir, filename)
    
    if not os.path.exists(cache_dir): os.makedirs(cache_dir)

    if os.path.exists(filepath):
        return jsonify({"url": url_for('static', filename=f'audio_cache/{filename}')})
    
    async def generate_audio():
        communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate)
        await communicate.save(filepath)

    try:
        asyncio.run(generate_audio())
        return jsonify({"url": url_for('static', filename=f'audio_cache/{filename}')})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/pulse', methods=['GET'])
@login_required
def pulse():
    now = time.time()
    last_active = session.get('last_active', now)
    if now - last_active > 45.0: 
        if not session.get('thinking_spontaneously'):
            session['thinking_spontaneously'] = True
            try:
                persona = Persona.query.filter_by(user_id=current_user.id).first()
                spontaneous_thought = brain.free_will(persona)
                session['last_active'] = time.time()
                session['thinking_spontaneously'] = False
                if spontaneous_thought: return jsonify({"pulse": spontaneous_thought})
            except: session['thinking_spontaneously'] = False
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
    except Exception as e: return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)