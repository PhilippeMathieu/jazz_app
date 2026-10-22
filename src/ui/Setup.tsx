// Petits éléments de mise en page des réglages.
import { ComponentChildren } from 'preact';

/** Un réglage avec son titre. */
export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="field-block">
      <h2 class="label">{label}</h2>
      {children}
    </div>
  );
}

export function StartButton({ onClick, label = 'Commencer', disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button class="btn primary block" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
