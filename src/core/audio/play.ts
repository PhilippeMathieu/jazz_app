// Faire entendre des accords hors du lecteur de grille : un accord, ou une suite enchaînée.
import { Chord } from '../theory/chords';
import { audio, bass, now, playChord } from './engine';
import { VoicingType, bassRoot, lhVoicing, voiceLead } from './voicing';

/** Un type de voicing pour toute la suite, ou un par accord ; rien = voicing complet qui bouge peu. */
export type SeqVoicing = VoicingType | VoicingType[] | undefined;
const typeAt = (v: SeqVoicing, i: number) => (Array.isArray(v) ? v[i % v.length] : v);

/** Voicings enchaînés d'une suite d'accords (ce qu'on entend avec playSequence). */
export function sequenceVoicings(chords: Chord[], voicing?: SeqVoicing): number[][] {
  let prev: number[] | null = null;
  return chords.map((c, i) => {
    const t = typeAt(voicing, i);
    const v: number[] = t ? lhVoicing(c, t, prev) : voiceLead(c, prev);
    prev = v;
    return v;
  });
}

/** Joue une suite d'accords, un accord toutes les `gap` secondes (basse comprise). */
export function playSequence(chords: Chord[], opts: { gap?: number; voicing?: SeqVoicing } = {}) {
  audio();
  const gap = opts.gap ?? 1.1;
  const t0 = now() + 0.05;
  sequenceVoicings(chords, opts.voicing).forEach((v, i) => {
    const t = t0 + i * gap;
    // Le shell contient déjà la fondamentale.
    if (typeAt(opts.voicing, i) !== 'shell') bass(bassRoot(chords[i], 36), t, gap * 0.92, 0.8);
    playChord(v, t, gap * 0.92, 0.5);
  });
}

export const playOne = (c: Chord, voicing?: VoicingType) => playSequence([c], { gap: 1.4, voicing });
