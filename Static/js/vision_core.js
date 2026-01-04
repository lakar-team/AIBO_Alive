export class AiboVision {
    constructor() {
        // Create a hidden video element to act as the "retina"
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.videoElement.style.display = 'none'; 
        document.body.appendChild(this.videoElement);
        
        this.activeStream = null;
        this.mode = 'none'; // 'webcam', 'screen', or 'none'
    }

    async startWebcam() {
        this.stop(); // Stop any existing stream
        try {
            this.activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.videoElement.srcObject = this.activeStream;
            this.mode = 'webcam';
            console.log("AIBO Vision: Webcam Online");
            return true;
        } catch (e) {
            console.error("Webcam Error:", e);
            alert("Could not access webcam. Check permissions.");
            return false;
        }
    }

    async startScreen() {
        this.stop();
        try {
            this.activeStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            this.videoElement.srcObject = this.activeStream;
            this.mode = 'screen';
            console.log("AIBO Vision: Screen Share Online");
            return true;
        } catch (e) {
            console.error("Screen Share Error:", e);
            return false;
        }
    }

    stop() {
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(track => track.stop());
            this.activeStream = null;
        }
        this.videoElement.srcObject = null;
        this.mode = 'none';
    }

    // Snaps a picture of what the eye sees right now
    captureFrame() {
        if (this.mode === 'none' || !this.activeStream) return null;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        
        // Return Base64 JPEG string
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    isActive() {
        return this.mode !== 'none';
    }
}