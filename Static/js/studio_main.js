import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AiboAvatar } from "./avatar_core.js";
import { AiboVoice } from "./speech_core.js";
import { AiboVision } from "./vision_core.js"; 

// --- FULL BODY RIGGING LAB ---
function createDebugUI(avatar) {
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'absolute', top: '10px', right: '10px', width: '320px',
        maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: '10px', color: '#00ffcc', fontFamily: 'monospace',
        zIndex: '9999', display: 'none', border: '1px solid #00ffcc',
        boxShadow: '0 0 15px rgba(0, 255, 204, 0.2)'
    });
    container.id = 'debug-panel';

    // --- HEADER & EXPORT ---
    const header = document.createElement('div');
    header.innerHTML = "<h3 style='margin:0; text-align:center'>🎛️ POSE STUDIO</h3>";
    container.appendChild(header);

    const exportBtn = document.createElement('button');
    exportBtn.innerText = "💾 PRINT POSE TO CONSOLE";
    Object.assign(exportBtn.style, {
        width: '100%', marginTop: '10px', padding: '8px', 
        background: '#004433', color: '#fff', border: '1px solid #00ffcc', cursor: 'pointer'
    });
    exportBtn.onclick = () => {
        const t = avatar.motion.targets;
        // FORMATTER: Converts current slider values into the exact JS object for motion_core.js
        const poseData = {
            // HEAD & BODY
            head: { ...t.head },
            spine: { ...t.spine },
            hips: { ...t.hips },
            // LEFT ARM
            lx: t.armL.x, ly: t.armL.y, lz: t.armL.z,
            lex: t.elbowL.x, ley: t.elbowL.y, lez: t.elbowL.z,
            lhx: t.wristL.x, lhy: t.wristL.y, lhz: t.wristL.z,
            // RIGHT ARM
            rx: t.armR.x, ry: t.armR.y, rz: t.armR.z,
            rex: t.elbowR.x, rey: t.elbowR.y, rez: t.elbowR.z,
            rhx: t.wristR.x, rhy: t.wristR.y, rhz: t.wristR.z,
            // LEGS
            legL: { ...t.legL }, kneeL: { ...t.kneeL },
            legR: { ...t.legR }, kneeR: { ...t.kneeR }
        };
        console.log("--- COPY THIS BLOCK ---");
        console.log(JSON.stringify(poseData, (key, val) => {
            return (typeof val === 'number') ? Number(val.toFixed(2)) : val;
        }, 2));
        console.log("-----------------------");
        alert("Pose Data printed to Console (F12)!");
    };
    container.appendChild(exportBtn);

    // --- HELPER: CREATE SLIDER GROUP ---
    const createSection = (title) => {
        const details = document.createElement('details');
        details.open = false; // Collapsed by default to save space
        details.style.marginTop = '5px';
        details.style.borderBottom = '1px solid #333';
        const summary = document.createElement('summary');
        summary.innerText = title;
        summary.style.cursor = 'pointer';
        summary.style.fontWeight = 'bold';
        summary.style.padding = '5px';
        summary.style.backgroundColor = '#111';
        details.appendChild(summary);
        container.appendChild(details);
        return details;
    };

    const addSlider = (parent, label, targetObj, axis, min, max, step=0.1) => {
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.justifyContent = 'space-between';
        row.style.fontSize = '12px'; row.style.padding = '2px 0';

        const lbl = document.createElement('span');
        lbl.innerText = `${label} ${axis.toUpperCase()}`;
        lbl.style.width = '70px';

        const valDisplay = document.createElement('span');
        valDisplay.innerText = targetObj[axis].toFixed(2);
        valDisplay.style.width = '35px';
        valDisplay.style.textAlign = 'right';

        const input = document.createElement('input');
        input.type = 'range'; input.min = min; input.max = max; input.step = step;
        input.value = targetObj[axis];
        input.style.flexGrow = '1';

        input.oninput = (e) => {
            const v = parseFloat(e.target.value);
            targetObj[axis] = v;
            valDisplay.innerText = v.toFixed(2);
        };

        row.appendChild(lbl); row.appendChild(input); row.appendChild(valDisplay);
        parent.appendChild(row);
    };

    // --- 1. HEAD & BODY ---
    const secBody = createSection("👤 HEAD & SPINE");
    addSlider(secBody, 'Head', avatar.motion.targets.head, 'x', -1, 1);
    addSlider(secBody, 'Head', avatar.motion.targets.head, 'y', -1, 1);
    addSlider(secBody, 'Spine', avatar.motion.targets.spine, 'x', -1, 1);
    addSlider(secBody, 'Spine', avatar.motion.targets.spine, 'y', -1, 1);
    addSlider(secBody, 'Hips', avatar.motion.targets.hips, 'y', -1, 1);

    // --- 2. RIGHT ARM (Focus) ---
    const secRArm = createSection("💪 RIGHT ARM");
    secRArm.open = true; // Open by default
    addSlider(secRArm, 'Shoulder', avatar.motion.targets.armR, 'x', -3.1, 3.1);
    addSlider(secRArm, 'Shoulder', avatar.motion.targets.armR, 'y', -3.1, 3.1);
    addSlider(secRArm, 'Shoulder', avatar.motion.targets.armR, 'z', -3.1, 3.1);
    secRArm.appendChild(document.createElement('hr'));
    addSlider(secRArm, 'Elbow', avatar.motion.targets.elbowR, 'x', -3.1, 3.1);
    addSlider(secRArm, 'Elbow', avatar.motion.targets.elbowR, 'y', -3.1, 3.1);
    addSlider(secRArm, 'Elbow', avatar.motion.targets.elbowR, 'z', -3.1, 3.1);
    secRArm.appendChild(document.createElement('hr'));
    addSlider(secRArm, 'Wrist', avatar.motion.targets.wristR, 'x', -3.1, 3.1);
    addSlider(secRArm, 'Wrist', avatar.motion.targets.wristR, 'y', -3.1, 3.1);
    addSlider(secRArm, 'Wrist', avatar.motion.targets.wristR, 'z', -3.1, 3.1);

    // --- 3. LEFT ARM ---
    const secLArm = createSection("💪 LEFT ARM");
    addSlider(secLArm, 'Shoulder', avatar.motion.targets.armL, 'x', -3.1, 3.1);
    addSlider(secLArm, 'Shoulder', avatar.motion.targets.armL, 'y', -3.1, 3.1);
    addSlider(secLArm, 'Shoulder', avatar.motion.targets.armL, 'z', -3.1, 3.1);
    secLArm.appendChild(document.createElement('hr'));
    addSlider(secLArm, 'Elbow', avatar.motion.targets.elbowL, 'x', -3.1, 3.1);
    addSlider(secLArm, 'Elbow', avatar.motion.targets.elbowL, 'y', -3.1, 3.1);
    addSlider(secLArm, 'Elbow', avatar.motion.targets.elbowL, 'z', -3.1, 3.1);
    secLArm.appendChild(document.createElement('hr'));
    addSlider(secLArm, 'Wrist', avatar.motion.targets.wristL, 'x', -3.1, 3.1);
    addSlider(secLArm, 'Wrist', avatar.motion.targets.wristL, 'y', -3.1, 3.1);
    addSlider(secLArm, 'Wrist', avatar.motion.targets.wristL, 'z', -3.1, 3.1);

    // --- 4. LEGS ---
    const secLegs = createSection("🦵 LEGS");
    addSlider(secLegs, 'L Thigh', avatar.motion.targets.legL, 'x', -1.5, 1.5);
    addSlider(secLegs, 'L Thigh', avatar.motion.targets.legL, 'y', -1.5, 1.5);
    addSlider(secLegs, 'L Thigh', avatar.motion.targets.legL, 'z', -1.5, 1.5);
    addSlider(secLegs, 'L Knee', avatar.motion.targets.kneeL, 'x', -2.5, 0);
    secLegs.appendChild(document.createElement('hr'));
    addSlider(secLegs, 'R Thigh', avatar.motion.targets.legR, 'x', -1.5, 1.5);
    addSlider(secLegs, 'R Thigh', avatar.motion.targets.legR, 'y', -1.5, 1.5);
    addSlider(secLegs, 'R Thigh', avatar.motion.targets.legR, 'z', -1.5, 1.5);
    addSlider(secLegs, 'R Knee', avatar.motion.targets.kneeR, 'x', -2.5, 0);

    document.body.appendChild(container);
    return container;
}

