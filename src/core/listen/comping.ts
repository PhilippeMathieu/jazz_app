// Vérification de l'accompagnement joué sur la grille (main gauche).
import { Chord, rootPc } from '../theory/chords';
import { mod } from '../theory/notes';
import { scalePcs } from '../theory/scales';
import { guideTones } from '../analysis/improv';
import { LIMITS } from './detect';

export interface CompCheck {
  ok: boolean;
  /** Guide tones absentes (3ce, 7e). */
  missing: number[];
  /** Notes nettement entendues hors de la gamme de l'accord. */
  wrong: number[];
}

/**
 * Un accompagnement est juste si la 3ce et la 7e sont là et qu'aucune note nette ne sort
 * de la gamme conseillée (les tensions de la gamme et la fondamentale sont permises).
 */
export function checkComping(chroma: Float32Array, c: Chord, scale: string, soft: Float32Array = chroma): CompCheck {
  const g = guideTones(c);
  const allowed = new Set([...scalePcs(rootPc(c), scale), rootPc(c)]);
  const missing = [g.third, g.seventh].filter((p) => soft[p] < LIMITS.present);
  const wrong: number[] = [];
  for (let p = 0; p < 12; p++) if (!allowed.has(p) && chroma[p] >= LIMITS.extra) wrong.push(mod(p, 12));
  return { ok: !missing.length && !wrong.length, missing, wrong };
}
