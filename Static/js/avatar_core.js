/* --- FILE: static/js/avatar_core.js --- */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { MotionEngine } from './motion_core.js'; 

export class AiboAvatar {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.vrm = null;
        this.lookAtTarget = new THREE.Object3D();
        this.scene.add(this.lookAtTarget);
        this.motion = new MotionEngine(); 

        this.blinkTimer = 0;
        this.nextBlinkTime = 3.0;
        this.isBlinking = false;
    }

    load(url, onLoaded) {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        loader.load(url, (gltf) => {
            const vrm = gltf.userData.vrm;
            VRMUtils.rotateVRM0(vrm);
            vrm.scene.rotation.y = Math.PI; 
            this.scene.add(vrm.scene);
            this.vrm = vrm;
            this.motion.setVRM(vrm);
            
            // Set initial LookAt
            this.lookAtTarget.position.y = 1.0; 
            vrm.lookAt.target = this.lookAtTarget;
            
            console.log("AIBO Core: Body Online");
            if (onLoaded) onLoaded();
        });
    }

    update(deltaTime) {
        if (!this.vrm) return;
        this.vrm.update(deltaTime);
        this.motion.update(deltaTime);
        
        // EYE TRACKING: Follow the user's manual camera
        this.lookAtTarget.position.copy(this.camera.position);

        this.updateBlink(deltaTime);
    }

    updateBlink(deltaTime) {
        if (!this.vrm.expressionManager) return;
        this.blinkTimer += deltaTime;
        if (this.blinkTimer >= this.nextBlinkTime && !this.isBlinking) {
            this.isBlinking = true;
            this.blinkTimer = 0;
            this.nextBlinkTime = 2 + Math.random() * 4; 
        }
        if (this.isBlinking) {
            const blinkDuration = 0.2; 
            const phase = Math.sin((this.blinkTimer / blinkDuration) * Math.PI);
            this.vrm.expressionManager.setValue('blink', Math.max(0, phase));
            this.vrm.expressionManager.update();
            if (this.blinkTimer >= blinkDuration) {
                this.isBlinking = false;
                this.vrm.expressionManager.setValue('blink', 0);
                this.vrm.expressionManager.update();
                this.blinkTimer = 0;
            }
        }
    }

    setBodyPart(part, action) {
        this.motion.triggerSpecific(part, action);
    }

    setEmotion(tag) {
        if (!this.vrm || !this.vrm.expressionManager) return;
        
        const safeTag = tag ? tag.toUpperCase() : 'NEUTRAL';
        const map = {
            'HAPPY': 'happy', 'JOY': 'happy', 'FUN': 'fun',
            'SAD': 'sorrow', 'ANGRY': 'angry',
            'SURPRISED': 'surprised', 'SHOCK': 'surprised',
            'NEUTRAL': 'neutral'
        };
        const targetPreset = map[safeTag] || 'neutral';
        
        const allExpressions = ['happy', 'angry', 'sorrow', 'fun', 'surprised', 'neutral'];
        allExpressions.forEach((exp) => {
            this.vrm.expressionManager.setValue(exp, 0);
        });
        this.vrm.expressionManager.setValue(targetPreset, 1.0);
        this.vrm.expressionManager.update();

        this.motion.setMood(safeTag);
    }

    setMouthOpen(v) {
        if (this.vrm && this.vrm.expressionManager) {
            this.vrm.expressionManager.setValue('aa', v);
            this.vrm.expressionManager.update(); 
        }
    }
}