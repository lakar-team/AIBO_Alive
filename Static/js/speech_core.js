export class AiboVoice {
    constructor(avatar) {
        this.avatar = avatar;
        this.recognition = null; 
        this.talkInterval = null;
        this.currentAudio = null; 

        this.initRecognition();
    }

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'en-US'; 
            this.recognition.interimResults = false;
        }
    }

    listen(onResult, onStart, onEnd) {
        if (!this.recognition) return;
        this.recognition.onstart = () => { if(onStart) onStart(); };
        this.recognition.onend = () => { if(onEnd) onEnd(); };
        this.recognition.onresult = (e) => {
            if(onResult) onResult(e.results[0][0].transcript);
        };
        try { this.recognition.start(); } catch (e) {}
    }

    // --- CONNECT TO HUGGING FACE SIDECAR ---
    async speak(text) {
        if (!text) return;
        this.stop(); 

        try {
            console.log("AIBO Voice: Calling Sidecar...");
            
            // THE NEW API ADDRESS
            const SIDECAR_URL = "https://lakarteam2025-aibo-voice-box.hf.space/tts";
            
            const response = await fetch(SIDECAR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) throw new Error("Sidecar Failed");

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            this.currentAudio = new Audio(audioUrl);

            // Lip Sync Setup
            this.currentAudio.onplay = () => this.startLipSync();
            this.currentAudio.onended = () => {
                this.stopLipSync();
                URL.revokeObjectURL(audioUrl); 
            };

            this.currentAudio.play();

        } catch (e) {
            console.error("Voice Error:", e);
            this.stopLipSync();
        }
    }

    startLipSync() {
        if (this.talkInterval) clearInterval(this.talkInterval);
        let time = 0;
        this.talkInterval = setInterval(() => {
            time += 0.2;
            const openAmount = (Math.sin(time * 20) + 1) / 2; 
            const jitter = Math.random() * 0.2;
            this.avatar.setMouthOpen((openAmount * 0.4) + jitter); 
        }, 50); 
    }

    stopLipSync() {
        if (this.talkInterval) clearInterval(this.talkInterval);
        this.avatar.setMouthOpen(0); 
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        if (this.recognition) try { this.recognition.stop(); } catch(e){}
        this.stopLipSync();
    }
}