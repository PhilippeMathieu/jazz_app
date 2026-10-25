// Flash voicings : fabrication des suites d'accords à jouer (sans interface, testable).
import { Chord, chordOnPc, chordSymbol, QUALITIES } from '../../core/theory/chords';
import { noteName } from '../../core/theory/notes';
import { keyLabel } from '../../core/chart/model';
import { keyFor, spellProgression } from '../../core/theory/progressions';
import { UPPER_STRUCTURES, US_IDS, UsId, VoicingType } from '../../core/audio/voicing';
import { Rng, pick, rndInt, weightedPick } from '../../core/random';
import { QUALITY_LEVELS } from '../oreille/data';

export type Order = 'random' | 'cycle' | 'iiVI' | 'iiVim' | 'iiVI12' | 'pop';
export const ORDER_LABEL: Record<Order, string> = {
  random: 'Au hasard',
  cycle: 'Cycle de quartes',
  iiVI: 'ii–V–I majeurs',
  iiVim: 'ii–V–i mineurs',
  iiVI12: 'ii–V–I dans les 12 tonalités',
  pop: 'I – V – vi – IV'
};
/** Les 12 tonalités, par quartes : C, F, B♭… */
const CYCLE = Array.from({ length: 12 }, (_, i) => (i * 5) % 12);

export interface FlashSettings {
  /** Un accord à la fois, ou comping en rythme. */
  exercise?: 'flash' | 'comping';
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
  /** Upper structure : la triade de la main droite. */
  us?: UsId;
  /** Symbole affiché, s'il diffère de l'accord (« G13(♯11) »). */
  label?: string;
}
/** Réussite et temps de réaction par accord (« D♭7 · B »). */
export type ChordStats = Record<string, { c: number; t: number; ms: number }>;

export const statKey = (it: Item) => `${chordSymbol(it.chord)} · ${it.us ? 'us ' + it.us : it.type}`;

/** Upper structure sur une dominante : l'accord écrit avec ses tensions. */
export function withUs(it: Item, us: UsId): Item {
  const u = UPPER_STRUCTURES[us];
  const chord = { root: it.chord.root, quality: u.quality };
  return { ...it, chord, type: 'us', us, label: noteName(chord.root) + u.suffix };
}
const isDom = (c: Chord) => QUALITIES[c.quality].family === 'dom' && !QUALITIES[c.quality].sus;
/** En upper structures, seules les dominantes en reçoivent une ; les autres accords se jouent écartés. */
function forUs(it: Item, minor: boolean, rng: Rng): Item {
  if (it.type !== 'us') return it;
  if (!isDom(it.chord)) return { ...it, type: 'spread' };
  return withUs(it, pick(minor ? (['bVI', 'bV', 'bIII'] as UsId[]) : (['II', 'VI'] as UsId[]), rng));
}
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
  if (s.order === 'pop') {
    // La suite de la pop, dans une tonalité au hasard : chaque accord dans le renversement le plus proche.
    const key = keyFor('I-V-vi-IV', rndInt(12, rng));
    return spellProgression(key, 'I-V-vi-IV').map(({ chord, roman }) => ({ chord, type: s.type, context: `I – V – vi – IV en ${keyLabel(key)} · ${roman}` }));
  }
  if (s.order === 'iiVI' || s.order === 'iiVim' || s.order === 'iiVI12') {
    // En 3 sons : II – V – I sans les 7es (II° en mineur).
    const minor = s.order === 'iiVim';
    const id = triad ? (minor ? 'iiVimtri' : 'iiVItri') : minor ? 'iiVim' : 'iiVI';
    const tonics = s.order === 'iiVI12' ? CYCLE : [rndInt(12, rng)];
    return tonics.flatMap((t, n) => {
      const key = keyFor(id, t);
      const ctx = `${minor ? 'ii–V–i' : 'ii–V–I'} en ${keyLabel(key)}${tonics.length > 1 ? ` · ${n + 1}/12` : ''}`;
      // A, B, A : la conduite des voix reste serrée.
      return spellProgression(key, id).map(({ chord, roman }, i) => forUs({ chord, type: i === 1 ? other(s.type) : s.type, context: `${ctx} · ${roman}` }, minor, rng));
    });
  }
  if (s.type === 'us') {
    // Upper structures : des dominantes, chacune avec sa triade.
    if (s.order === 'cycle') return CYCLE.map((pc, i) => ({ ...withUs({ chord: chordOnPc(pc, '7'), type: 'us' }, US_IDS[step % US_IDS.length]), context: `Cycle de quartes · ${i + 1}/12` }));
    const all: Item[] = [];
    for (let pc = 0; pc < 12; pc++) for (const u of US_IDS) all.push(withUs({ chord: chordOnPc(pc, '7'), type: 'us' }, u));
    return Array.from({ length: 8 }, () => weightedPick(all, (it) => weakness(stats, statKey(it)), rng));
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
