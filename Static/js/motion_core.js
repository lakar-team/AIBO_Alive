import * as THREE from 'three';

export class MotionEngine {
    constructor() {
        this.time = 0;
        this.vrm = null;
        this.energy = 1.0; 
        this.baseSpeed = 2.0; 
        
        this.activeAnimations = []; 

        // --- HARDCODED BASE LIBRARY ---
        this.poses = {
            HEAD: {
                NEUTRAL: { x: 0, y: 0, z: 0 },
                NOD:     { anim: 'NOD' },       
                SHAKE:   { anim: 'SHAKE' },     
                UP:      { x: -0.3, y: 0, z: 0 },
                DOWN:    { x: 0.3, y: 0, z: 0 },
                TILT_L:  { x: 0, y: 0, z: 0.2 },
                TILT_R:  { x: 0, y: 0, z: -0.2 }
            },
            ARMS: {
                NEUTRAL: { lx: 0, ly: 0, lz: 1.3, lex: 0, ley: 0.1, lez: 0, rx: 0, ry: 0, rz: 1.3, rex: 0, rey: 0.1, rez: 0 },
                OPEN: { lx: 0.2, ly: 0, lz: 0.3, lex: 0, ley: 0.5, lez: 0, rx: 0.2, ry: 0, rz: 0.3, rex: 0, rey: 0.5, rez: 0 },
                UP: { lx: 0, ly: 0, lz: -2.5, lex: 0, ley: 0, lez: 0, rx: 0, ry: 0, rz: -2.5, rex: 0, rey: 0, rez: 0 },
                CROSS: { lx: 0.6, ly: 0.5, lz: 1.2, lex: 0, ley: 2.0, lez: 0, rx: 0.6, ry: -0.5, rz: 1.2, rex: 0, rey: 2.0, rez: 0 },
                WAVE: { anim: 'WAVE' },
                CLAP: { anim: 'CLAP' }
            },
            LEGS: {
                NEUTRAL: { lx: 0, ly: 0, lz: 0, lex: 0, rx: 0, ry: 0, rz: 0, rex: 0 },
                CUTE:    { lx: -0.1, ly: 0, lz: 0, lex: 0.2, rx: -0.1, ry: 0, rz: 0, rex: 0.2 },
                WIDE:    { lx: 0, ly: 0, lz: 0.1, lex: 0, rx: 0, ry: 0, rz: -0.1, rex: 0 },
                MARCH:   { anim: 'MARCH' },
                KICK:    { anim: 'KICK' }
            },
            BODY: {
                NEUTRAL: { x: 0, y: 0, z: 0 },
                LEAN_F:  { x: 0.3, y: 0, z: 0 },
                LEAN_B:  { x: -0.2, y: 0, z: 0 },
                TWIST:   { anim: 'TWIST' },
                JUMP:    { anim: 'JUMP' },
                DANCE:   { anim: 'DANCE' }
            }
        };

        // TARGETS
        this.targets = {
            hips: { x: 0, y: 0 },
            spine: { x: 0, y: 0, z: 0 },
            head: { x: 0, y: 0, z: 0 },
            armL: { x: 0, y: 0, z: 1.3 }, elbowL: { x: 0, y: 0.1, z: 0 }, wristL: { x:0, y:0, z:0 },
            armR: { x: 0, y: 0, z: 1.3 }, elbowR: { x: 0, y: 0.1, z: 0 }, wristR: { x:0, y:0, z:0 },
            legL: { x: 0, y: 0, z: 0 }, kneeL: { x: 0 },
            legR: { x: 0, y: 0, z: 0 }, kneeR: { x: 0 }
        };

        // LOAD LEARNED BEHAVIORS
        this.loadCustomPoses();
    }

    async loadCustomPoses() {
        try {
            const res = await fetch('./api/poses');
            const data = await res.json();
            
            // Format of Key: "ARMS_HERO_POSE" or "LEGS_SIT"
            Object.keys(data).forEach(key => {
                const val = data[key];
                const parts = key.split('_');
                const category = parts[0]; // ARMS, LEGS, etc.
                const name = parts.slice(1).join('_'); // HERO_POSE

                if (this.poses[category]) {
                    this.poses[category][name] = val;
                }
            });
            console.log("AIBO Motion: Knowledge Updated.");
        } catch (e) {
            console.error("Could not load custom poses:", e);
        }
    }

    setVRM(vrm) { this.vrm = vrm; }

    setMood(tag) { 
        if (tag === 'HAPPY' || tag === 'JOY') this.energy = 1.2;
        else if (tag === 'SAD') this.energy = 0.5;
        else this.energy = 1.0;
    }

