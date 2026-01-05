import requests
import json
import re

# --- CONFIGURATION ---
TEXT_MODEL = "qwen2.5:3b" 
VISION_MODEL = "llava-phi3" 

def send_signal(payload, api_url):
    if not api_url: api_url = "http://localhost:11434"
    base = api_url.rstrip('/').replace('/v1/chat/completions', '')
    url = f"{base}/v1/chat/completions"
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        if response.status_code != 200:
            return f"[EMOTION: SAD] Error {response.status_code}", "error"
        data = response.json()
        return data['choices'][0]['message']['content'], "success"
    except Exception as e:
        print(f"Brain Error: {e}")
        return f"[EMOTION: SAD] Disconnected: {str(e)}", "error"

def clean_response(text):
    # 1. Remove meta-talk
    text = re.sub(r'^(Sure|Okay|Here|I will|As).*?(\.|\:)\s*', '', text, flags=re.IGNORECASE)
    
    # 2. Ensure tags have brackets (e.g., "LEGS: MARCH" -> "[LEGS: MARCH]")
    text = re.sub(r'(?<!\[)(HEAD|ARMS|LEGS|BODY|EMOTION):\s*([A-Z_]+)', r'[\1: \2]', text, flags=re.IGNORECASE)

    # 3. Fallback
    if "[" not in text:
        text = f"[HEAD: NOD] [ARMS: NEUTRAL] {text}"

    return text.strip()

def get_chat_response(persona, user_text, image_data=None):
    active_model = TEXT_MODEL
    messages = []

    if image_data:
        # VISION PIPELINE
        if "base64," in image_data: image_data = image_data.split("base64,")[1]
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": f"{user_text} (Context: You are looking at this image. React to it as {persona.bot_name})"},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
            ]
        })
        active_model = VISION_MODEL
    else:
        # --- THE PUPPETEER PROMPT ---
        system_instruction = f"""
        You are {persona.bot_name}, a 3D Anime Character.
        User: {persona.user_nickname}.
        
        CONTROL SYSTEM:
        You have direct control over your body parts. Compose your movement every turn.
        
        AVAILABLE PARTS:
        1. [HEAD: ...] -> NOD, SHAKE, TILT_L, TILT_R, UP, DOWN, NEUTRAL
        2. [ARMS: ...] -> OPEN, HIPS, CROSS, WAVE, UP, CLAP, CHIN, NEUTRAL
        3. [LEGS: ...] -> MARCH, KICK, CUTE, WIDE, NEUTRAL
        4. [BODY: ...] -> LEAN_F, LEAN_B, TWIST, JUMP, DANCE, SLOW_DANCE, IDOL, SLUMP
        5. [EMOTION: ...] -> HAPPY, SAD, ANGRY, SURPRISED, NEUTRAL
        
        RULES:
        - Use [LEGS: MARCH] when excited or assertive.
        - Use [LEGS: CUTE] (knees together) for shy/cute moments.
        - [ARMS: CROSS] means you are defensive or thinking.
        
        EXAMPLES:
        User: Dance!
        You: [EMOTION: HAPPY] [BODY: DANCE] [LEGS: MARCH] [ARMS: WAVE] Look at me go!
        
        User: I am sad.
        You: [EMOTION: SAD] [BODY: SLUMP] [LEGS: CUTE] [HEAD: DOWN] Oh no... I am here for you.
        """
        
        messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": user_text})

    payload = {
        "model": active_model,
        "messages": messages,
        "temperature": 0.8, 
        "max_tokens": 120,
        "stream": False
    }
    
    raw_text, status = send_signal(payload, persona.api_endpoint)
    
    if status == "success":
        return clean_response(raw_text), "success"
        
    return raw_text, status

def consolidate_memory(persona):
    prompt = f"Summarize this:\n{persona.short_term_buffer}"
    payload = {"model": TEXT_MODEL, "messages": [{"role": "user", "content": prompt}], "stream": False}
    text, status = send_signal(payload, persona.api_endpoint)
    return (status == "success"), text

def free_will(persona):
    prompt = f"Do a random physical action. Format: [EMOTION: HAPPY] [HEAD: UP] [ARMS: UP] (text)"
    payload = {
        "model": TEXT_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.9,
        "stream": False
    }
    text, status = send_signal(payload, persona.api_endpoint)
    if status == "success": return clean_response(text)
    return None