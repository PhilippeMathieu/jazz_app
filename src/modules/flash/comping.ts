// Comping : jouer les voicings en rythme sur la grille ; le micro mesure le placement ET le contenu de chaque accord.
// Sans interface, testable.
import { Chord, chordSymbol, rootPc } from '../../core/theory/chords';
import { keyFor, spellProgression } from '../../core/theory/progressions';
import { mod } from '../../core/theory/notes';
import { lhVoicing, twoHands } from '../../core/audio/voicing';
import { TPB, swingRatio } from '../../core/rhythm/patterns';
import { scoreTiming } from '../../core/rhythm/timing';
import { checkChord } from '../../core/listen/detect';
import { Rng, pick } from '../../core/random';

const BAR = 4 * TPB;
/** Attaque d'un motif : position (ticks dans la mesure) et accord visé (0 : celui de la mesure, 1 : le suivant, anticipé). */
type Hit = [number, 0 | 1];
export interface CompPattern {
  name: string;
  hits: Hit[];
}
const P = (name: string, ...hits: Hit[]): CompPattern => ({ name, hits });
const HALF = P('1 et 3', [0, 0], [24, 0]);
const CHARLESTON = P('Charleston', [0, 0], [18, 0]);
const OFFBEATS = P('« Et » de 2 et de 4', [18, 0], [42, 0]);
const ANTICIP = P('Anticipation', [18, 0], [42, 1]);
const ANTICIP1 = P('1, puis anticipation', [0, 0], [42, 1]);
const SPARSE = P('« Et » de 1, puis 4', [6, 0], [36, 0]);
const BEAT2 = P('2, puis « et » de 3', [12, 0], [30, 0]);

export const COMP_LEVELS: { name: string; desc: string; patterns: CompPattern[] }[] = [
  { name: 'Blanches', desc: 'Sur le 1 et le 3 : le temps de placer chaque voicing', patterns: [HALF] },
  { name: 'Charleston', desc: 'Le 1, puis le « et » de 2 : le rythme de comping le plus joué', patterns: [CHARLESTON] },
  { name: 'Contretemps', desc: 'Le « et » de 2 et le « et » de 4, sans jouer le 1', patterns: [OFFBEATS] },
  { name: 'Anticipations', desc: 'L’accord suivant arrive une croche en avance, sur le « et » de 4', patterns: [ANTICIP, ANTICIP1] },
  { name: 'Varié', desc: 'Un motif différent toutes les 2 mesures, comme un vrai accompagnateur', patterns: [CHARLESTON, OFFBEATS, ANTICIP, ANTICIP1, SPARSE, BEAT2] }
];

export type CompVoicing = 'shell' | 'AB' | 'spread';
export const COMP_VOICING_LABEL: Record<CompVoicing, { name: string; sub: string }> = {
  shell: { name: 'Shell', sub: '1-3-7, main gauche' },
  AB: { name: 'A et B', sub: 'Sans fondamentale' },
  spread: { name: 'Deux mains', sub: 'MG 1-7, MD 3-5-9' }
};

export interface CompHit {
  /** Ticks depuis le début de la grille. */
  tick: number;
  bar: number;
  /** Accord joué (indice dans chords). */
  chord: number;
}
export interface CompRound {
  chords: Chord[];
  /** Un voicing par accord, enchaîné au précédent. */
  voicings: number[][];
  hits: CompHit[];
  /** Motif de chaque mesure (pour l'affichage). */
  patterns: CompPattern[];
  bars: number;
}

