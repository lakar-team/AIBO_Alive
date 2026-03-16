# AIBO Alive 🤖✨

Welcome to **AIBO Alive**, the full realization of the AIBO project. Unlike the watered-down versions, this repository contains the complete "Brain" and cognitive architecture of AIBO.

## 🌟 Features

- **Dynamic Cognitive Brain**: AIBO uses local LLMs (via Ollama) to process thoughts, memories, and spontaneous ideas.
- **Physical Embodiment**: Controls a 3D humanoid avatar with procedural movements and gestures.
- **Persistent Memory**: Short-term and long-term memory consolidation systems.
- **Voice Synthesis**: High-quality TTS using `edge-tts`.
- **Passive Vision**: (Optional) Integration for visual recognition and reaction.

## 🛠️ Architecture

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
