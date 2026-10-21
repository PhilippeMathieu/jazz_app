// Phrases : l'appel (la phrase sur l'accompagnement) et l'accompagnement seul pour répondre.
import { audio, bass, drum, now, piano, playChord } from '../../core/audio/engine';
import { lhVoicing } from '../../core/audio/voicing';
import { rootPc } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { Phrase } from './lines';

const SWING = 2 / 3;
/** Temps (en noires) où commence la croche n, en swing. */
export const beatOf = (eighth: number) => Math.floor(eighth / 2) + (eighth % 2 ? SWING : 0);
export const BARS = 4;

/**
 * Joue 4 mesures : ii, V, I, I. withPhrase : la phrase au piano (l'appel) ; countIn : une mesure de charleston avant.
 * Renvoie l'instant (secondes depuis maintenant) de chaque note de la phrase, et la durée totale.
 */
export function playCall(p: Phrase, tempo: number, opts: { phrase: boolean; backing: boolean; countIn?: boolean }): { at: number[]; total: number } {
  audio();
  const spb = 60 / tempo;
  const t0 = now() + 0.12 + (opts.countIn ? 4 * spb : 0);
  if (opts.countIn) for (let b = 0; b < 4; b++) drum('pedal', t0 - (4 - b) * spb, b % 2 ? 0.35 : 0.25);
  if (opts.backing) {
    const chords = [p.chords[0], p.chords[1], p.chords[2], p.chords[2]];
    let prev: number[] | null = null;
    chords.forEach((c, bar) => {
      const tb = t0 + bar * 4 * spb;
      const r = rootPc(c);
      const root = 36 + mod(r - 36, 12) + (mod(r - 36, 12) > 7 ? -12 : 0);
      bass(root, tb, 1.8 * spb, 0.8);
      bass(root + 7, tb + 2 * spb, 1.8 * spb, 0.7);
      const v = lhVoicing(c, bar % 2 ? 'B' : 'A', prev);
      prev = v;
      // Charleston : le 1, puis le « et » de 2 ; la main gauche reste sous la phrase.
      playChord(v, tb, 1.2 * spb, 0.36);
      playChord(v, tb + (1 + SWING) * spb, 0.5 * spb, 0.3);
      for (const [o, s, vel] of [[0, 'ride', 0.15], [1, 'ride', 0.2], [1 + SWING, 'ride', 0.09], [2, 'ride', 0.15], [3, 'ride', 0.2], [3 + SWING, 'ride', 0.09], [1, 'pedal', 0.25], [3, 'pedal', 0.25]] as const)
        drum(s, tb + o * spb, vel);
    });
  }
  const at: number[] = [];
  p.notes.forEach((n, i) => {
    const t = t0 + beatOf(n.start) * spb;
    const end = i + 1 < p.notes.length ? t0 + beatOf(p.notes[i + 1].start) * spb : t + Math.min(4, n.dur / 2) * spb;
    if (opts.phrase) piano(n.midi, t, Math.max(0.12, (end - t) * 0.95), n.start % 2 ? 0.55 : 0.64);
    at.push(t - now());
  });
  return { at, total: t0 - now() + BARS * 4 * spb };
}