/** 8 mesures : ii–V–I–I deux fois, dans la tonalité de tonique `tonic` (classe de hauteur). */
export function makeRound(level: number, voicing: CompVoicing, tonic: number, rng: Rng = Math.random): CompRound {
  const key = keyFor('iiVI', tonic);
  const [ii, V, I] = spellProgression(key, 'iiVI').map((x) => x.chord);
  const chords = [ii, V, I, I, ii, V, I, I];
  let prev: number[] | null = null;
  const voicings = chords.map((c, i) => {
    const v: number[] = voicing === 'spread' ? twoHands(c, 'spread', prev).notes : lhVoicing(c, voicing === 'shell' ? 'shell' : i % 2 ? 'B' : 'A', prev);
    prev = v;
    return v;
  });
  const lv = COMP_LEVELS[level] ?? COMP_LEVELS[0];
  const patterns: CompPattern[] = [];
  for (let b = 0; b < chords.length; b += 2) {
    const p = pick(lv.patterns, rng);
    patterns.push(p, p);
  }
  const hits: CompHit[] = [];
  patterns.forEach((p, bar) => {
    for (const [t, off] of p.hits) {
      const chord = bar + off;
      if (chord < chords.length) hits.push({ tick: bar * BAR + t, bar, chord });
    }
  });
  return { chords, voicings, hits, patterns, bars: chords.length };
}

/** Instant (en temps depuis le début) d'un tick, swing compris. */
export function tickBeat(tick: number, tempo: number): number {
  const beat = Math.floor(tick / TPB);
  const within = tick - beat * TPB;
  return beat + (within === 6 ? swingRatio(tempo) : within / TPB);
}

/** Ce que le micro a entendu à un instant (horloge audio) : chroma de la dernière fenêtre. */
export interface Snapshot {
  t: number;
  chroma: Float32Array;
  /** Chroma au retrait d'harmoniques adouci (présence des notes attendues). */
  soft: Float32Array;
}
export interface HitResult {
  /** Écart en ms (null : pas d'attaque entendue). */
  dev: number | null;
  /** Accord juste (null : rien d'exploitable entendu). */
  chordOk: boolean | null;
  missing: number[];
  extra: number[];
}
export interface CompResult {
  hits: HitResult[];
  timeOk: number;
  chordOk: number;
  bothOk: number;
  mean: number;
  extraHits: number;
}

/**
 * Évalue un passage. targets : instants visés (audio) ; onsets : attaques entendues ; snapshots : chromas relevés pendant le jeu.
 * La quinte (et, avec la contrebasse, la fondamentale) n'est pas exigée : le micro les confond avec la basse.
 */
export function evaluate(round: CompRound, targets: number[], onsets: number[], snapshots: Snapshot[], tolMs: number, offsetMs: number, withBass: boolean): CompResult {
  const timing = scoreTiming(targets, onsets, tolMs, offsetMs);
  const hits: HitResult[] = round.hits.map((h, i) => {
    const target = [...new Set(round.voicings[h.chord].map((m) => mod(m, 12)))];
    const r = rootPc(round.chords[h.chord]);
    const optional = withBass ? [mod(r + 7, 12), r] : [mod(r + 7, 12)];
    // La fenêtre d'analyse (≈ 0,37 s) doit couvrir surtout l'accord joué : de 0,2 à 0,55 s après la cible.
    const T = targets[i] + offsetMs / 1000;
    const near = snapshots.filter((s) => s.t >= T + 0.2 && s.t <= T + 0.55);
    let best: ReturnType<typeof checkChord> | null = null;
    for (const s of near) {
      const ck = checkChord(s.chroma, target, optional, s.soft);
      if (!best || (ck.ok && !best.ok) || (ck.ok === best.ok && ck.score > best.score)) best = ck;
    }
    return { dev: timing.matches[i].dev, chordOk: best ? best.ok : null, missing: best?.missing ?? [], extra: best?.extra ?? [] };
  });
  const inTime = (d: number | null) => d !== null && Math.abs(d) <= tolMs;
  return {
    hits,
    timeOk: hits.filter((h) => inTime(h.dev)).length,
    chordOk: hits.filter((h) => h.chordOk).length,
    bothOk: hits.filter((h) => inTime(h.dev) && h.chordOk).length,
    mean: timing.mean,
    extraHits: timing.extra
  };
}

export const roundSymbols = (r: CompRound) => r.chords.map(chordSymbol);
