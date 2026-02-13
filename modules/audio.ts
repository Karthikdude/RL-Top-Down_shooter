
export const SoundManager = {
    ctx: null as AudioContext | null,
    masterGain: null as GainNode | null,
    initialized: false,

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3; // Master volume
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported");
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // --- OSCILLATOR HELPERS ---

    playTone(freq: number, type: OscillatorType, duration: number, vol: number = 1, slideTo: number | null = null) {
        if (!this.ctx || !this.masterGain) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playNoise(duration: number, vol: number = 1) {
        if (!this.ctx || !this.masterGain) return;

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noise.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    },

    // --- GAME SFX ---

    shoot(isPlayer: boolean) {
        // High pitch pew for player, lower for bot
        const pitch = isPlayer ? 880 : 440;
        this.playTone(pitch, 'triangle', 0.1, 0.5, pitch / 2);
    },

    hit() {
        // Short noise burst
        this.playNoise(0.05, 0.4);
    },

    hitTower() {
        // Metallic clank
        this.playTone(200, 'square', 0.1, 0.4, 50);
    },

    die() {
        // Long descending slide
        this.playTone(400, 'sawtooth', 0.8, 0.6, 50);
        this.playNoise(0.5, 0.5);
    },

    respawn() {
        // Ascending slide
        this.playTone(100, 'sine', 1.0, 0.5, 600);
    },

    dash() {
        // Whoosh effect (filtered noise)
        if (!this.ctx || !this.masterGain) return;
        const duration = 0.3;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, this.ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(2000, this.ctx.currentTime + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    },

    shield() {
        this.playTone(300, 'sine', 0.5, 0.4, 300); // Pulse
    },

    gold() {
        // Coin ping
        this.playTone(1200, 'sine', 0.1, 0.3, 1200);
        setTimeout(() => this.playTone(1600, 'sine', 0.2, 0.3, 1600), 50);
    },

    victory() {
        this.playTone(440, 'square', 0.2, 0.5);
        setTimeout(() => this.playTone(554, 'square', 0.2, 0.5), 200);
        setTimeout(() => this.playTone(659, 'square', 0.4, 0.5), 400);
        setTimeout(() => this.playTone(880, 'square', 1.0, 0.5), 600);
    },

    defeat() {
        this.playTone(440, 'sawtooth', 0.3, 0.5);
        setTimeout(() => this.playTone(415, 'sawtooth', 0.3, 0.5), 300);
        setTimeout(() => this.playTone(392, 'sawtooth', 0.3, 0.5), 600);
        setTimeout(() => this.playTone(349, 'sawtooth', 1.0, 0.5), 900);
    }
};
