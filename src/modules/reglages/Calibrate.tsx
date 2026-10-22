// Réglage du décalage du micro (10 s), depuis les réglages : retranché des attaques (rythme au piano, comping).
import { offsetOf } from '../../core/rhythm/offset';
import { CalibrateOffset } from '../rythme/Rythme';

/** Décalage mesuré au micro (ms), retranché des attaques. */
export const micOffset = (): number => offsetOf('mic') ?? 0;

export function Calibrate({ input = 'mic', onDone }: { input?: 'tap' | 'mic'; onDone: () => void }) {
  return <CalibrateOffset input={input} onDone={onDone} />;
}
