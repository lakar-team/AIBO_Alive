# AIBO Alive 🤖✨

Welcome to **AIBO Alive**, the full realization of the AIBO project. Unlike the watered-down versions, this repository contains the complete "Brain" and cognitive architecture of AIBO.

## 🧠 The Triple-Core Architecture

AIBO_Alive operates on a unique triple-core architecture that bridges the gap between digital intelligence and physical presence.

### 1. The Cognitive Brain (`brain.py`)
The "Brain" is powered by local LLMs via Ollama. It doesn't just process text; it generates **active intent**. Every response from AIBO is parsed for "Intent Tags" that drive her physical body.
- **Short-Term Memory**: A rolling buffer of recent interactions that prevents "AI amnesia."
- **Long-Term Consolidation**: A "Dream Cycle" that summarizes conversations into a permanent core biography.
- **Spontaneous Thought**: A "Pulse" system that allows AIBO to think and act even when the user is silent.

### 2. The Mood & Emotion System
AIBO isn't static; she has internal states.
- **Dynamic Energy**: Her `MotionEngine` tracks an `energy` multiplier. If she is **HAPPY**, her movements are snappy and expansive (1.2x speed). If she is **SAD**, her posture drops, and her movements become sluggish (0.5x speed).
- **Vocal Affect**: Mood tags influence the TTS pitch and rate, ensuring her voice matches her emotional state.

### 3. Procedural Body Movements (`motion_core.js`)
Unlike traditional avatars with baked animations, AIBO uses **Procedural Bone Manipulation**.
- **The Rigging Lab**: Every joint from the `head` to the `knees` is controllable in real-time.
- **Intent Parsing**: When the Brain says `[ARMS: WAVE]`, the Motion Engine procedurally calculates the bone rotations to execute that wave dynamically.
- **Learned Poses**: Through the `/api/poses` endpoint, AIBO can "learn" new physical gestures that are saved permanently to her memory.

## 🛠️ Tech Stack

- **Backend**: Flask (Python)
- **Database**: SQLite (SQLAlchemy)
- **Brain**: Ollama (Qwen2.5-3B for text, Llava-Phi3 for vision)
- **Frontend**: HTML5/JS with 3D Canvas integration (managed via `templates/` and `Static/`)

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com/) installed and running locally.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/lakar-team/AIBO_Alive.git
   cd AIBO_Alive
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Brain**:
   Ensure Ollama is running and pull the required models:
   ```bash
   ollama pull qwen2.5:3b
   ollama pull llava-phi3
   ```

4. **Launch AIBO**:
   ```bash
   python flask_app.py
   ```
   AIBO will be available at `http://localhost:5000`.

## 🧬 Project Structure

- `flask_app.py`: The heart of the application, handling routing and APIs.
- `brain.py`: The cognitive engine interface for Ollama.
- `models.py`: Database schema for Users and Personas.
- `Static/`: Assets, audio cache, and frontend logic.
- `templates/`: HTML templates.
- `instance/`: Local database and configuration files.

---
*Created with ❤️ by Lakar Lab.*
