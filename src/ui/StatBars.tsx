// Barres de réussite : une ligne par élément, couleur selon le taux.
export interface StatRow {
  label: string;
  c: number;
  t: number;
  /** Texte à droite (par défaut : « 82 % · 9/11 »). */
  value?: string;
}

const accColor = (acc: number) => (acc >= 0.8 ? 'var(--ok)' : acc >= 0.5 ? 'var(--accent)' : 'var(--bad)');

export function StatBars({ rows }: { rows: StatRow[] }) {
  return (
    <div class="bars">
      {rows.map((r) => {
        const acc = r.t ? r.c / r.t : -1;
        return (
          <div class="statbar" key={r.label}>
            <span class="lb">{r.label}</span>
            <span class="tr">
              <span class="fl" style={`width:${acc < 0 ? 0 : Math.max(4, acc * 100)}%;background:${acc < 0 ? 'transparent' : accColor(acc)}`} />
            </span>
            <span class="v">{r.value ?? (acc < 0 ? '—' : `${Math.round(acc * 100)} % · ${r.c}/${r.t}`)}</span>
          </div>
        );
      })}
    </div>
  );
}
