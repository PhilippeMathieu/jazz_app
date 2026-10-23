// La mélodie d'un morceau, jouée une fois au piano par l'élève et retenue par l'appli.
// Pas de mélodie fournie avec les morceaux (protégées) : chacun enregistre la sienne, elle reste sur l'appareil.
import { load, save } from '../storage';

/** Une note de la mélodie : début et durée en temps depuis le début de la grille, hauteur MIDI dans la tonalité d'origine. */
export interface MelNote {
  b: number;
  d: number;
  m: number;
}

/** Une mesure du micro : instant (s, horloge audio, fin de la fenêtre), hauteur détectée, fiabilité, niveau. */
export interface Frame {
  t: number;
  midi: number | null;
  clarity: number;
  level: number;
}
/** Une note entendue : début, fin (s), hauteur. */
export interface Heard {
  t: number;
  end: number;
  midi: number;
}

export interface TranscribeOptions {
  /** Tessiture retenue (la basse de l'accompagnement, plus grave, est ignorée). */
  lo: number;
  hi: number;
  gate: number;
  minClarity: number;
  /** Retard de la détection de hauteur sur l'attaque, quand aucune attaque n'est repérée (s). */
  lag: number;
}
const DEFAULTS: TranscribeOptions = { lo: 55, hi: 96, gate: 0, minClarity: 0.85, lag: 0.06 };

/**
 * Des mesures du micro aux notes jouées.
 * Une note = au moins 2 mesures de suite à la même hauteur ; même hauteur rejouée = le niveau remonte d'un coup.
 * Le début est pris sur l'attaque détectée juste avant (plus précise que la hauteur, qui arrive après).
 */
export function transcribe(frames: Frame[], onsets: number[], opts: Partial<TranscribeOptions> = {}): Heard[] {
  const o = { ...DEFAULTS, ...opts };
  const valid = (f: Frame) => f.midi !== null && f.level >= o.gate && f.clarity >= o.minClarity && Math.abs(f.midi - Math.round(f.midi)) <= 0.4;
  // 1. Suites de mesures à la même hauteur.
  const runs: { start: number; end: number; midi: number; n: number }[] = [];
  let cur: (typeof runs)[number] | null = null;
  let gap = 0;
  const rounded = (f: Frame | undefined) => (f && valid(f) ? Math.round(f.midi!) : null);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const m = rounded(f);
    if (m === null) {
      // Une mesure ratée au milieu d'une note ne la coupe pas ; deux, si.
      if (cur && ++gap > 1) cur = null;
      continue;
    }
    // Une seule mesure à une autre hauteur (un coup de batterie, un harmonique) : un accroc, pas une note.
    if (cur && m !== cur.midi && rounded(frames[i + 1]) === cur.midi) {
      gap++;
      continue;
    }
    // Même hauteur rejouée : le niveau remonte d'un coup et reste haut à la mesure suivante (pas un coup de batterie).
    const before = frames[i - 1 - gap]?.level ?? 0;
    const after = frames[i + 1]?.level ?? f.level;
    const again = cur !== null && cur.n >= 2 && f.level > before * 1.8 && f.level > o.gate * 2 && after > before * 1.3;
    if (cur && cur.midi === m && !again) {
      cur.end = f.t;
      cur.n++;
    } else {
      cur = { start: f.t, end: f.t, midi: m, n: 1 };
      runs.push(cur);
    }
    gap = 0;
  }
  // 2. Notes : au moins 2 mesures, dans la tessiture ; début sur l'attaque la plus proche avant.
  const sorted = [...onsets].sort((a, b) => a - b);
  const notes: Heard[] = [];
  for (const r of runs) {
    if (r.n < 2 || r.midi < o.lo || r.midi > o.hi) continue;
    const prev = notes[notes.length - 1];
    let on = -1;
    for (const t of sorted) if (t >= r.start - 0.2 && t <= r.start + 0.01 && (!prev || t > prev.t + 0.05)) on = t;
    const t = on >= 0 ? on : r.start - o.lag;
    if (prev && prev.end > t) prev.end = Math.max(prev.t + 0.05, t);
    notes.push({ t, end: r.end + 0.03, midi: r.midi });
  }
  return notes;
}

/** Correspondance horloge audio → temps de la grille, figée au début de l'enregistrement. */
export interface BeatMap {
  /** Instant du temps 0 de la grille (s). */
  anchor: number;
  /** Durée d'un temps (s). */
  spb: number;
}

const GRID = 12;
const q = (x: number) => Math.round(x * GRID) / GRID;

/**
 * Notes entendues → notes de la mélodie : temps de la grille (au 1/12 de temps : doubles croches et triolets),
 * retard du micro retranché, ramenées dans la tonalité d'origine. Seules les notes de [from, to[ sont gardées.
 */
export function toMelody(heard: Heard[], map: BeatMap, o: { latency: number; shift: number; from: number; to: number }): MelNote[] {
  const out: MelNote[] = [];
  for (const h of heard) {
    const raw = (h.t - o.latency - map.anchor) / map.spb;
    if (raw < o.from - 0.25 || raw >= o.to) continue;
    const b = Math.max(o.from, q(raw));
    const d = Math.min(8, Math.max(0.25, q((h.end - h.t) / map.spb)));
    out.push({ b, d, m: h.midi - o.shift });
  }
  // Deux notes sur le même 1/12 : la seconde gagne (la première était un accroc).
  return out.filter((n, i) => !out.slice(i + 1).some((x) => x.b === n.b));
}

/** Remplace la partie [from, to[ d'une mélodie par une nouvelle prise (on peut enregistrer section par section). */
export function replaceRange(old: MelNote[], fresh: MelNote[], from: number, to: number): MelNote[] {
  return [...old.filter((n) => n.b < from || n.b >= to), ...fresh].sort((a, b) => a.b - b.b);
}

/** Mélodie transposée (demi-tons), pour le lecteur. */
export const shiftMelody = (m: MelNote[], shift: number): MelNote[] => (shift ? m.map((n) => ({ ...n, m: n.m + shift })) : m);

// ---------------------------------------------------------------- Stockage (sur l'appareil)

type Store = Record<string, MelNote[]>;
const isNote = (n: unknown): n is MelNote => !!n && typeof (n as MelNote).b === 'number' && typeof (n as MelNote).d === 'number' && typeof (n as MelNote).m === 'number';

export function melodyOf(chartId: string): MelNote[] {
  const v = load<Store>('melodies', {})[chartId];
  return Array.isArray(v) ? v.filter(isNote) : [];
}
export function saveMelody(chartId: string, notes: MelNote[]) {
  const all = load<Store>('melodies', {});
  if (notes.length) all[chartId] = notes;
  else delete all[chartId];
  save('melodies', all);
}
