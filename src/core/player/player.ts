// Lecteur de grille : basse walking, comping et batterie, planifiés à l'avance
// (fenêtre de 150 ms) pour un tempo stable même si l'interface est chargée.
import { Chart, flatten, FlatChord } from '../chart/model';
import { Chord, QUALITIES, rootPc } from '../theory/chords';
import { mod, pcOf } from '../theory/notes';
import { audio, bass, chord, click, hat, ride, silence } from '../audio/engine';
import { voiceLead } from '../audio/voicing';

export interface PlayerOptions {
  tempo: number;
  bass: boolean;
  comp: boolean;
  drums: boolean;
  countIn: boolean;
}
export interface Position {
  chorus: number;
  bar: number;
  chord: number;
  beatInBar: number;
}

interface Ev {
  beat: number; // depuis le début du chorus
  run: (time: number, spb: number) => void;
}

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const SWING = 2 / 3;
const LOOKAHEAD = 0.15;

function bassPc(c: Chord) {
  return c.bass ? pcOf(c.bass) : rootPc(c);
}
/** Note de hauteur `pc` la plus proche de `near`, dans la tessiture lo..hi. */
function nearest(pc: number, near: number, lo = 31, hi = 52) {
  let best = -1;
  for (let m = lo; m <= hi; m++) if (mod(m, 12) === pc && (best < 0 || Math.abs(m - near) < Math.abs(best - near))) best = m;
  return best;
}
const chordTones = (c: Chord) => QUALITIES[c.quality].iv.filter((i) => i < 12).map((i) => mod(rootPc(c) + i, 12));

function walkingLine(c: FlatChord, nextC: Chord, prevNote: number, first: boolean): number[] {
  const tones = chordTones(c.chord);
  const third = tones[1];
  const fifth = tones[2] ?? tones[1];
  const root = first || Math.random() < 0.8 ? nearest(bassPc(c.chord), prevNote, 33, 48) : nearest(fifth, prevNote, 33, 48);
  const target = nearest(bassPc(nextC), root);
  const approach = () => {
    const opts = [target - 1, target + 1, target - 1, target + 1, target + 7 <= 52 ? target + 7 : target - 5];
    return rnd(opts);
  };
  if (c.beats >= 4) {
    const p = rnd([0, 1, 2]);
    if (p === 0) return [root, nearest(third, root + 3), nearest(fifth, root + 7), approach()];
    if (p === 1) return [root, nearest(fifth, root + 7), nearest(third, root + 4), approach()];
    const step = nearest(mod(bassPc(c.chord) + 2, 12), root + 2);
    return [root, step, nearest(third, step + 2), approach()];
  }
  if (c.beats === 3) return [root, nearest(fifth, root + 7), approach()];
  if (c.beats === 2) return [root, approach()];
  return [root];
}

export class ChartPlayer {
  private chords: FlatChord[];
  private chorusBeats: number;
  private events: Ev[] = [];
  private evIdx = 0;
  private chorus = 0;
  private anchorTime = 0; // temps audio du début du chorus 0
  private timer: number | null = null;
  private raf: number | null = null;
  private positions: { time: number; pos: Position }[] = [];
  private prevBass = 40;
  private prevVoicing: number[] | null = null;
  playing = false;

  constructor(
    private chart: Chart,
    public opts: PlayerOptions,
    private onPosition: (p: Position | null) => void
  ) {
    this.chords = flatten(chart);
    this.chorusBeats = this.chords.reduce((s, c) => s + c.beats, 0);
  }

  private get spb() {
    return 60 / this.opts.tempo;
  }

  start(fromBar = 0) {
    const a = audio();
    this.stop();
    if (this.chorusBeats <= 0) return;
    this.playing = true;
    this.chorus = 0;
    this.prevVoicing = null;
    const startBeat = this.chords.find((c) => c.bar === fromBar)?.start ?? 0;
    const t0 = a.currentTime + 0.1;
    const count = this.opts.countIn ? this.chart.beatsPerBar : 0;
    for (let i = 0; i < count; i++) click(t0 + i * this.spb, i === 0);
    this.anchorTime = t0 + count * this.spb - startBeat * this.spb;
    this.buildChorus();
    this.evIdx = this.events.findIndex((e) => e.beat >= startBeat - 1e-6);
    if (this.evIdx < 0) this.evIdx = 0;
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
    const a = audio();
    const t = a.currentTime;
    const beatNow = (t - this.anchorTime) / this.spb;
    this.opts.tempo = bpm;
    this.anchorTime = t - beatNow * this.spb;
  }

