// Oreille, « Accord entier » : trouver la fondamentale ET la nature d'un accord, à partir d'une référence
// (l'accord de la tonique, ou la note do). Sans interface, testable.
import { Key, keyOnPc } from '../../core/chart/model';
import { Chord, QUALITIES, chordOnPc } from '../../core/theory/chords';
import { mod, noteName, pcOf, spellWith } from '../../core/theory/notes';
import { closeVoicing } from '../../core/audio/voicing';
import { Rng, pick, rndInt, shuffle, weightedPick } from '../../core/random';
import { Pair, confusionWeight } from '../../core/confusions';
import { earVoicing, Tally } from './questions';

export interface FullItem {
  /** Degré, sert aussi d'identifiant (« IIm7 »). */
  id: string;
  /** Demi-tons au-dessus de la tonique. */
  semis: number;
  /** Degré écrit (0 = I … 6 = VII), pour l'orthographe. */
  letter: number;
  quality: string;
  /** Rôle, pour les accords hors gamme (« V7/II »). */
  role?: string;
}
const I = (id: string, semis: number, letter: number, quality: string, role?: string): FullItem => ({ id, semis, letter, quality, role });
const TRIADS = [I('I', 0, 0, 'maj'), I('IIm', 2, 1, 'min'), I('IIIm', 4, 2, 'min'), I('IV', 5, 3, 'maj'), I('V', 7, 4, 'maj'), I('VIm', 9, 5, 'min')];
const SEVENTHS = [
  I('IΔ7', 0, 0, 'maj7'),
  I('IIm7', 2, 1, 'm7'),
  I('IIIm7', 4, 2, 'm7'),
  I('IVΔ7', 5, 3, 'maj7'),
  I('V7', 7, 4, '7'),
  I('VIm7', 9, 5, 'm7'),
  I('VIIø7', 11, 6, 'm7b5')
];
const BORROWED = [I('VI7', 9, 5, '7', 'V7/II'), I('II7', 2, 1, '7', 'V7/V'), I('III7', 4, 2, '7', 'V7/VI'), I('♭VII7', 10, 6, '7', 'backdoor'), I('IVm7', 5, 3, 'm7', 'emprunt au mineur')];

/** Niveaux 0 à 2 : dans une tonalité ; 3 et 4 : libres, après la note do. */
export const FULL_TONAL: FullItem[][] = [TRIADS, SEVENTHS, [...SEVENTHS, ...BORROWED]];
export const FULL_FREE: string[][] = [
  ['maj7', 'm7', '7'],
  ['maj7', 'm7', '7', 'm7b5', 'dim7']
];
export const FULL_LEVEL_LABELS = [
  'Débutant : accords de 3 sons de la gamme majeure (I, IIm… VIm), après l’accord de la tonique',
  'Accords de 4 sons de la gamme (IΔ7, IIm7… VIIø7), après la tonique',
  '+ dominantes secondaires et emprunts (VI7, II7, III7, ♭VII7, IVm7)',
  'Libre : n’importe quelle fondamentale, maj7 · m7 · 7, après la note do',
  'Libre : + ø7 et °7, après la note do'
];
const ALL_TONAL = [...TRIADS, ...SEVENTHS, ...BORROWED];
export const fullItemById = (id: string) => ALL_TONAL.find((x) => x.id === id);
/** Tonalités courantes (jusqu'à 3 altérations) pour les premiers niveaux. */
const COMMON = [0, 5, 7, 10, 2, 3, 9];

export interface FullAnswer {
  root: number;
  quality: string;
}
export interface FullQuestion {
  /** null : référence = la note do, pas de tonalité. */
  key: Key | null;
  item?: FullItem;
  chord: Chord;
  notes: number[];
  ref: number[];
  qualities: string[];
  /** Duel : deux réponses possibles seulement. */
  duel?: FullAnswer[];
}

const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Nom d'une classe de hauteur dans une tonalité : les notes de la gamme d'abord, sinon les noms usuels (bémols, ou dièses en tonalité à dièses). */
export function pcNameIn(pc: number, key: Key | null): string {
  const tonic = key ? key.tonic : { letter: 0, acc: 0 };
  const t = pcOf(tonic);
  const d = mod(pc - t, 12);
  const deg = [0, 2, 4, 5, 7, 9, 11].indexOf(d);
  if (deg >= 0) return noteName(spellWith(tonic.letter + deg, pc));
  const sharpKey = tonic.acc > 0 || (tonic.acc === 0 && [7, 2, 9, 4, 11].includes(t));
  return (sharpKey ? SHARPS : FLATS)[mod(pc, 12)];
}

const spelled = (key: Key, it: FullItem): Chord => {
  const pc = mod(pcOf(key.tonic) + it.semis, 12);
  return { ...chordOnPc(pc, it.quality), root: spellWith(key.tonic.letter + it.letter, pc) };
};

/** Référence : accord de la tonique (basse + triade), ou la note do. */
export function refNotes(key: Key | null): number[] {
  if (!key) return [60];
  const t = pcOf(key.tonic);
  const bass = 48 + mod(t - 0, 12) - (t >= 6 ? 12 : 0);
  return [bass, ...closeVoicing([t, mod(t + 4, 12), mod(t + 7, 12)], 60)];
}

