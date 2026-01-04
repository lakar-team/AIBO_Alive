import * as THREE from 'three';
import { AiboAvatar } from "./avatar_core.js";
import { AiboVoice } from "./speech_core.js";
import { AiboVision } from "./vision_core.js"; 

export function initStudio(avatarUrl) {
    console.log("--- SYSTEM: STUDIO INIT STARTED ---");

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
    camera.position.set(0, 1.0, 4.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    // Lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(1, 1, 1);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xb0c4de, 1.0);
    fillLight.position.set(-1, 0.5, 1);
    scene.add(fillLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    backLight.position.set(0, 2, -2);
    scene.add(backLight);
    scene.add(new THREE.AmbientLight(0x808080));

    // --- SYSTEMS ---
    const avatar = new AiboAvatar(scene, camera);
    const voice = new AiboVoice(avatar);
    const vision = new AiboVision(); 

    // --- VOICE OVERRIDE ---
    voice.speak = async function(text) {
        if (!text) return;
        this.stop();

        const voiceId = document.getElementById('voice-select').value;
        const pVal = document.getElementById('pitch').value;
        const pitch = (pVal >= 0 ? '+' : '') + pVal + 'Hz';
        const rVal = document.getElementById('rate').value;
        const rate = (rVal >= 0 ? '+' : '') + rVal + '%';
        const vVal = document.getElementById('volume').value;
        const volume = (vVal >= 0 ? '+' : '') + vVal + '%';
        
        // HUGGING FACE SIDECAR
        const SIDECAR_URL = "https://lakarteam2025-aibo-voice-box.hf.space/tts";

        try {
            const response = await fetch(SIDECAR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text, voice: voiceId, pitch: pitch, rate: rate, volume: volume
                })
            });

            if (!response.ok) throw new Error("Voice Gen Failed");
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.onplay = () => this.startLipSync();
            this.currentAudio.onended = () => { this.stopLipSync(); URL.revokeObjectURL(audioUrl); };
            this.currentAudio.play();

        } catch (e) {
            console.error("Voice Error:", e);
            logMessage("Error: " + e.message);
        }
    };

    // --- THE REGULATOR (Parses & Distributes Commands) ---
    function processAIResponse(rawText) {
        let cleanSpeech = rawText;
        
        // 1. EXTRACT & EXECUTE MOTION [MOVE: ...]
        const moveRegex = /\[MOVE:\s*([^\]]+)\]/g;
        let moveMatch;
        while ((moveMatch = moveRegex.exec(rawText)) !== null) {
            const command = moveMatch[1];
            console.log(">> REGULATOR: Dispatching Move ->", command);
            avatar.motion.applyKineticCommand(command);
            cleanSpeech = cleanSpeech.replace(moveMatch[0], ""); 
        }

        // 2. EXTRACT & EXECUTE EMOTION [EMOTION: ...] or [HAPPY]
        const emotionRegex = /\[(?:EMOTION:\s*)?([A-Z_]+)\]/g;
        let emoMatch;
        while ((emoMatch = emotionRegex.exec(rawText)) !== null) {
            const tag = emoMatch[1];
            if (tag.includes("MOVE") || tag.includes("CMD") || tag.includes("ACTION")) continue;
            
            console.log(">> REGULATOR: Dispatching Emotion ->", tag);
            avatar.setEmotion(tag);
            cleanSpeech = cleanSpeech.replace(emoMatch[0], "");
        }

        // 3. CLEANUP
        cleanSpeech = cleanSpeech.replace(/\*[^*]+\*/g, ""); 
        cleanSpeech = cleanSpeech.trim();
        
        return cleanSpeech;
    }

    // --- HEARTBEAT SYSTEM (FREE WILL) ---
    setInterval(async () => {
        try {
            const res = await fetch('./api/pulse');
            const data = await res.json();
            
            if (data.pulse) {
                console.log("AIBO Pulse:", data.pulse);
                const spokenText = processAIResponse(data.pulse);
                if (spokenText && spokenText.length > 1) {
                    logMessage("AIBO (Spontaneous): " + spokenText);
                    voice.speak(spokenText);
                }
            }
        } catch (e) { }
    }, 5000); 

    // --- LOAD AVATAR ---
    avatar.load(avatarUrl, () => {
        document.getElementById('loader').style.display = 'none';
        console.log("--- SYSTEM: AVATAR LOADED ---");
    });

    // --- ANIMATION LOOP ---
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        avatar.update(clock.getDelta());
        renderer.render(scene, camera);
    }
    animate();

    // --- UI FUNCTIONS ---
    window.sendMessage = async function() {
        const input = document.getElementById('user-input');
        const text = input.value;
        if (!text && !vision.isActive()) return;

        logMessage("You: " + (text || "[Sending Image...]"));
        input.value = "";
        voice.stop();
        const imageFrame = vision.captureFrame();

        try {
            const res = await fetch(window.API_URLS.chat, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, image: imageFrame })
            });
            const data = await res.json();

            if (!res.ok || data.error) {
                logMessage("SYSTEM: " + (data.error || "Error"));
                avatar.setEmotion("SAD");
                return;
            }

            if (data.reply) {
                const spokenText = processAIResponse(data.reply);
                if (spokenText) {
                    logMessage("AIBO: " + spokenText);
                    voice.speak(spokenText);
                }
            }
        } catch (e) {
            logMessage("Network Error: " + e.message);
            avatar.setEmotion("SAD");
        }
    }

    // --- STANDARD UI HELPERS (Save, Toggle, etc) ---
    window.savePersona = async function() {
        const btn = document.getElementById('save-btn');
        const originalText = btn.innerText;
        btn.innerText = "UPLOADING...";
        btn.disabled = true;

        try {
            const payload = {
                bot_name: document.getElementById('bot-name').value,
                user_nickname: document.getElementById('user-nick').value,
                system_prompt: document.getElementById('sys-prompt').value,
                core_biography: document.getElementById('core-bio').value,
                
                // NEW: Send API URL
                api_endpoint: document.getElementById('api-url').value,

                voice_id: document.getElementById('voice-select').value,
                voice_pitch: document.getElementById('pitch').value,
                voice_rate: document.getElementById('rate').value,
                voice_volume: document.getElementById('volume').value
            };

            const res = await fetch(window.API_URLS.update_persona, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                logMessage("SYSTEM: Settings Saved.");
                btn.innerText = "✅ SAVED";
                btn.style.background = "#005500";
            } else {
                throw new Error("Save Failed");
            }
        } catch (e) {
            logMessage("FAIL: " + e.message);
            btn.innerText = "⚠️ FAIL";
        }
        setTimeout(() => { btn.innerText = originalText; btn.disabled = false; btn.style.background = ""; }, 2000);
    }
    
    window.toggleWebcam = async function() {
         if (vision.mode === 'webcam') { vision.stop(); document.getElementById('cam-btn').classList.remove('active'); }
         else { if(await vision.startWebcam()) document.getElementById('cam-btn').classList.add('active'); }
    }
    window.toggleScreen = async function() {
         if (vision.mode === 'screen') { vision.stop(); document.getElementById('screen-btn').classList.remove('active'); }
         else { if(await vision.startScreen()) document.getElementById('screen-btn').classList.add('active'); }
    }
    window.triggerDream = async function() { 
        await fetch(window.API_URLS.dream_cycle, {method: 'POST'}); 
        logMessage("AIBO: Dream Cycle Complete."); 
    }
    window.toggleListening = function() {
        const btn = document.getElementById('mic-btn');
        voice.listen(
            (text) => { document.getElementById('user-input').value = text; sendMessage(); },
            () => btn.classList.add('listening'),
            () => btn.classList.remove('listening')
        );
    }
    window.testVoice = function() { voice.speak("Voice systems nominal."); }
    window.togglePanel = function() {
        const panel = document.getElementById('controls');
        panel.classList.toggle('hidden');
    }
    window.updateLabel = function(id, val) { document.getElementById(id).innerText = val; }
    window.toggleSection = function(id) {
        const el = document.getElementById(id);
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
    window.logMessage = function(msg) {
        const d = document.createElement('div');
        d.className = 'msg'; d.innerText = msg;
        document.getElementById('log').prepend(d);
    }
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}