// Onglet « Paroles » d'une grille importée : chaque ligne du texte collé par l'élève, les accords au-dessus des mots,
// la mesure jouée surlignée. Les paroles viennent de l'élève et restent sur l'appareil.
import { useMemo } from 'preact/hooks';
import { Chart } from '../../core/chart/model';
import { chordsByBar } from '../../core/chart/layout';
import { ImprovPlan } from '../../core/analysis/improv';
import { chordSymbol } from '../../core/theory/chords';
import { Position } from '../../core/player/player';

/** Lignes de la grille : une nouvelle à chaque ligne du texte et à chaque section. */
export function lyricLines(chart: Chart): { section?: string; bars: number[] }[] {
  const out: { section?: string; bars: number[] }[] = [];
  chart.bars.forEach((b, i) => {
    if (i === 0 || b.line || b.section) out.push({ section: b.section, bars: [] });
    out[out.length - 1].bars.push(i);
  });
  return out;
}

export function LyricsView({ chart, plan, pos, selBar, onTap }: { chart: Chart; plan: ImprovPlan; pos: Position | null; selBar: number | null; onTap: (ci: number) => void }) {
  const lines = useMemo(() => lyricLines(chart), [chart]);
  const byBar = useMemo(() => chordsByBar(plan.flat), [plan]);
  return (
    <div class="lyrics">
      <p class="muted small">Touche une mesure pour partir de là (▶), ou pour entendre son accord.</p>
      {lines.map((l, li) => {
        const here = pos !== null && l.bars.includes(pos.bar);
        return (
          <div key={li} class={'lyr-line' + (here ? ' now' : '')}>
            {l.section ? <div class="sec-label">{l.section}</div> : null}
            <div class="lyr-row">
              {l.bars.map((bi) => {
                const idxs = byBar.get(bi) ?? [];
                const b = chart.bars[bi];
                return (
                  <button
                    key={bi}
                    class={'lyr-bar' + (pos?.bar === bi ? ' now' : '') + (pos === null && selBar === bi ? ' sel' : '')}
                    onClick={() => idxs.length && onTap(idxs[0])}
                  >
                    <span class="lyr-ch">
                      {idxs.map((ci) => (
                        <b key={ci} data-ci={ci} class={pos?.chord === ci ? 'now' : ''}>
                          {chordSymbol(plan.flat[ci].chord)}
                        </b>
                      ))}
                    </span>
                    <span class="lyr-txt">{b.lyric ?? ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
