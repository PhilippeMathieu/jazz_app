// Choix exclusif : une seule forme de « sélectionné » dans toute l'appli.
export interface SegOption<T> {
  value: T;
  label: string;
  sub?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  cards = false,
  cols
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** Options en cartes avec sous-titre ; sinon, barre compacte et sous-titre de l'option choisie dessous. */
  cards?: boolean;
  cols?: number;
}) {
  const detail = !cards ? options.find((o) => o.value === value)?.sub : undefined;
  const group = (
    <div
      class={cards ? 'seg-cards' : 'seg'}
      role="radiogroup"
      aria-label={label}
      style={cards ? `grid-template-columns:repeat(${cols ?? options.length}, minmax(0, 1fr))` : undefined}
    >
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
          <span class="seg-label">{o.label}</span>
          {cards && o.sub ? <span class="seg-sub">{o.sub}</span> : null}
        </button>
      ))}
    </div>
  );
  // En barre compacte, le détail de l'option choisie s'affiche dessous.
  return detail ? (
    <div class="seg-wrap">
      {group}
      <p class="seg-detail">{detail}</p>
    </div>
  ) : (
    group
  );
}
