import { getChordNotes, semitoneToFreq, transposeChord } from './chords';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private intervalId: number | null = null;
  private step = 0;
  private isPlaying = false;
  private volume = 0.45;
  private muted = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  /** Audition a single chord with a warm guitar/electric-piano strum */
  public playChord(chordName: string) {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;
    const notes = getChordNotes(chordName);
    const now = ctx.currentTime;

    notes.forEach((semi, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.value = semitoneToFreq(semi - 12 + (idx > 2 ? 12 : 0));

      const start = now + idx * 0.035;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 1.25);
    });
  }

  private playBeatStep(chordName: string, beatInBar: number, beatDurationSec: number) {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;
    const now = ctx.currentTime;
    const notes = getChordNotes(chordName);

    // Warm pad / electric piano on beat 0 and 2
    if (beatInBar === 0 || beatInBar === 2) {
      notes.forEach((semi, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.value = semitoneToFreq(semi - (idx === 0 ? 12 : 0));

        const peak = beatInBar === 0 ? 0.11 : 0.06;
        const dur = beatDurationSec * 1.9;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + dur + 0.05);
      });
    }

    // Soft kick on 0 and 2, soft hi-hat tick on 1 and 3
    if (beatInBar === 0 || beatInBar === 2) {
      const kick = ctx.createOscillator();
      const kGain = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(110, now);
      kick.frequency.exponentialRampToValueAtTime(42, now + 0.12);
      kGain.gain.setValueAtTime(0.18, now);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      kick.connect(kGain);
      kGain.connect(this.masterGain);
      kick.start(now);
      kick.stop(now + 0.18);
    } else {
      const hat = ctx.createOscillator();
      const hGain = ctx.createGain();
      hat.type = 'triangle';
      hat.frequency.setValueAtTime(1800, now);
      hGain.gain.setValueAtTime(0.025, now);
      hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      hat.connect(hGain);
      hGain.connect(this.masterGain);
      hat.start(now);
      hat.stop(now + 0.05);
    }
  }

  public startLoop(progression: string[], bpm: number, transposeSemitones: number, speed = 1) {
    this.stopLoop();
    this.ensureContext();
    this.isPlaying = true;
    const effectiveBpm = Math.max(40, bpm * speed);
    const beatMs = (60 / effectiveBpm) * 1000;
    const beatSec = beatMs / 1000;

    const tick = () => {
      if (!this.isPlaying) return;
      const barIdx = Math.floor(this.step / 4) % progression.length;
      const beatInBar = this.step % 4;
      const chord = transposeChord(progression[barIdx] || 'C', transposeSemitones);
      this.playBeatStep(chord, beatInBar, beatSec);
      this.step++;
    };

    tick();
    this.intervalId = window.setInterval(tick, beatMs);
  }

  public stopLoop() {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const audioEngine = new AudioEngine();
