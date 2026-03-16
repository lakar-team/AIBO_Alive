import requests
import json
import re
import random 

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
    # 1. Remove meta-talk (Aggressive)
    text = re.sub(r'^(Sure|Okay|Here|I will|As an AI|I can|Certainly).*?(\.|\:)\s*', '', text, flags=re.IGNORECASE)
    # 2. Fix broken brackets (e.g. "LEGS: MARCH" -> "[LEGS: MARCH]")
    text = re.sub(r'(?<!\[)(HEAD|ARMS|LEGS|BODY|EMOTION):\s*([A-Z_]+)', r'[\1: \2]', text, flags=re.IGNORECASE)
    # 3. Default Gesture if none
    if "[" not in text: text = f"[HEAD: NOD] {text}"
    return text.strip()

def get_chat_response(persona, user_text, image_data=None, known_moves=""):
    active_model = TEXT_MODEL
    messages = []
    
    # --- 1. THE PUPPETEER PROMPT (DYNAMIC) ---
    system_instruction = f"""
    You are {persona.bot_name}, a 3D Humanoid Avatar. You have a physical body.
    User: {persona.user_nickname}.
    
    SYSTEM INSTRUCTIONS:
    1. START every response with movement tags in brackets.
    2. BE CREATIVE. You can combine moves or INVENT new ones.
    3. If you want to do a move you haven't done before, just invent a tag name (e.g., [ARMS: HUG], [BODY: BOW]).
    
    KNOWN MOVES (You can use these or invent new ones):
    {known_moves}
    
    EMOTIONS: HAPPY, SAD, ANGRY, SURPRISED, NEUTRAL.
    
    CONTEXT:
    Long Term Memory: {persona.core_biography}
    """
    
    # --- 2. HANDLE PASSIVE VISION CHECK ---
    # If the system is just "checking eyes", we modify the prompt so she doesn't chat endlessly.
    if "[SYSTEM: PASSIVE_VISION_CHECK]" in user_text:
        system_instruction += "\n\nCURRENT TASK: You are passively watching the user. If they are doing nothing special, output [HEAD: NOD] or [EMOTION: NEUTRAL]. If they wave, smile, or hold an object, react briefly. DO NOT initiate long conversation."
        user_text = "What do you see right now?"
    
    messages.append({"role": "system", "content": system_instruction})

    # --- 3. INJECT SHORT TERM HISTORY (Fixes Amnesia) ---
    if persona.short_term_buffer:
        history = persona.short_term_buffer[-2000:] 
        messages.append({"role": "user", "content": f"--- MEMORY START ---\n{history}\n--- MEMORY END ---"})

    # --- 4. CURRENT INPUT ---
    if image_data:
        if "base64," in image_data: image_data = image_data.split("base64,")[1]
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": f"{user_text} (Context: React to this image)"},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
            ]
        })
        active_model = VISION_MODEL
    else:
        messages.append({"role": "user", "content": user_text})

    payload = {
        "model": active_model,
        "messages": messages,
        "temperature": 0.8, 
        "max_tokens": 150,
        "stream": False
    }
    
    raw_text, status = send_signal(payload, persona.api_endpoint)
    
    if status == "success":
        return clean_response(raw_text), "success"
        
    return raw_text, status

def consolidate_memory(persona):
    prompt = f"Summarize the key events and facts from this conversation history for long-term storage:\n{persona.short_term_buffer}"
    payload = {"model": TEXT_MODEL, "messages": [{"role": "user", "content": prompt}], "stream": False}
    text, status = send_signal(payload, persona.api_endpoint)
    return (status == "success"), text

def free_will(persona):
    # 1. Menu of options to prevent looping
    options = "HEAD: NOD, HEAD: SHAKE, ARMS: WAVE, ARMS: CROSS, BODY: DANCE, LEGS: KICK"
    
    # 2. Randomize the example to break the "STRETCH" habit
    examples = ["[HEAD: NOD]", "[ARMS: WAVE]", "[BODY: DANCE]"]
    random_ex = random.choice(examples)

    prompt = f"""
    You are {persona.bot_name}. You are currently idle.
    Pick ONE physical action from this list: {options}.
    
    Output format: {random_ex} (short thought)
    DO NOT REPEAT THE LAST ACTION. BE RANDOM.
    """
    
    payload = {
        "model": TEXT_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 1.1, # High randomness
        "stream": False
    }
    text, status = send_signal(payload, persona.api_endpoint)
    if status == "success": return clean_response(text)
    return None