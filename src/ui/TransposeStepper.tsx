import { Key, keyLabel, keyName } from '../core/chart/model';
import { signedPc } from '../core/theory/notes';

export function TransposeStepper({ chartKey, shift, onShift }: { chartKey: Key; shift: number; onShift: (s: number) => void }) {
  const d = signedPc(shift);
  return (
    <div class="stepper" role="group" aria-label={`Tonalité : ${keyLabel(chartKey)}`}>
      <button aria-label="Transposer un demi-ton plus bas" onClick={() => onShift(shift - 1)}>−</button>
      <span>
        {keyName(chartKey)}
        {d ? <small> {d > 0 ? '+' : ''}{d}</small> : null}
      </span>
      <button aria-label="Transposer un demi-ton plus haut" onClick={() => onShift(shift + 1)}>+</button>
    </div>
  );
}