export function initStudio(avatarUrl) {
    console.log("--- SYSTEM: STUDIO INIT STARTED ---");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
    camera.position.set(0, 0.9, 5.5); 
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0); 
    controls.enableDamping = true;
    controls.update();

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(1, 2, 3);
    scene.add(keyLight);
    scene.add(new THREE.AmbientLight(0x404040)); 

    const avatar = new AiboAvatar(scene, camera);
    const voice = new AiboVoice(avatar);
    const vision = new AiboVision(); 

    // --- CREATE THE DEBUG BUTTON ---
    const debugBtn = document.createElement('button');
    debugBtn.innerText = "🛠️ RIGGING LAB";
    Object.assign(debugBtn.style, {
        position: 'absolute', bottom: '20px', right: '20px',
        padding: '10px 20px', backgroundColor: '#333', color: '#fff',
        border: '1px solid #00ffcc', cursor: 'pointer', zIndex: '1000'
    });
    debugBtn.onclick = () => {
        const p = document.getElementById('debug-panel');
        if (!p) createDebugUI(avatar).style.display = 'block';
        else p.style.display = p.style.display === 'none' ? 'block' : 'none';
    };
    document.body.appendChild(debugBtn);

    function executeAIResponse(rawText) {
        if (!rawText) return;
        console.log(">> RAW AI:", rawText);

        let cleanSpeech = rawText;
        const actionQueue = [];
        const tagRegex = /\[(HEAD|ARMS|LEGS|BODY|EMOTION|MOVE):\s*([A-Z_]+)\]/gi;
        let match;
        
        while ((match = tagRegex.exec(rawText)) !== null) {
            const type = match[1].toUpperCase();
            const val = match[2].toUpperCase();
            if (type === 'MOVE') actionQueue.push({ type: 'BODY', value: val });
            else actionQueue.push({ type: type, value: val });
            cleanSpeech = cleanSpeech.replace(match[0], "");
        }
        cleanSpeech = cleanSpeech.replace(/\s+/g, " ").trim();

        const runPhysicalActions = () => {
            const debugPanel = document.getElementById('debug-panel');
            // IMPORTANT: If Debug Panel is open, IGNORE AI movements so you can adjust sliders!
            const isDebugging = debugPanel && debugPanel.style.display !== 'none';

            actionQueue.forEach(act => {
                if (act.type === 'EMOTION') avatar.setEmotion(act.value);
                else {
                    if (isDebugging) {
                        console.log("⚠️ Rigging Lab Open - Ignoring AI Move:", act.value);
                        return; 
                    }
                    avatar.setBodyPart(act.type, act.value);
                }
            });
        };

        if (cleanSpeech.length > 1) {
            logMessage("AIBO: " + cleanSpeech);
            voice.speak(cleanSpeech, runPhysicalActions);
        } else {
            logMessage("AIBO: [Gesture]");
            runPhysicalActions();
        }
    }

    setInterval(async () => {
        try {
            const res = await fetch('./api/pulse');
            const data = await res.json();
            if (data.pulse) executeAIResponse(data.pulse);
        } catch (e) { }
    }, 5000); 

    avatar.load(avatarUrl, () => {
        document.getElementById('loader').style.display = 'none';
        console.log("--- SYSTEM: AVATAR LOADED ---");
    });

    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); 
        avatar.update(clock.getDelta());
        renderer.render(scene, camera);
    }
    animate();

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
            if (data.reply) executeAIResponse(data.reply);
        } catch (e) {
            logMessage("Network Error: " + e.message);
            avatar.setEmotion("SAD");
        }
    }

    window.savePersona = async function() {
        const btn = document.getElementById('save-btn');
        btn.innerText = "UPLOADING...";
        try {
            const payload = {
                bot_name: document.getElementById('bot-name').value,
                user_nickname: document.getElementById('user-nick').value,
                system_prompt: document.getElementById('sys-prompt').value,
                core_biography: document.getElementById('core-bio').value,
                api_endpoint: document.getElementById('api-url').value,
                voice_id: document.getElementById('voice-select').value,
                voice_pitch: document.getElementById('pitch').value,
                voice_rate: document.getElementById('rate').value,
                voice_volume: document.getElementById('volume').value
            };
            await fetch(window.API_URLS.update_persona, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            btn.innerText = "✅ SAVED";
        } catch (e) { btn.innerText = "⚠️ FAIL"; }
        setTimeout(() => { btn.innerText = "💾 SAVE CORE IDENTITY"; }, 2000);
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
    window.testVoice = function() { voice.speak("Voice systems online.", () => avatar.setEmotion('HAPPY')); }
    window.togglePanel = function() { document.getElementById('controls').classList.toggle('hidden'); }
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