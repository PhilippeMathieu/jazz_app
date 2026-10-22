// Transforme une suite de mesures (toutes les ~60 ms) en événements « nouvelle note ».
import { PitchResult } from './detect';

export interface NoteEvent {
  midi: number;
  /** Instant de la mesure qui a confirmé la note (ms). */
  t: number;
}

export class NoteTracker {
  private candidate: number | null = null;
  private count = 0;
  private current: number | null = null;
  private lastLevel = 0;
  private silent = 0;

  constructor(
    public gate = 0.006,
    private minClarity = 0.85,
    private stableFrames = 2
  ) {}

  /** Renvoie un événement quand une nouvelle note est confirmée. */
  push(pitch: PitchResult | null, level: number, t: number, gate = this.gate): NoteEvent | null {
    const attack = level > this.lastLevel * 1.8 && level > gate * 2;
    this.lastLevel = level;
    if (level < gate || !pitch || pitch.clarity < this.minClarity || Math.abs(pitch.midi - Math.round(pitch.midi)) > 0.4) {
      this.candidate = null;
      this.count = 0;
      if (level < gate && ++this.silent >= 2) this.current = null;
      return null;
    }
    this.silent = 0;
    const m = Math.round(pitch.midi);
    // Même note rejouée : une attaque nette la compte comme nouvelle.
    if (attack && m === this.current) this.current = null;
    if (m === this.candidate) this.count++;
    else {
      this.candidate = m;
      this.count = 1;
    }
    if (this.count >= this.stableFrames && m !== this.current) {
      this.current = m;
      return { midi: m, t };
    }
    return null;
  }

  reset() {
    this.candidate = null;
    this.count = 0;
    this.current = null;
  }
}