export function makeFullQuestion(level: number, tally: Tally, pairs: Pair[], last?: string, rng: Rng = Math.random): FullQuestion {
  if (level >= FULL_TONAL.length) {
    const qualities = FULL_FREE[level - FULL_TONAL.length] ?? FULL_FREE[0];
    const q = weightedPick(qualities, (k) => 1 + 2 * (1 - ((tally['full:' + k]?.c ?? 0) + 1) / ((tally['full:' + k]?.t ?? 0) + 2)), rng);
    const chord = chordOnPc(rndInt(12, rng), q);
    return { key: null, chord, notes: earVoicing(chord, 1, rng), ref: refNotes(null), qualities };
  }
  const items = FULL_TONAL[level];
  const it = weightedPick(
    items,
    (x) => (1 + 2 * (1 - ((tally['full:' + x.id]?.c ?? 0) + 1) / ((tally['full:' + x.id]?.t ?? 0) + 2))) * confusionWeight(pairs, x.id) * (x.id === last ? 0.3 : 1),
    rng
  );
  const key = keyOnPc(level === 2 ? rndInt(12, rng) : pick(COMMON, rng), 'major');
  const chord = spelled(key, it);
  return { key, item: it, chord, notes: earVoicing(chord, 1, rng), ref: refNotes(key), qualities: [...new Set(items.map((x) => x.quality))] };
}

/** Duel : deux degrés que l'élève confond, dans une tonalité courante. */
export function makeFullDuel(pairs: Pair[], last?: string, rng: Rng = Math.random): FullQuestion | null {
  const usable = pairs.filter((p) => fullItemById(p.a) && fullItemById(p.b));
  if (!usable.length) return null;
  const p = weightedPick(usable, (x) => Math.min(4, x.score) * (x.a === last || x.b === last ? 0.5 : 1), rng);
  const [a, b] = shuffle([fullItemById(p.a)!, fullItemById(p.b)!], rng);
  const key = keyOnPc(pick(COMMON, rng), 'major');
  const chord = spelled(key, a);
  const ans = (x: FullItem): FullAnswer => ({ root: mod(pcOf(key.tonic) + x.semis, 12), quality: x.quality });
  return { key, item: a, chord, notes: earVoicing(chord, 1, rng), ref: refNotes(key), qualities: [a.quality, b.quality], duel: shuffle([ans(a), ans(b)], rng) };
}

/** Le degré (dans la tonalité de la question) d'une réponse, s'il fait partie des accords travaillés. */
export function itemOfAnswer(key: Key | null, a: FullAnswer): FullItem | undefined {
  if (!key) return undefined;
  const semis = mod(a.root - pcOf(key.tonic), 12);
  return ALL_TONAL.find((x) => x.semis === semis && x.quality === a.quality);
}

const DIST = [
  'la tonique elle-même',
  'un demi-ton au-dessus',
  'un ton au-dessus',
  'une tierce mineure au-dessus',
  'une tierce majeure au-dessus',
  'une quarte au-dessus',
  'un triton au-dessus',
  'une quinte au-dessus',
  'une sixte mineure au-dessus',
  'une sixte majeure au-dessus (une tierce mineure en dessous)',
  'une 7e mineure au-dessus (un ton en dessous)',
  'une 7e majeure au-dessus (un demi-ton en dessous)'
];

/** Correction en mots : la fondamentale, la nature, et où se trouve l'accord par rapport à la référence. */
export function judgeFull(q: FullQuestion, a: FullAnswer): { ok: boolean; rootOk: boolean; qualityOk: boolean; text: string } {
  const truthRoot = mod(pcOf(q.chord.root), 12);
  const rootOk = a.root === truthRoot;
  const qualityOk = a.quality === q.chord.quality;
  const name = (k: string) => (k === 'maj' ? 'majeur' : k === 'min' ? 'mineur' : QUALITIES[k].sym);
  const ref = q.key ? noteName(q.key.tonic) : 'do';
  const where = `La fondamentale ${pcNameIn(truthRoot, q.key)} est ${DIST[mod(truthRoot - (q.key ? pcOf(q.key.tonic) : 0), 12)].replace('la tonique elle-même', q.key ? 'la tonique elle-même' : 'le do lui-même')}${
    q.key ? '' : ' du do'
  }.`;
  const role = q.item ? ` C’est le ${q.item.id}${q.item.role ? ` (${q.item.role})` : ''} de ${ref} majeur.` : '';
  let text: string;
  if (rootOk && qualityOk) text = `${where}${role}`;
  else if (qualityOk) text = `La nature est juste (${name(a.quality)}), mais la fondamentale est ${pcNameIn(truthRoot, q.key)}, pas ${pcNameIn(a.root, q.key)}. ${where}${role}`;
  else if (rootOk) text = `La fondamentale est juste (${pcNameIn(a.root, q.key)}), mais c’est un ${name(q.chord.quality)}, pas un ${name(a.quality)}.${role}`;
  else text = `${where}${role}`;
  return { ok: rootOk && qualityOk, rootOk, qualityOk, text };
}
