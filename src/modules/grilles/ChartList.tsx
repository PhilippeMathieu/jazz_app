import { useState } from 'preact/hooks';
import { LIBRARY } from '../../library/charts';
import { EXERCISES } from '../../library/exercises';
import { deleteUserChart, userCharts } from '../../library/userCharts';
import { Chart, keyLabel } from '../../core/chart/model';
import { TopBar } from '../../ui/Screen';
import { ChevronIcon } from '../../ui/icons';
import { ConfirmButton } from '../../ui/ConfirmButton';

const STYLE: Record<string, string> = { swing: 'swing', bossa: 'bossa', ballade: 'ballade', blues: 'blues', valse: 'valse', samba: 'samba', latin: 'latin', funk: 'funk' };
const LEVEL = ['', 'facile', 'moyen', 'avancé'];

function Row({ c, extra }: { c: Chart; extra?: preact.ComponentChildren }) {
  return (
    <div class="row-wrap">
      <a class="row" href={`#/grille/${c.id}`}>
        <span class="row-main">
          <span class="row-title">{c.title}</span>
          <span class="row-sub">
            {keyLabel(c.key)} · {STYLE[c.style]} · {c.bars.length} mesures{c.level && extra === undefined ? ` · ${LEVEL[c.level]}` : ''}
          </span>
        </span>
        <ChevronIcon />
      </a>
      {extra}
    </div>
  );
}

export function ChartList() {
  const [mine, setMine] = useState(userCharts);
  return (
    <div class="screen">
      <TopBar
        title="Morceaux"
        actions={
          <a class="btn sm" href="#/importer">
            Importer
          </a>
        }
      />
      <p class="intro">Choisis un morceau : l’appli analyse la grille (degrés, gammes, guide tones) et t’accompagne (basse, batterie, 7 styles). Avec le micro, elle vérifie ce que tu joues.</p>
      {mine.length ? (
        <section>
          <h2 class="label">Mes morceaux</h2>
          <div class="list">
            {mine.map((c) => (
              <Row
                key={c.id}
                c={c}
                extra={
                  <ConfirmButton
                    label="Supprimer"
                    confirm="Toucher encore pour supprimer"
                    onConfirm={() => {
                      deleteUserChart(c.id);
                      setMine(userCharts());
                    }}
                  />
                }
              />
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <h2 class="label">Standards</h2>
        <div class="list">{LIBRARY.map((c) => <Row key={c.id} c={c} />)}</div>
      </section>
      <section>
        <h2 class="label">Grilles d’exercice</h2>
        <div class="list">{EXERCISES.map((c) => <Row key={c.id} c={c} />)}</div>
      </section>
    </div>
  );
}
