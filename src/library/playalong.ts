// Bandes-son : les play-alongs de l'élève (ses propres fichiers, gardés sur l'appareil), calés mesure par mesure.
// Ici, seulement ce qui permet de suivre la musique : le début de chaque mesure et l'accord de chaque tonalité.
import { Chord, chordPcs, parseChord } from '../core/theory/chords';
import { VOL21 } from './vol21';

export interface PlayTrack {
  vol: number;
  track: number;
  title: string;
  /** Tempo (noire). Absent : piste pas encore calée (lecture seule). */
  tempo?: number;
  form?: 'cycle' | 'blues';
  /** Mesures par tonalité (cycle). */
  perKey?: number;
  /** Début de chaque mesure dans le fichier (s). */
  bars?: number[];
  /** [1re mesure, accord(s)] : deux accords séparés par une espace se partagent la mesure. */
  segs?: [number, string][];
}

export interface Volume {
  vol: number;
  title: string;
  sub: string;
  tracks: PlayTrack[];
}

export const VOLUMES: Volume[] = [
  {
    vol: 21,
    title: 'Vol. 21 : Gettin’ It Together',
    sub: 'Une couleur d’accord dans les 12 tonalités, et deux blues',
    tracks: VOL21
  }
];

export const trackId = (t: PlayTrack) => `v${t.vol}-${String(t.track).padStart(2, '0')}`;
export const trackById = (id: string) => VOLUMES.flatMap((v) => v.tracks).find((t) => trackId(t) === id);
export const isCalibrated = (t: PlayTrack) => !!(t.bars?.length && t.segs?.length);

/** Le fichier importé correspond à quelle piste ? Le numéro au début du nom (« 05. Majeur en Quarte.mp3 »). */
export function matchFile(name: string, vol = 21): PlayTrack | undefined {
  const m = /^\D{0,12}?(\d{1,2})\b/.exec(name.replace(/\.[a-z0-9]+$/i, ''));
  if (!m) return undefined;
  const n = Number(m[1]);
  return VOLUMES.find((v) => v.vol === vol)?.tracks.find((t) => t.track === n);
}

/** Durée d'une mesure (s), médiane. */
export function barLength(t: PlayTrack): number {
  const b = t.bars ?? [];
  if (b.length < 2) return 60 / (t.tempo ?? 120) * 4;
  const d = b.slice(1).map((x, i) => x - b[i]).sort((x, y) => x - y);
  return d[Math.floor(d.length / 2)];
}

/** Mesure jouée à l'instant `sec` (-1 avant la première). */
export function barAt(t: PlayTrack, sec: number): number {
  const b = t.bars ?? [];
  let lo = 0;
  let hi = b.length - 1;
  if (!b.length || sec < b[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (b[mid] <= sec) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Segment (tonalité, ou mesure du blues) qui contient la mesure `bar`. */
export function segAt(t: PlayTrack, bar: number): number {
  const s = t.segs ?? [];
  let i = 0;
  while (i + 1 < s.length && s[i + 1][0] <= bar) i++;
  return i;
}

/** Les accords d'un segment, analysés. */
export const segChords = (t: PlayTrack, seg: number): Chord[] => (t.segs?.[seg]?.[1] ?? '').split(' ').map((x) => parseChord(x)).filter((c): c is Chord => !!c);

/** Début et fin (s) d'un segment, pour rejouer une tonalité en boucle. */
export function segSpan(t: PlayTrack, seg: number): [number, number] {
  const b = t.bars ?? [];
  const s = t.segs ?? [];
  const first = s[seg]?.[0] ?? 0;
  const next = s[seg + 1]?.[0];
  const end = next !== undefined ? b[next] : (b[b.length - 1] ?? 0) + barLength(t);
  return [b[first] ?? 0, end];
}

/** L'accord qui sonne : dans une mesure à deux accords, le second sur la 2e moitié. */
export function chordAt(t: PlayTrack, sec: number): { bar: number; seg: number; chord: Chord | null; beat: number } {
  const bar = barAt(t, sec);
  if (bar < 0) return { bar, seg: -1, chord: null, beat: 0 };
  const seg = segAt(t, bar);
  const cs = segChords(t, seg);
  const start = t.bars![bar];
  const len = (t.bars![bar + 1] ?? start + barLength(t)) - start;
  const frac = Math.min(0.999, Math.max(0, (sec - start) / len));
  const chord = cs.length > 1 ? cs[Math.min(cs.length - 1, Math.floor(frac * cs.length))] : (cs[0] ?? null);
  return { bar, seg, chord, beat: Math.floor(frac * 4) };
}

/** Gamme conseillée sur un accord (cycle), ou la gamme blues de la tonalité (blues). */
export function scaleFor(t: PlayTrack, c: Chord): string {
  if (t.form === 'blues') return 'blues';
  switch (c.quality) {
    case 'maj7':
      return 'ionien';
    case 'm7':
      return 'dorien';
    case 'm7b5':
      return 'locrien';
    case 'mM7':
      return 'melodique';
    case '7b9':
      return 'dimHW';
    case 'dim7':
      return 'dimWH';
    default:
      return 'mixolydien';
  }
}

/** Tonique d'un blues : l'accord de la 1re mesure. */
export const bluesTonic = (t: PlayTrack): Chord | null => segChords(t, 0)[0] ?? null;

/** Notes de l'accord (classes de hauteur), pour les marquer au clavier. */
export const tonesOf = (c: Chord) => chordPcs(c);
