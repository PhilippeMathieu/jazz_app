// Flash voicings : fabrication des suites d'accords à jouer (sans interface, testable).
import { Chord, chordOnPc, chordSymbol, QUALITIES } from '../../core/theory/chords';
import { keyLabel } from '../../core/chart/model';
import { keyFor, spellProgression } from '../../core/theory/progressions';
import { VoicingType } from '../../core/audio/voicing';
import { Rng, rndInt, weightedPick } from '../../core/random';
import { QUALITY_LEVELS } from '../oreille/data';

export type Order = 'random' | 'cycle' | 'iiVI' | 'iiVim';
export const ORDER_LABEL: Record<Order, string> = {
  random: 'Au hasard',
  cycle: 'Cycle de quartes',
  iiVI: 'ii–V–I majeurs',
  iiVim: 'ii–V–i mineurs'
};

export interface FlashSettings {
  level: number;
  type: VoicingType;
  order: Order;
  delay: number;
  sound: boolean;
}
export interface Item {
  chord: Chord;
  type: VoicingType;
  context?: string;
}
/** Réussite et temps de réaction par accord (« D♭7 · B »). */
export type ChordStats = Record<string, { c: number; t: number; ms: number }>;

export const statKey = (it: Item) => `${chordSymbol(it.chord)} · ${it.type === 'shell' ? 'shell' : it.type}`;
const other = (t: VoicingType): VoicingType => (t === 'A' ? 'B' : t === 'B' ? 'A' : t);

/** Poids d'un accord : plus il est raté ou lent, plus il revient. */
export function weakness(s: ChordStats, key: string): number {
  const v = s[key];
  if (!v || !v.t) return 1.5; // jamais joué : un peu plus souvent
  const acc = v.c / v.t;
  const slow = v.c ? Math.min(2, v.ms / v.c / 4000) : 1;
  return 0.5 + 2 * (1 - acc) + slow;
}

export function nextBatch(s: FlashSettings, step: number, stats: ChordStats = {}, rng: Rng = Math.random): Item[] {
  const triad = s.type === 'triad';
  if (s.order === 'iiVI' || s.order === 'iiVim') {
    // En 3 sons : II – V – I sans les 7es (II° en mineur).
    const id = triad ? (s.order === 'iiVI' ? 'iiVItri' : 'iiVimtri') : s.order;
    const key = keyFor(id, rndInt(12, rng));
    const ctx = `${s.order === 'iiVim' ? 'ii–V–i' : 'ii–V–I'} en ${keyLabel(key)}`;
    // A, B, A : la conduite des voix reste serrée.
    return spellProgression(key, id).map(({ chord, roman }, i) => ({ chord, type: i === 1 ? other(s.type) : s.type, context: `${ctx} · ${roman}` }));
  }
  // Les 3 sons se jouent en majeur et mineur ; les autres voicings suivent le niveau choisi.
  const pool = triad ? QUALITY_LEVELS[0] : QUALITY_LEVELS[Math.min(4, Math.max(1, s.level))];
  if (s.order === 'cycle') {
    const q = pool[step % pool.length];
    return Array.from({ length: 12 }, (_, i) => ({
      chord: chordOnPc((i * 5) % 12, q),
      type: i % 2 === 0 ? s.type : other(s.type),
      context: `Cycle de quartes · ${QUALITIES[q].name} · ${i + 1}/12`
    }));
  }
  const all: Item[] = [];
  for (let pc = 0; pc < 12; pc++) for (const q of pool) all.push({ chord: chordOnPc(pc, q), type: s.type });
  return Array.from({ length: 8 }, () => weightedPick(all, (it) => weakness(stats, statKey(it)), rng));
}
