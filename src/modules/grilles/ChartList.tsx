import { useState } from 'preact/hooks';
import { LIBRARY } from '../../library/charts';
import { EXERCISES } from '../../library/exercises';
import { deleteUserChart, userCharts } from '../../library/userCharts';
import { Chart, keyLabel } from '../../core/chart/model';
import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';

const STYLE: Record<string, string> = { swing: 'Swing', bossa: 'Bossa', ballade: 'Ballade', blues: 'Blues' };

function Row({ c, stars = true }: { c: Chart; stars?: boolean }) {
  return (
    <a class="row" href={`#/grille/${c.id}`}>
      <h3>{c.title}</h3>
      <span class="meta">
        {stars ? (
          <>
            <span class="level">{'★'.repeat(c.level)}</span>
            <span style="opacity:.35">{'★'.repeat(3 - c.level)}</span>
          </>
        ) : null}
      </span>
      <p>
        {keyLabel(c.key)} · {STYLE[c.style]} · {c.bars.length} mesures
        {c.subtitle ? ` · ${c.subtitle.split(',')[0]}` : ''}
      </p>
    </a>
  );
}

export function ChartList() {
  const [mine, setMine] = useState(userCharts);
  const [armed, setArmed] = useState<string | null>(null);
  return (
    <div class="screen">
      <div class="topbar">
        <button class="back" aria-label="Retour" onClick={() => go('/')}><BackIcon /></button>
        <h1>Grilles</h1>
        <a class="btn primary" href="#/importer">Importer</a>
      </div>
      <p class="muted small" style="margin:0">
        Chaque grille est analysée : centres tonaux, degrés, ii–V et résolutions. Lis-la, écoute-la, joue dessus. Les étoiles indiquent la difficulté
        harmonique.
      </p>

      {mine.length ? (
        <>
          <h2 class="list-title">Mes grilles</h2>
          <div class="list">
            {mine.map((c) => (
              <div class="row-wrap" key={c.id}>
                <Row c={c} stars={false} />
                <button
                  class={'linkbtn' + (armed === c.id ? ' armed' : '')}
                  onClick={() => {
                    if (armed === c.id) {
                      deleteUserChart(c.id);
                      setMine(userCharts());
                      setArmed(null);
                    } else {
                      setArmed(c.id);
                      setTimeout(() => setArmed((a) => (a === c.id ? null : a)), 3000);
                    }
                  }}
                >
                  {armed === c.id ? 'Toucher encore pour supprimer' : 'Supprimer'}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h2 class="list-title">Standards</h2>
      <div class="list">{LIBRARY.map((c) => <Row key={c.id} c={c} />)}</div>

      <h2 class="list-title">Exercices</h2>
      <div class="list">{EXERCISES.map((c) => <Row key={c.id} c={c} />)}</div>
    </div>
  );
}
