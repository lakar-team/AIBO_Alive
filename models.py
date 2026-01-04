from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

# Initialize the Database Manager
db = SQLAlchemy()

# --- MODEL 1: USER (Authentication) ---
class User(UserMixin, db.Model):
    __tablename__ = 'user' 
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(200), nullable=False)

# --- MODEL 2: PERSONA (AI Identity) ---
class Persona(db.Model):
    __bind_key__ = 'aibo' 
    __tablename__ = 'persona'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    
    # Identity
    bot_name = db.Column(db.String(50), default="AIBO")
    user_nickname = db.Column(db.String(50), default="Director")
    system_prompt = db.Column(db.Text, default="You are a helpful AI assistant.")
    
    # NEW: Cognitive Bridge (Stores the Ngrok URL)
    api_endpoint = db.Column(db.String(200), default="http://localhost:11434")

    # Voice Settings
    voice_id = db.Column(db.String(50), default="en-US-AriaNeural")
    voice_pitch = db.Column(db.Integer, default=0)
    voice_rate = db.Column(db.Integer, default=0)
    voice_volume = db.Column(db.Integer, default=0)

    # Memory Systems
    core_biography = db.Column(db.Text, default="No long-term memories formed yet.")
    short_term_buffer = db.Column(db.Text, default="")