/* --- FILE: static/js/speech_core.js --- */
export class AiboVoice {
    constructor(avatar) {
        this.avatar = avatar;
        this.recognition = null;
        
        // --- AUDIO SYSTEM ---
        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.audioElement = new Audio(); // Reusable player
        this.audioElement.crossOrigin = "anonymous"; // Essential for analysis
        
        // State
        this.isSpeaking = false;
        this.smoothVolume = 0; // For smooth jaw movement

        // Pre-load native voices
        window.speechSynthesis.onvoiceschanged = () => {
            console.log("AIBO Voice: Native voices loaded.");
        };

        this.initRecognition();
    }

    // --- 1. SETUP THE EARS (Audio Analysis) ---
    initAudioSystem() {
        if (this.audioCtx) return; // Already setup

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        // Create the analyser (The "Meter")
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256; // Resolution (smaller = faster)
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);

        // Connect HTML Audio -> Analyser -> Speakers
        this.source = this.audioCtx.createMediaElementSource(this.audioElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
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

    async speak(text, onPlayCallback) {
        if (!text) {
            if (onPlayCallback) onPlayCallback();
            return;
        }

        this.stop(); 
        
        // Initialize AudioContext on first user interaction (Browser Policy)
        if (!this.audioCtx) this.initAudioSystem();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        console.log("AIBO Voice: Requesting Neural Audio...");

        let localVoiceFailed = false;
        const fallbackTimer = setTimeout(() => {
            if (this.audioElement.paused) {
                console.warn("AIBO Voice: Generation took too long (>5s). Switching to Native.");
                localVoiceFailed = true;
                this.speakNative(text, onPlayCallback);
            }
        }, 5000); 

        try {
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voice: document.getElementById('voice-select')?.value || "en-US-AriaNeural",
                    pitch: (document.getElementById('pitch')?.value || "0") + "Hz",
                    rate: (document.getElementById('rate')?.value || "0") + "%"
                })
            });

            if (localVoiceFailed) return; 
            clearTimeout(fallbackTimer); 

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // Play via the Analyzer-connected element
            this.audioElement.src = data.url;
            
            this.audioElement.onplay = () => {
                this.isSpeaking = true;
                if(onPlayCallback) onPlayCallback();
                this.animateLipSync(); // START ANIMATION LOOP
            };
            
            this.audioElement.onended = () => {
                this.isSpeaking = false;
                this.avatar.setMouthOpen(0);
            };

            await this.audioElement.play();

        } catch (e) {
            if (!localVoiceFailed) {
                console.error("Local Voice Error:", e);
                clearTimeout(fallbackTimer);
                this.speakNative(text, onPlayCallback);
            }
        }
    }

    // --- 2. THE ANIMATION LOOP (REAL-TIME) ---
    animateLipSync() {
        if (!this.isSpeaking || !this.analyser) return;

        requestAnimationFrame(() => this.animateLipSync());

        // Get audio data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate average volume (Amplitude)
        let sum = 0;
        // We only check the lower frequencies where speech energy lives
        const binCount = this.analyser.frequencyBinCount;
        for (let i = 0; i < binCount; i++) {
            sum += this.dataArray[i];
        }
        const average = sum / binCount;

        // Map Volume (0-255) to Mouth Open (0.0 - 1.0)
        // Sensitivity: Adjust '100' to make mouth more/less sensitive
        let targetOpen = Math.min(1.0, average / 60); 

        // Noise Gate: Ignore very quiet sounds (breathing noise)
        if (targetOpen < 0.1) targetOpen = 0;

        // SMOOTHING (Linear Interpolation)
        // This makes the jaw drift to the target rather than snapping
        this.smoothVolume += (targetOpen - this.smoothVolume) * 0.3;

        this.avatar.setMouthOpen(this.smoothVolume);
    }

    speakNative(text, onPlayCallback) {
        console.log("AIBO Voice: Using Native Fallback");
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes("Zira") || v.name.includes("Google US English"));

        if (preferred) utterance.voice = preferred;
        utterance.rate = 1.0; 
        utterance.pitch = 1.1; 
        
        utterance.onstart = () => { 
            if (onPlayCallback) onPlayCallback(); 
            // Note: Native browser voices do NOT expose audio data for analysis.
            // We must fallback to the "Sine Wave" simulation for Native voices.
            this.simulateLipSync();
        };
        
        utterance.onend = () => { 
            this.isSpeaking = false;
            this.avatar.setMouthOpen(0);
        };
        
        window.speechSynthesis.speak(utterance);
    }

    simulateLipSync() {
        this.isSpeaking = true;
        const loop = () => {
            if (!this.isSpeaking) return;
            // Simple fake movement for fallback
            const time = Date.now() / 100;
            const open = (Math.sin(time) + 1) * 0.3;
            this.avatar.setMouthOpen(open);
            requestAnimationFrame(loop);
        };
        loop();
    }

    stop() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
        this.isSpeaking = false;
        window.speechSynthesis.cancel();
        if (this.recognition) try { this.recognition.stop(); } catch(e){}
        this.avatar.setMouthOpen(0);
    }
}