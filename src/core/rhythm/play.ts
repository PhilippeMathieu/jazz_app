// Faire entendre un rythme (avec décompte et accompagnement) ou quelques mesures d'un style.
import { audio, bass, click, drum, now, playChord, silence } from '../audio/engine';
import { Chart, flatten, parseChart } from '../chart/model';
import { arrangeChorus, newArrangeState } from '../player/arrange';
import { improvPlan } from '../analysis/improv';
import { Feel, RPattern, swingRatio, tickToBeat } from './patterns';
import { GROOVES, StyleId } from './styles';

/** Cmaj7 sans fondamentale (E G B D), pour faire entendre les attaques. */
const STAB = [52, 55, 59, 62];

// Planification en flux (fenêtre de 150 ms) : on peut tout arrêter, même ce qui n'a pas encore sonné.
type Ev = { t: number; run: (t: number) => void };
let stopCurrent: (() => void) | null = null;

function schedule(evs: Ev[]): () => void {
  stopCurrent?.();
  evs.sort((a, b) => a.t - b.t);
  let i = 0;
  let id = 0;
  const tick = () => {
    const horizon = now() + 0.15;
    while (i < evs.length && evs[i].t <= horizon) {
      const e = evs[i++];
      if (e.t >= now() - 0.03) e.run(e.t);
    }
    if (i >= evs.length) clearInterval(id);
  };
  id = window.setInterval(tick, 25);
  tick();
  const stop = () => {
    clearInterval(id);
    silence();
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  return stop;
}

/** Arrête ce qui joue (rythme ou style). */
export const stopPlayback = () => stopCurrent?.();

export interface Take {
  /** Début de la première mesure du motif (horloge audio). */
  start: number;
  /** Instants des attaques à jouer. */
  targets: number[];
  /** Fin de la dernière mesure. */
  end: number;
  stop: () => void;
}

/** Métronome « jazz » d'une mesure : ride ternaire et charleston sur 2 et 4 ; ou shaker en croches droites. */
function backingBar(evs: Ev[], t: number, spb: number, feel: Feel, tempo: number) {
  const r = swingRatio(tempo);
  for (let b = 0; b < 4; b++) {
    const tb = t + b * spb;
    if (feel === 'swing') {
      evs.push({ t: tb, run: (x) => drum('ride', x, b % 2 ? 0.22 : 0.17) });
      if (b % 2) {
        evs.push({ t: tb, run: (x) => drum('hat', x, 0.26) });
        evs.push({ t: tb + r * spb, run: (x) => drum('ride', x, 0.1) });
      }
    } else {
      evs.push({ t: tb, run: (x) => (drum('shaker', x, 0.13), click(x, b === 0)) });
      evs.push({ t: tb + spb / 2, run: (x) => drum('shaker', x, 0.07) });
    }
  }
}

/**
 * Joue un motif : décompte d'une mesure, puis `reps` fois le motif sur l'accompagnement.
 * demo : on entend les attaques (accord, ou clave pour les rythmes latins) ; sinon c'est à l'élève de les jouer.
 */
export function playRhythm(p: RPattern, tempo: number, o: { reps: number; demo: boolean; feel: Feel; backing?: boolean }): Take {
  audio();
  const spb = 60 / tempo;
  const t0 = now() + 0.2;
  const evs: Ev[] = [];
  for (let i = 0; i < 4; i++) evs.push({ t: t0 + i * spb, run: (x) => click(x, i === 0) });
  const start = t0 + 4 * spb;
  const bars = p.bars * o.reps;
  const feel: Feel = p.straight ? 'straight' : o.feel;
  if (o.backing !== false) for (let b = 0; b < bars; b++) backingBar(evs, start + b * 4 * spb, spb, feel, tempo);
  const targets: number[] = [];
  for (let r = 0; r < o.reps; r++) {
    for (const h of p.hits) {
      const t = start + (r * p.bars * 4 + tickToBeat(h, feel, tempo, p)) * spb;
      targets.push(t);
      if (o.demo) {
        if (p.straight) evs.push({ t, run: (x) => drum('clave', x, 0.35) });
        else evs.push({ t, run: (x) => playChord(STAB, x, Math.min(0.45, spb * 0.6), 0.5, 0.004) });
      }
    }
  }
  const stop = schedule(evs);
  return { start, targets, end: start + bars * 4 * spb, stop };
}

/** Clics seuls (calibration, garder le tempo) : instants donnés, accentués ou non. */
export function playClicks(times: { t: number; accent?: boolean; sound?: 'click' | 'hat' }[]): () => void {
  audio();
  return schedule(times.map((c) => ({ t: c.t, run: (x) => (c.sound === 'hat' ? drum('hat', x, 0.4) : click(x, !!c.accent)) })));
}

/** Une petite grille par style, pour l'entendre (et la reconnaître). */
const DEMO: Record<StyleId, string> = {
  swing: '| Dm7 | G7 | Cmaj7 | A7 |',
  ballade: '| Cmaj7 | Am7 | Dm7 | G7 |',
  valse: 'beats: 3\n| Dm7 | G7 | Cmaj7 | Cmaj7 |',
  bossa: '| Dm7 | G7 | Cmaj7 | Cmaj7 |',
  samba: '| Dm7 | G7 | Cmaj7 | A7 |',
  latin: '| Cm7 | F7 | B♭maj7 | G7 |',
  funk: '| Dm7 | Dm7 | G7 | G7 |'
};

/** Joue `bars` mesures d'un style ; renvoie la fonction pour arrêter et la durée (s). */
export function playGroove(id: StyleId, bars = 4, tempo?: number): { stop: () => void; duration: number } {
  const g = GROOVES[id];
  const chart: Chart = { ...parseChart(`key: C\nstyle: ${id}\n${DEMO[id]}`, 'demo-' + id), style: id };
  const flat = flatten(chart);
  const scales = improvPlan(chart).scales.map((s) => s.scale);
  const bpm = tempo ?? g.defaultTempo;
  const spb = 60 / bpm;
  const chorusBeats = flat.reduce((s, f) => s + f.beats, 0);
  audio();
  const t0 = now() + 0.15;
  const state = newArrangeState();
  const reps = Math.max(1, Math.ceil((bars * chart.beatsPerBar) / chorusBeats));
  const evs: Ev[] = [];
  for (let r = 0; r < reps; r++) {
    const ev = arrangeChorus(chart, flat, scales, { bass: true, comp: true, drums: true, style: id }, state, Math.random);
    for (const e of ev) {
      const beat = r * chorusBeats + e.beat;
      if (beat >= bars * chart.beatsPerBar) continue;
      const t = t0 + beat * spb;
      if (e.kind === 'bass') evs.push({ t, run: (x) => bass(e.midi, x, e.dur * spb, e.vel) });
      else if (e.kind === 'chord') evs.push({ t, run: (x) => playChord(e.notes, x, e.dur * spb, e.vel, 0.008) });
      else if (e.kind === 'drum') evs.push({ t, run: (x) => drum(e.sound, x, e.vel) });
    }
  }
  return { stop: schedule(evs), duration: bars * chart.beatsPerBar * spb };
}
