// Décalage entre le son et la mesure des coups (écran ou micro), mesuré une fois et retranché des coups.
import { load, save } from '../storage';

export type OffsetInput = 'tap' | 'mic';
type Offsets = Record<string, number>;

function read(): Offsets {
  // Ancien emplacement : les réglages des exercices de rythme.
  const old = load<{ offsets: Offsets }>('rythme', { offsets: {} }).offsets;
  return { ...old, ...load<Offsets>('decalage', {}) };
}

/** Décalage mesuré (ms), ou undefined s'il n'a pas encore été mesuré. */
export const offsetOf = (input: OffsetInput): number | undefined => {
  const v = read()[input];
  return typeof v === 'number' ? v : undefined;
};
export const saveOffset = (input: OffsetInput, ms: number) => save('decalage', { ...read(), [input]: ms });
