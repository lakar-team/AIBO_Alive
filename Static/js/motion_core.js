import * as THREE from 'three';

export class MotionEngine {
    constructor() {
        this.time = 0;
        this.vrm = null;
        
        // --- KINETIC LIBRARY: Defines the geometry of every move ---
        this.poses = {
            HEAD: {
                NEUTRAL: { x: 0, y: 0, z: 0 },
                NOD:     { x: 0.3, y: 0, z: 0 }, // Animation
                UP:      { x: -0.3, y: 0, z: 0 },
                DOWN:    { x: 0.3, y: 0, z: 0 },
                LEFT:    { x: 0, y: 0.5, z: 0 },
                RIGHT:   { x: 0, y: -0.5, z: 0 },
                TILT_L:  { x: 0, y: 0, z: 0.3 },
                TILT_R:  { x: 0, y: 0, z: -0.3 }
            },
            BODY: {
                NEUTRAL:   { x: 0, y: 0, z: 0 },
                LEAN_FWD:  { x: 0.2, y: 0, z: 0 },
                LEAN_BACK: { x: -0.1, y: 0, z: 0 },
                TWIST_L:   { x: 0, y: 0.3, z: 0 },
                TWIST_R:   { x: 0, y: -0.3, z: 0 }
            },
            ARM_L: {
                NEUTRAL: { z: 1.2, x: 0, y: 0 }, // Relaxed A-Pose
                DOWN:    { z: 1.4, x: 0, y: 0 },
                UP:      { z: 2.8, x: 0, y: 0 }, 
                SIDE:    { z: 0, x: 0, y: 0 },   
                FRONT:   { z: 1.3, x: 0, y: 1.5 },
                HIP:     { z: 0.5, x: 0.5, y: -0.5 },
                WAVE:    { z: 0, x: 0, y: 0 },   // Animation
                CROSS:   { z: 1.3, x: 0.5, y: 1.5 } 
            },
            ARM_R: {
                NEUTRAL: { z: -1.2, x: 0, y: 0 },
                DOWN:    { z: -1.4, x: 0, y: 0 },
                UP:      { z: -2.8, x: 0, y: 0 },
                SIDE:    { z: 0, x: 0, y: 0 },
                FRONT:   { z: -1.3, x: 0, y: -1.5 },
                HIP:     { z: -0.5, x: 0.5, y: 0.5 },
                WAVE:    { z: 0, x: 0, y: 0 },
                CROSS:   { z: -1.3, x: 0.5, y: -1.5 }
            }
        };

        // Current Targets
        this.targets = {
            spine: { ...this.poses.BODY.NEUTRAL },
            head:  { ...this.poses.HEAD.NEUTRAL },
            armL:  { ...this.poses.ARM_L.NEUTRAL },
            armR:  { ...this.poses.ARM_R.NEUTRAL }
        };

        this.mood = "NEUTRAL";
        this.activeAnimations = []; 
    }

    setVRM(vrm) { this.vrm = vrm; }

    // --- COMMAND PARSER ---
    // Takes: "HEAD=LEFT; ARM_R=UP"
    applyKineticCommand(cmdString) {
        if (!cmdString) return;
        this.activeAnimations = []; // Reset active animations
        
        const parts = cmdString.split(';');
        parts.forEach(part => {
            const [limb, state] = part.trim().split('=');
            // Basic mapping check
            const limbMap = { 'ARMS': ['ARM_L', 'ARM_R'], 'HEAD':['HEAD'], 'BODY':['BODY'], 'ARM_L':['ARM_L'], 'ARM_R':['ARM_R'] };
            
            if (limb && state && limbMap[limb]) {
                limbMap[limb].forEach(realLimb => {
                    if (this.poses[realLimb] && this.poses[realLimb][state]) {
                         if (state !== 'WAVE' && state !== 'NOD' && state !== 'SHAKE') {
                           // Static Pose
                           if (realLimb === 'HEAD') this.targets.head = { ...this.poses.HEAD[state] };
                           if (realLimb === 'BODY') this.targets.spine = { ...this.poses.BODY[state] };
                           if (realLimb === 'ARM_L') this.targets.armL = { ...this.poses.ARM_L[state] };
                           if (realLimb === 'ARM_R') this.targets.armR = { ...this.poses.ARM_R[state] };
                        } else {
                            // Dynamic Animation
                            this.activeAnimations.push({ limb: realLimb, type: state, timer: 0 });
                        }
                    }
                });
            }
        });
    }

    update(deltaTime) {
        if (!this.vrm) return;
        this.time += deltaTime;
        const humanoid = this.vrm.humanoid;

        // IDLE NOISE
        const breath = Math.sin(this.time * 1.0);
        let spineX = this.targets.spine.x + (breath * 0.02);
        let spineY = this.targets.spine.y + (Math.sin(this.time * 0.5) * 0.03);
        let armR_Z = this.targets.armR.z;
        let armR_X = this.targets.armR.x;
        let headX = this.targets.head.x;

        // ANIMATIONS
        this.activeAnimations.forEach(anim => {
            anim.timer += deltaTime;
            if (anim.type === 'WAVE') {
                armR_Z = -2.5; 
                armR_X = Math.sin(this.time * 15) * 0.5; 
            }
            if (anim.type === 'NOD') {
                headX = Math.sin(this.time * 20) * 0.2; 
            }
        });

        // APPLY
        const speed = 4.0 * deltaTime; 
        const apply = (boneName, tx, ty, tz) => {
            const bone = humanoid.getNormalizedBoneNode(boneName);
            if (!bone) return;
            bone.rotation.x += (tx - bone.rotation.x) * speed;
            bone.rotation.y += (ty - bone.rotation.y) * speed;
            bone.rotation.z += (tz - bone.rotation.z) * speed;
        };

        apply('spine', spineX, spineY, this.targets.spine.z);
        apply('head', headX, this.targets.head.y, this.targets.head.z);
        apply('leftUpperArm', this.targets.armL.x, this.targets.armL.y, this.targets.armL.z);
        apply('rightUpperArm', armR_X, this.targets.armR.y, armR_Z);
    }
    
    // Legacy support
    setMood(m) { this.mood = m; } 
    triggerGesture(name) { this.applyKineticCommand(name === 'WAVE' ? 'ARM_R=WAVE' : 'HEAD=NOD'); }
}