    triggerSpecific(part, action) {
        if (!this.poses[part]) return;
        
        let data = this.poses[part][action];
        
        // HALLUCINATION HANDLING:
        // If AI asks for [ARMS: SUPERMAN] but we don't have it, log it and ignore.
        if (!data) {
            console.warn(`AIBO attempted unknown move: ${part} -> ${action}. Use Rigging Lab to teach this!`);
            return;
        }

        if (data.anim) {
            this.activeAnimations = this.activeAnimations.filter(a => a.limb !== part);
            this.activeAnimations.push({ limb: part, type: data.anim, timer: 0 });
        } else {
            if (part === 'HEAD') this.targets.head = { ...data };
            if (part === 'BODY') this.targets.spine = { ...data };
            if (part === 'ARMS') {
                this.targets.armL.x = data.lx; this.targets.armL.y = data.ly; this.targets.armL.z = data.lz;
                this.targets.elbowL.x = data.lex; this.targets.elbowL.y = data.ley; this.targets.elbowL.z = data.lez;
                this.targets.wristL.x = data.lhx || 0; this.targets.wristL.y = data.lhy || 0; this.targets.wristL.z = data.lhz || 0;

                this.targets.armR.x = data.rx; this.targets.armR.y = data.ry; this.targets.armR.z = data.rz;
                this.targets.elbowR.x = data.rex; this.targets.elbowR.y = data.rey; this.targets.elbowR.z = data.rez;
                this.targets.wristR.x = data.rhx || 0; this.targets.wristR.y = data.rhy || 0; this.targets.wristR.z = data.rhz || 0;
                
                this.activeAnimations = this.activeAnimations.filter(a => a.limb !== 'ARMS');
            }
            if (part === 'LEGS') {
                this.targets.legL.x = data.lx; this.targets.legL.y = data.ly; this.targets.legL.z = data.lz;
                this.targets.legR.x = data.rx; this.targets.legR.y = data.ry; this.targets.legR.z = data.rz;
                this.targets.kneeL.x = data.lex || 0; 
                this.targets.kneeR.x = data.rex || 0;
                this.activeAnimations = this.activeAnimations.filter(a => a.limb !== 'LEGS');
            }
        }
    }

    update(deltaTime) {
        if (!this.vrm) return;
        this.time += deltaTime;
        const humanoid = this.vrm.humanoid;
        
        const breath = Math.sin(this.time * 0.8) * 0.02;
        let spineX = this.targets.spine.x + breath;
        let spineY = this.targets.spine.y;
        let hipsY = 0; 
        let hipsX = 0;

        // ANIMATIONS
        this.activeAnimations.forEach(anim => {
            anim.timer += deltaTime * this.energy;
            const t = anim.timer;

            if (anim.type === 'WAVE') {
                this.targets.armR.z = -2.5; 
                this.targets.armR.x = 0; 
                this.targets.elbowR.y = 2.0;
                this.targets.elbowR.z = Math.sin(this.time * 8) * 0.5; 
            }
            if (anim.type === 'CLAP') {
                this.targets.armL.x = 0.6; this.targets.armL.z = 0.5;
                this.targets.armR.x = 0.6; this.targets.armR.z = 0.5;
                const clap = Math.abs(Math.sin(this.time * 10)) * 0.2;
                this.targets.armL.z = 0.5 + clap; 
                this.targets.armR.z = 0.5 + clap; 
            }
            if (anim.type === 'MARCH') {
                const marchSpeed = 10;
                this.targets.legL.x = Math.max(0, Math.sin(this.time * marchSpeed)) * 0.5;
                this.targets.legR.x = Math.max(0, Math.sin(this.time * marchSpeed + Math.PI)) * 0.5;
                this.targets.kneeL.x = -this.targets.legL.x * 1.5;
                this.targets.kneeR.x = -this.targets.legR.x * 1.5;
            }
            if (anim.type === 'KICK') {
                if (t < 0.3) { this.targets.legR.x = -0.4; this.targets.kneeR.x = -1.5; }
                else if (t < 0.6) { this.targets.legR.x = 1.4; this.targets.kneeR.x = 0; }
                else if (t < 1.0) { this.targets.legR.x = 0; this.targets.kneeR.x = 0; }
                else anim.finished = true;
            }
            if (anim.type === 'JUMP') {
                if (t < 0.2) hipsY = -0.2; else if (t < 0.6) hipsY = 0.5; 
                else if (t < 0.9) hipsY = -0.1; else anim.finished = true;
            }
            if (anim.type === 'DANCE') {
                hipsY = Math.abs(Math.sin(this.time * 8)) * 0.1; spineY = Math.sin(this.time * 4) * 0.2;
                this.targets.legL.z = 0.1; this.targets.legR.z = -0.1;
            }
        });

        this.activeAnimations = this.activeAnimations.filter(a => !a.finished);

        // APPLY LOGIC
        const s = this.baseSpeed * deltaTime * this.energy;
        const apply = (b, t) => {
            const bone = humanoid.getNormalizedBoneNode(b);
            if(bone) {
                if (isNaN(t.x)) t.x = 0; if (isNaN(t.y)) t.y = 0; if (isNaN(t.z)) t.z = 0;
                bone.rotation.x += (t.x - bone.rotation.x) * s;
                bone.rotation.y += (t.y - bone.rotation.y) * s;
                bone.rotation.z += (t.z - bone.rotation.z) * s;
            }
        };

        apply('head', this.targets.head);
        apply('spine', { x: spineX, y: spineY, z: this.targets.spine.z });
        
        apply('leftUpperArm', this.targets.armL);
        apply('rightUpperArm', this.targets.armR);
        apply('leftLowerArm', this.targets.elbowL);
        apply('rightLowerArm', this.targets.elbowR);
        apply('leftHand', this.targets.wristL);
        apply('rightHand', this.targets.wristR);

        apply('leftUpperLeg', this.targets.legL);
        apply('rightUpperLeg', this.targets.legR);
        apply('leftLowerLeg', this.targets.kneeL);
        apply('rightLowerLeg', this.targets.kneeR);

        const hips = humanoid.getNormalizedBoneNode('hips');
        if (hips) {
            let nextY = hips.position.y + (hipsY - hips.position.y) * s;
            hips.position.y = nextY; 
            hips.position.x += (hipsX - hips.position.x) * s;
        }
    }
}