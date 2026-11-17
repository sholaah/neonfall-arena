// Synthesised sound for Neonfall Arena: no audio files, only oscillators.
//
// Every effect is a short envelope on an oscillator or a burst of filtered noise, made the
// moment it is needed. A tiny two-oscillator bass loop runs under play. The context is
// created lazily on the first user gesture (browsers refuse audio before one), and the
// mute choice is kept in localStorage so it survives a restart.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = localStorage.getItem('neonfall-muted') === '1';
    this.musicTimer = null;
    this.step = 0;
  }

  /** Create the context on first use; safe to call from any gesture handler. */
  unlock() {
    if (this.ctx !== null) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC === undefined) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('neonfall-muted', muted ? '1' : '0');
    if (this.master !== null) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** One enveloped tone: frequency glides from f0 to f1 over the duration. */
  tone(f0, f1, seconds, type, volume, when = 0) {
    if (this.ctx === null || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  /** A short burst of white noise through a band-pass, for impacts and explosions. */
  noise(seconds, frequency, volume, when = 0) {
    if (this.ctx === null || this.muted) return;
    const t = this.ctx.currentTime + when;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  shoot() { this.tone(880, 220, 0.09, 'square', 0.10); }
  enemyShoot() { this.tone(300, 140, 0.14, 'sawtooth', 0.07); }
  hit() { this.noise(0.06, 2400, 0.10); }
  explode(big) {
    this.noise(big ? 0.5 : 0.25, big ? 300 : 700, big ? 0.5 : 0.28);
    this.tone(big ? 160 : 220, 40, big ? 0.45 : 0.25, 'triangle', 0.4);
  }
  dash() { this.noise(0.18, 1200, 0.16); this.tone(240, 720, 0.16, 'sine', 0.12); }
  hurt() { this.tone(320, 60, 0.35, 'sawtooth', 0.35); this.noise(0.3, 500, 0.3); }
  pickup() { this.tone(520, 1040, 0.12, 'sine', 0.2); this.tone(780, 1560, 0.14, 'sine', 0.16, 0.07); }
  waveStart() { this.tone(392, 392, 0.12, 'square', 0.14); this.tone(587, 587, 0.16, 'square', 0.14, 0.11); }
  gameOver() {
    this.tone(392, 392, 0.25, 'triangle', 0.25);
    this.tone(311, 311, 0.25, 'triangle', 0.25, 0.22);
    this.tone(262, 130, 0.6, 'triangle', 0.28, 0.44);
  }
  click() { this.tone(660, 660, 0.05, 'square', 0.10); }

  /** Start the bass loop: a four-bar minor pattern, one note every eighth at 112 BPM. */
  startMusic() {
    if (this.ctx === null || this.musicTimer !== null) return;
    const bass = [55, 0, 55, 55, 0, 65.4, 0, 55, 49, 0, 49, 49, 0, 58.3, 0, 73.4];
    const eighth = 60 / 112 / 2;
    this.musicTimer = window.setInterval(() => {
      if (this.muted) return;
      const note = bass[this.step % bass.length];
      this.step++;
      if (note === 0) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note * 2;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + eighth * 0.95);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + eighth);
    }, eighth * 1000);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