  private chorusStart() {
    return this.anchorTime + this.chorus * this.chorusBeats * this.spb;
  }

  private tick() {
    const a = audio();
    const horizon = a.currentTime + LOOKAHEAD;
    for (;;) {
      if (this.evIdx >= this.events.length) {
        this.chorus++;
        this.buildChorus();
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
      if (late > 0.05) {
        this.evIdx++;
        continue;
      }
      ev.run(time, this.spb);
      this.evIdx++;
    }
  }

  private buildChorus() {
    const ev: Ev[] = [];
    const { chords, chart } = this;
    const bossa = chart.style === 'bossa';
    const sw = bossa ? 0.5 : SWING;
    const chorusIdx = this.chorus;

    chords.forEach((c, i) => {
      const nextC = chords[(i + 1) % chords.length].chord;
      // Position (pour l'interface)
      for (let b = 0; b < c.beats; b++) {
        const beat = c.start + b;
        const pos: Position = { chorus: chorusIdx, bar: c.bar, chord: c.index, beatInBar: (beat % chart.beatsPerBar) + 0 };
        ev.push({ beat, run: (time) => this.positions.push({ time, pos }) });
      }
      // Basse
      if (this.opts.bass) {
        if (bossa) {
          const root = nearest(bassPc(c.chord), this.prevBass, 33, 48);
          const fifth = nearest(mod(bassPc(c.chord) + 7, 12), root + 7, 33, 52);
          const pattern: [number, number, number][] = c.beats >= 4
            ? [[0, root, 1.4], [1.5, fifth, 0.45], [2, fifth, 1.4], [3.5, root, 0.45]]
            : [[0, root, 1.4], [1.5, fifth, 0.45]];
          pattern.forEach(([o, m, d]) => ev.push({ beat: c.start + o, run: (t, spb) => bass(m, t, d * spb, 0.75) }));
          this.prevBass = root;
        } else {
          const line = walkingLine(c, nextC, this.prevBass, i === 0);
          this.prevBass = line[line.length - 1];
          line.forEach((m, k) => ev.push({ beat: c.start + k, run: (t, spb) => bass(m, t, spb * 0.92, k === 0 ? 0.85 : 0.72) }));
        }
      }
      // Comping
      if (this.opts.comp) {
        const v = voiceLead(c.chord, this.prevVoicing);
        this.prevVoicing = v;
        let hits: [number, number][];
        if (bossa) {
          hits = c.beats >= 4 ? rnd<[number, number][]>([[[0, 1], [1.5, 0.8], [3, 0.8]], [[0, 1.4], [2.5, 1.2]], [[0.5, 1], [2, 1], [3.5, 0.5]]]) : [[0, 1], [1.5, 0.4]];
        } else if (c.beats >= 4) {
          hits = rnd<[number, number][]>([
            [[0, 0.9], [1 + sw, 1.3]], // Charleston
            [[1, 0.7], [3, 0.7]],
            [[0, 1.8], [2 + sw, 0.9]],
            [[1 + sw, 1.8]],
            [[0, 0.5], [2, 0.9], [3 + sw, 0.4]]
          ]);
        } else if (c.beats >= 2) {
          hits = rnd<[number, number][]>([[[0, 0.9]], [[sw, 1.1]], [[0, 0.5], [1 + sw, 0.4]]]);
        } else hits = [[0, 0.8]];
        hits.forEach(([o, d]) => {
          const vel = 0.42 + Math.random() * 0.14;
          ev.push({ beat: c.start + o, run: (t, spb) => chord(v, t, d * spb, vel, 0.008) });
        });
      }
    });
    // Batterie
    if (this.opts.drums) {
      for (let b = 0; b < this.chorusBeats; b++) {
        const inBar = b % chart.beatsPerBar;
        if (bossa) {
          ev.push({ beat: b, run: (t) => hat(t, 0.16) });
          ev.push({ beat: b + 0.5, run: (t) => hat(t, 0.1) });
        } else {
          ev.push({ beat: b, run: (t) => ride(t, inBar % 2 === 1 ? 0.22 : 0.17) });
          if (inBar % 2 === 1) {
            ev.push({ beat: b, run: (t) => hat(t, 0.28) });
            ev.push({ beat: b + sw, run: (t) => ride(t, 0.1) });
          }
        }
      }
    }
    ev.sort((x, y) => x.beat - y.beat);
    this.events = ev;
  }
}
