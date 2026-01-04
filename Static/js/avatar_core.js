/* --- FILE: static/js/avatar_core.js --- */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { MotionEngine } from './motion_core.js'; // Import our new brain

export class AiboAvatar {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.vrm = null;
        
        // "LookAt" target for the eyes (separate from head movement)
        this.lookAtTarget = new THREE.Object3D();
        this.scene.add(this.lookAtTarget);
        
        // Initialize the Motion Engine
        this.motion = new MotionEngine(); 
    }

    load(url, onLoaded) {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        loader.load(url, (gltf) => {
            const vrm = gltf.userData.vrm;
            
            // Fix standard VRM rotation (they often face backwards by default)
            VRMUtils.rotateVRM0(vrm);
            vrm.scene.rotation.y = Math.PI; 
            
            this.scene.add(vrm.scene);
            this.vrm = vrm;
            
            // Connect the Body to the Motion Engine
            this.motion.setVRM(vrm);

            // Setup Eye Tracking
            vrm.lookAt.target = this.lookAtTarget;
            
            console.log("AIBO Core: Body Online & Motion Engine Connected");
            if (onLoaded) onLoaded();
        });
    }

    update(deltaTime) {
        if (!this.vrm) return;
        
        // 1. Update standard VRM physics (hair/clothes)
        this.vrm.update(deltaTime);
        
        // 2. Update our Motion Engine (breathing/gestures)
        this.motion.update(deltaTime);
        
        // 3. Update Eye Tracking position
        this.lookAtTarget.position.copy(this.camera.position);
    }

    // This is called by the Chat System (studio_main.js)
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
        
        console.log(`AIBO Core: Emotion set to ${targetPreset}`);

        // 1. Reset all facial expressions
        const allExpressions = ['happy', 'angry', 'sorrow', 'fun', 'surprised', 'neutral'];
        allExpressions.forEach((exp) => {
            this.vrm.expressionManager.setValue(exp, 0);
        });

        // 2. Set new facial expression
        this.vrm.expressionManager.setValue(targetPreset, 1.0);
        this.vrm.expressionManager.update();

        // 3. Tell Motion Engine to change posture
        this.motion.setMood(safeTag);

        // 4. Trigger specific physical gestures for strong emotions
        if (safeTag === 'HAPPY') this.motion.triggerGesture('WAVE');
        if (safeTag === 'SURPRISED') this.motion.triggerGesture('SHRUG');
        if (safeTag === 'SAD') this.motion.triggerGesture('THINK');
    }

    // Called by Speech Core for Lip Sync
    setMouthOpen(v) {
        if (this.vrm && this.vrm.expressionManager) {
            this.vrm.expressionManager.setValue('aa', v);
            this.vrm.expressionManager.update(); 
        }
    }
}