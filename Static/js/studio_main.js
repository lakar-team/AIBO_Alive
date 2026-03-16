import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AiboAvatar } from "./avatar_core.js";
import { AiboVoice } from "./speech_core.js";
import { AiboVision } from "./vision_core.js"; 

// --- TEACHER INTERFACE (RIGGING LAB) ---
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

    const header = document.createElement('div');
    header.innerHTML = "<h3 style='margin:0; text-align:center'>🎛️ RIGGING LAB</h3>";
    container.appendChild(header);

    // --- TOGGLE FREEZE / RESUME ---
    const freezeBtn = document.createElement('button');
    let isFrozen = false; 

    freezeBtn.innerText = "⏹️ FREEZE MOTOR FUNCTIONS";
    Object.assign(freezeBtn.style, {
        width: '100%', marginTop: '10px', padding: '8px', 
        background: '#550000', color: '#ffaaaa', border: '1px solid #ff0000', cursor: 'pointer',
        fontWeight: 'bold', fontSize: '11px'
    });

    freezeBtn.onclick = () => {
        if (!isFrozen) {
            isFrozen = true;
            avatar.motion.activeAnimations = []; 
            avatar.motion.energy = 1.0;          
            freezeBtn.innerText = "▶️ RESUME MOTOR FUNCTIONS";
            freezeBtn.style.background = "#005500";
            freezeBtn.style.color = "#aaffaa";
            freezeBtn.style.borderColor = "#00ff00";
            alert("❄️ AI FROZEN. You can now use the sliders to pose Arms & Legs.");
        } else {
            isFrozen = false;
            avatar.motion.energy = 1.0;
            freezeBtn.innerText = "⏹️ FREEZE MOTOR FUNCTIONS";
            freezeBtn.style.background = "#550000";
            freezeBtn.style.color = "#ffaaaa";
            freezeBtn.style.borderColor = "#ff0000";
        }
    };
    container.appendChild(freezeBtn);

    // --- SAVE / LEARN UI ---
    const saveGroup = document.createElement('div');
    saveGroup.style.marginTop = "10px";
    saveGroup.style.padding = "10px";
    saveGroup.style.background = "#220022";
    saveGroup.style.border = "1px solid #ff00ff";

    const nameInput = document.createElement('input');
    nameInput.placeholder = "POSE NAME (e.g. ARMS_HERO)";
    nameInput.style.width = "95%";
    nameInput.style.marginBottom = "5px";
    nameInput.style.background = "#000";
    nameInput.style.color = "#fff";
    nameInput.style.border = "1px solid #555";
    nameInput.style.padding = "5px";

    const saveBtn = document.createElement('button');
    saveBtn.innerText = "💾 TEACH AIBO THIS POSE";
    Object.assign(saveBtn.style, {
        width: '100%', padding: '8px', 
        background: '#550055', color: '#fff', border: '1px solid #ff00ff', cursor: 'pointer'
    });

    saveBtn.onclick = async () => {
        const rawName = nameInput.value;
        if (!rawName) { alert("Please name the pose (e.g. ARMS_BOW)"); return; }

        const t = avatar.motion.targets;
        const poseData = {
            lx: t.armL.x, ly: t.armL.y, lz: t.armL.z,
            lex: t.elbowL.x, ley: t.elbowL.y, lez: t.elbowL.z,
            lhx: t.wristL.x, lhy: t.wristL.y, lhz: t.wristL.z,
            rx: t.armR.x, ry: t.armR.y, rz: t.armR.z,
            rex: t.elbowR.x, rey: t.elbowR.y, rez: t.elbowR.z,
            rhx: t.wristR.x, rhy: t.wristR.y, rhz: t.wristR.z,
            legL: { ...t.legL }, kneeL: { ...t.kneeL },
            legR: { ...t.legR }, kneeR: { ...t.kneeR },
            head: { ...t.head }, spine: { ...t.spine }
        };

        try {
            const res = await fetch('./api/poses', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name: rawName, pose: poseData })
            });
            const d = await res.json();
            alert(`✅ AIBO LEARNED: ${d.name}`);
            avatar.motion.loadCustomPoses(); 
        } catch (e) {
            alert("Save Failed: " + e);
        }
    };

    saveGroup.appendChild(nameInput);
    saveGroup.appendChild(saveBtn);
    container.appendChild(saveGroup);

    // --- SLIDERS ---
    const createSection = (title) => {
        const details = document.createElement('details');
        details.open = false; 
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

    // 1. HEAD & BODY
    const secBody = createSection("👤 HEAD & SPINE");
    addSlider(secBody, 'Head', avatar.motion.targets.head, 'x', -1, 1);
    addSlider(secBody, 'Head', avatar.motion.targets.head, 'y', -1, 1);
    addSlider(secBody, 'Spine', avatar.motion.targets.spine, 'x', -1, 1);
    addSlider(secBody, 'Spine', avatar.motion.targets.spine, 'y', -1, 1);

    // 2. ARMS
    const secRArm = createSection("💪 RIGHT ARM");
    secRArm.open = true; 
    addSlider(secRArm, 'Shoulder', avatar.motion.targets.armR, 'x', -3.1, 3.1);
    addSlider(secRArm, 'Shoulder', avatar.motion.targets.armR, 'y', -3.1, 3.1);
    addSlider(secRArm, 'Shoulder', avatar.motion.targets.armR, 'z', -3.1, 3.1);
    addSlider(secRArm, 'Elbow', avatar.motion.targets.elbowR, 'x', -3.1, 3.1);
    addSlider(secRArm, 'Elbow', avatar.motion.targets.elbowR, 'y', -3.1, 3.1);
    addSlider(secRArm, 'Elbow', avatar.motion.targets.elbowR, 'z', -3.1, 3.1);
    addSlider(secRArm, 'Wrist', avatar.motion.targets.wristR, 'x', -3.1, 3.1);

    const secLArm = createSection("💪 LEFT ARM");
    addSlider(secLArm, 'Shoulder', avatar.motion.targets.armL, 'x', -3.1, 3.1);
    addSlider(secLArm, 'Shoulder', avatar.motion.targets.armL, 'y', -3.1, 3.1);
    addSlider(secLArm, 'Shoulder', avatar.motion.targets.armL, 'z', -3.1, 3.1);
    addSlider(secLArm, 'Elbow', avatar.motion.targets.elbowL, 'x', -3.1, 3.1);
    addSlider(secLArm, 'Elbow', avatar.motion.targets.elbowL, 'y', -3.1, 3.1);
    addSlider(secLArm, 'Elbow', avatar.motion.targets.elbowL, 'z', -3.1, 3.1);
    addSlider(secLArm, 'Wrist', avatar.motion.targets.wristL, 'x', -3.1, 3.1);

    // 3. LEGS (UPDATED)
    const secLegs = createSection("🦵 LEGS");
    addSlider(secLegs, 'L Thigh Bend', avatar.motion.targets.legL, 'x', -1.5, 1.5);
    addSlider(secLegs, 'L Thigh Turn', avatar.motion.targets.legL, 'y', -1.5, 1.5);
    addSlider(secLegs, 'L Thigh Side', avatar.motion.targets.legL, 'z', -1.5, 1.5);
    addSlider(secLegs, 'L Knee', avatar.motion.targets.kneeL, 'x', -2.5, 0);

    addSlider(secLegs, 'R Thigh Bend', avatar.motion.targets.legR, 'x', -1.5, 1.5);
    addSlider(secLegs, 'R Thigh Turn', avatar.motion.targets.legR, 'y', -1.5, 1.5);
    addSlider(secLegs, 'R Thigh Side', avatar.motion.targets.legR, 'z', -1.5, 1.5);
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
    debugBtn.innerText = "🛠️ TEACHER MODE";
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

    // --- AUTOMATICALLY INJECT SIGHT BUTTON ---
    const visionUI = document.getElementById('vision-ui');
    if (visionUI) {
        const sightBtn = document.createElement('div');
        sightBtn.id = 'sight-btn';
        sightBtn.className = 'vision-btn';
        sightBtn.innerText = '👁️';
        sightBtn.title = "Toggle Continuous Sight";
        sightBtn.onclick = () => window.toggleSight();
        visionUI.appendChild(sightBtn);
    }

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
            const isDebugging = debugPanel && debugPanel.style.display !== 'none';

            actionQueue.forEach(act => {
                if (act.type === 'EMOTION') avatar.setEmotion(act.value);
                else {
                    if (isDebugging) {
                        console.log("⚠️ Teacher Mode Open - Ignoring AI Move:", act.value);
                        return; 
                    }
                    avatar.setBodyPart(act.type, act.value);
                }
            });
        };

        if (cleanSpeech.length > 1) {
            const displayMsg = rawText.replace(tagRegex, '<span class="tag-text">[$1: $2]</span>');
            logMessage("AIBO: " + displayMsg, true);
            voice.speak(cleanSpeech, runPhysicalActions);
        } else {
            // For passive system checks (sight), we might not want to log everything if it's just [HEAD: NOD]
            // But for now we log it so you know it's working
            logMessage("AIBO: " + rawText, true);
            runPhysicalActions();
        }
    }

    // --- CONTINUOUS SIGHT LOGIC ---
    let sightLoopActive = false;
    window.toggleSight = function() {
        sightLoopActive = !sightLoopActive;
        const btn = document.getElementById('sight-btn');
        if (sightLoopActive) {
            if(btn) btn.classList.add('active');
            logMessage("SYSTEM: Visual Cortex Online. Watching...", false);
            runSightLoop();
        } else {
            if(btn) btn.classList.remove('active');
            logMessage("SYSTEM: Visual Cortex Offline.", false);
        }
    };

    async function runSightLoop() {
        if (!sightLoopActive || !vision.isActive()) {
            sightLoopActive = false;
            const btn = document.getElementById('sight-btn');
            if(btn) btn.classList.remove('active');
            return;
        }

        const imageFrame = vision.captureFrame();

        try {
            // Send passive check to brain
            const res = await fetch(window.API_URLS.chat, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: "[SYSTEM: PASSIVE_VISION_CHECK]", 
                    image: imageFrame 
                })
            });
            const data = await res.json();
            if (data.reply) executeAIResponse(data.reply);
        } catch (e) {
            console.log("Sight Error:", e);
        }

        // Recursive loop: Wait 1s after finishing before starting next
        if (sightLoopActive) setTimeout(runSightLoop, 1000);
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

        logMessage("You: " + (text || "[Sending Image...]"), false);
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
                logMessage("SYSTEM: " + (data.error || "Error"), false);
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
        logMessage("AIBO: Dream Cycle Complete.", false); 
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
    
    window.logMessage = function(msg, isHtml=false) { 
        const d = document.createElement('div');
        d.className = 'msg'; 
        if(isHtml) d.innerHTML = msg; else d.innerText = msg;
        document.getElementById('log').prepend(d);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}