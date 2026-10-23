// Lecteur de grille : planifie l'arrangement sur l'horloge audio, avec une fenêtre d'avance
// de 150 ms pour un tempo stable même si l'interface est chargée.
import { Chart, FlatChord, flatten } from '../chart/model';
import { improvPlan } from '../analysis/improv';
import { audio, bass, click, drum, piano, playChord, silence } from '../audio/engine';
import { ArrEvent, arrangeChorus, newArrangeState } from './arrange';
import { BeatMap, MelNote } from '../melody/melody';

type PlayEvent = ArrEvent | { beat: number; kind: 'mel'; midi: number; dur: number; vel: number };

/** Décalage aléatoire de ± ms millisecondes. */
const human = (ms: number) => ((Math.random() * 2 - 1) * ms) / 1000;

export interface PlayerOptions {
  tempo: number;
  /** Style d'accompagnement (sinon celui de la grille). */
  style?: string;
  bass: boolean;
  comp: boolean;
  drums: boolean;
  countIn: boolean;
  /** Mélodie enregistrée par l'élève (déjà transposée), jouée si melodyOn. */
  melody?: MelNote[];
  melodyOn?: boolean;
}
export interface Position {
  chorus: number;
  bar: number;
  chord: number;
  beatInBar: number;
}

const LOOKAHEAD = 0.15;

export class ChartPlayer {
  private chords: FlatChord[];
  private scales: string[];
  private chorusBeats: number;
  private events: PlayEvent[] = [];
  private evIdx = 0;
  private chorus = 0;
  private anchorTime = 0; // temps audio du début du chorus 0
  private timer: number | null = null;
  private raf: number | null = null;
  private positions: { time: number; pos: Position }[] = [];
  private state = newArrangeState();
  playing = false;

  constructor(
    private chart: Chart,
    public opts: PlayerOptions,
    private onPosition: (p: Position | null) => void
  ) {
    this.chords = flatten(chart);
    this.scales = this.chords.length ? improvPlan(chart).scales.map((s) => s.scale) : [];
    this.chorusBeats = this.chords.reduce((s, c) => s + c.beats, 0);
  }

  private get spb() {
    return 60 / this.opts.tempo;
  }

  start(fromBar = 0) {
    this.stop();
    if (this.chorusBeats <= 0) return;
    const a = audio();
    this.playing = true;
    this.chorus = 0;
    this.state = newArrangeState();
    const startBeat = this.chords.find((c) => c.bar === fromBar)?.start ?? 0;
    const t0 = a.currentTime + 0.1;
    const count = this.opts.countIn ? this.chart.beatsPerBar : 0;
    for (let i = 0; i < count; i++) click(t0 + i * this.spb, i === 0);
    this.anchorTime = t0 + count * this.spb - startBeat * this.spb;
    this.build();
    this.evIdx = Math.max(0, this.events.findIndex((e) => e.beat >= startBeat - 1e-6));
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
    const loop = () => {
      const t = a.currentTime;
      let last: Position | null = null;
      while (this.positions.length && this.positions[0].time <= t) last = this.positions.shift()!.pos;
      if (last) this.onPosition(last);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.timer = this.raf = null;
    this.positions = [];
    if (this.playing) silence();
    this.playing = false;
    this.onPosition(null);
  }

  /** Change le tempo sans décrocher : on recale l'ancre sur le temps courant. */
  setTempo(bpm: number) {
    if (!this.playing) {
      this.opts.tempo = bpm;
      return;
    }
    const t = audio().currentTime;
    const beatNow = (t - this.anchorTime) / this.spb;
    this.opts.tempo = bpm;
    this.anchorTime = t - beatNow * this.spb;
  }

  private chorusStart() {
    return this.anchorTime + this.chorus * this.chorusBeats * this.spb;
  }

  private build() {
    const arr: PlayEvent[] = arrangeChorus(this.chart, this.chords, this.scales, this.opts, this.state, Math.random);
    const mel: PlayEvent[] = this.opts.melodyOn && this.opts.melody ? this.opts.melody.filter((n) => n.b < this.chorusBeats).map((n) => ({ beat: n.b, kind: 'mel', midi: n.m, dur: n.d, vel: 0.72 })) : [];
    this.events = mel.length ? [...arr, ...mel].sort((a, b) => a.beat - b.beat) : arr;
  }

  /** Correspondance horloge audio → temps de la grille (premier passage), pendant la lecture. */
  beatMap(): BeatMap | null {
    return this.playing ? { anchor: this.anchorTime, spb: this.spb } : null;
  }
  /** Temps de la grille où commence une mesure ; longueur de la grille en temps. */
  beatOfBar(bar: number) {
    return this.chords.find((c) => c.bar === bar)?.start ?? 0;
  }
  get length() {
    return this.chorusBeats;
  }

  private tick() {
    const a = audio();
    const horizon = a.currentTime + LOOKAHEAD;
    for (;;) {
      if (this.evIdx >= this.events.length) {
        this.chorus++;
        this.build();
        this.evIdx = 0;
      }
      const ev = this.events[this.evIdx];
      const time = this.chorusStart() + ev.beat * this.spb;
      if (time > horizon) break;
      const late = a.currentTime - time;
      if (late > 0.5) {
        // Minuterie suspendue (appli en arrière-plan) : on reprend là où on en était au lieu de tout jouer d'un coup.
        this.anchorTime += late + 0.05;
        continue;
      }
      this.evIdx++;
      if (late > 0.05) continue;
      this.run(ev, time);
    }
  }

  private run(ev: PlayEvent, time: number) {
    const spb = this.spb;
    switch (ev.kind) {
      case 'pos':
        this.positions.push({ time, pos: { chorus: this.chorus, bar: ev.bar, chord: ev.chord, beatInBar: ev.beatInBar } });
        break;
      // Un peu de jeu humain : quelques millisecondes et quelques pourcents de nuance, jamais deux fois pareil.
      case 'bass':
        bass(ev.midi, time + human(4), ev.dur * spb, ev.vel * (0.95 + Math.random() * 0.1));
        break;
      case 'chord':
        playChord(ev.notes, time + human(7), ev.dur * spb, ev.vel * (0.92 + Math.random() * 0.16), 0.006 + Math.random() * 0.008);
        break;
      case 'drum':
        drum(ev.sound, time + human(3), ev.vel * (0.9 + Math.random() * 0.2));
        break;
      case 'mel':
        piano(ev.midi, time, Math.max(0.12, ev.dur * spb * 0.95), ev.vel);
        break;
    }
  }
}
