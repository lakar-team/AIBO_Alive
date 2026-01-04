import requests
import json

TEXT_MODEL = "phi3.5"
VISION_MODEL = "llava-phi3"

def send_signal(payload, api_url):
    # Default to localhost if empty
    if not api_url: api_url = "http://localhost:11434"
    
    # Format URL
    base = api_url.rstrip('/').replace('/v1/chat/completions', '')
    url = f"{base}/v1/chat/completions"
    
    try:
        response = requests.post(url, json=payload, timeout=60) # Longer timeout for local vision
        if response.status_code != 200:
            return f"[EMOTION: SAD] Error {response.status_code}", "error"
        data = response.json()
        return data['choices'][0]['message']['content'], "success"
    except Exception as e:
        print(f"Brain Error: {e}")
        return f"[EMOTION: SAD] Disconnected: {str(e)}", "error"

def get_chat_response(persona, user_text, image_data=None):
    system_instruction = f"""
    IDENTITY: You are {persona.bot_name}.
    PROTOCOL: [EMOTION: X] [MOVE: X] Spoken words...
    TRACK 1 EMOTION: [HAPPY], [SAD], [ANGRY], [SURPRISED], [NEUTRAL]
    TRACK 2 MOVEMENT: [NOD, SHAKE, UP, DOWN, LEAN_FWD, WAVE]
    MEMORY: {persona.core_biography}
    RECENT: {persona.short_term_buffer}
    """
    
    messages = [{"role": "system", "content": system_instruction}]
    active_model = TEXT_MODEL
    
    if image_data:
        if "base64," in image_data: image_data = image_data.split("base64,")[1]
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": f"{user_text} (Analyze image)"},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
            ]
        })
        active_model = VISION_MODEL
    else:
        messages.append({"role": "user", "content": user_text})

    payload = {
        "model": active_model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 200,
        "stream": False
    }
    return send_signal(payload, persona.api_endpoint)

def consolidate_memory(persona):
    prompt = f"Summarize this:\nOLD: {persona.core_biography}\nNEW: {persona.short_term_buffer}"
    payload = {"model": TEXT_MODEL, "messages": [{"role": "user", "content": prompt}], "stream": False}
    text, status = send_signal(payload, persona.api_endpoint)
    if status == "success": return True, text
    return False, text

def free_will(persona):
    prompt = f"You are {persona.bot_name}. It is quiet. Do something subtle."
    payload = {
        "model": TEXT_MODEL,
        "messages": [
            {"role": "system", "content": "OUTPUT: [EMOTION: X] [MOVE: X] (Optional Speech)"},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }
    text, status = send_signal(payload, persona.api_endpoint)
    return text if status == "success" else None