import { useState } from 'preact/hooks';
import { LIBRARY, POP } from '../../library/charts';
import { load, save } from '../../core/storage';
import { Segmented } from '../../ui/Segmented';
import { EXERCISES } from '../../library/exercises';
import { deleteUserChart, userCharts } from '../../library/userCharts';
import { Chart, keyLabel } from '../../core/chart/model';
import { TopBar } from '../../ui/Screen';
import { ChevronIcon } from '../../ui/icons';
import { ConfirmButton } from '../../ui/ConfirmButton';

const STYLE: Record<string, string> = { swing: 'swing', bossa: 'bossa', ballade: 'ballade', blues: 'blues', valse: 'valse', samba: 'samba', latin: 'latin', funk: 'funk', rock: 'pop-rock', slow: 'ballade pop' };
type Tab = 'jazz' | 'pop' | 'chanson';
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
  const [tab, setTabState] = useState<Tab>(() => load<{ tab: Tab }>('morceaux', { tab: 'jazz' }).tab);
  const setTab = (t: Tab) => (setTabState(t), save('morceaux', { tab: t }));
  const levels = (list: Chart[], what: string) =>
    ([1, 2, 3] as const)
      .filter((lv) => list.some((c) => c.level === lv))
      .map((lv) => (
        <section key={lv}>
          <h2 class="label">
            {what} · {['', 'faciles', 'moyens', 'avancés'][lv]}
          </h2>
          <div class="list">
            {list
              .filter((c) => c.level === lv)
              .map((c) => (
                <Row key={c.id} c={c} />
              ))}
          </div>
        </section>
      ));
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
      <p class="intro">Choisis un morceau : l’appli raconte sa grille phrase par phrase, t’accompagne (basse, batterie, piano) et, avec le micro, vérifie ce que tu joues.</p>
      <Segmented
        label="Répertoire"
        value={tab}
        onChange={(t: Tab) => setTab(t)}
        options={[
          { value: 'jazz', label: 'Jazz' },
          { value: 'pop', label: 'Pop-rock' },
          { value: 'chanson', label: 'Chanson' }
        ]}
      />
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
      {tab === 'jazz' ? (
        <>
          {levels(LIBRARY, 'Standards')}
          <section>
            <h2 class="label">Grilles d’exercice</h2>
            <div class="list">{EXERCISES.map((c) => <Row key={c.id} c={c} />)}</div>
          </section>
        </>
      ) : tab === 'pop' ? (
        levels(POP.filter((c) => c.genre === 'pop'), 'Pop-rock')
      ) : (
        <>
          {levels(POP.filter((c) => c.genre === 'chanson'), 'Chanson')}
          <p class="muted small">Les Feuilles mortes, de Kosma et Prévert, est devenue le standard Autumn Leaves : elle est dans l’onglet Jazz.</p>
        </>
      )}
      <p class="muted small">Un morceau qui manque ? « Importer » : colle une grille d’Ultimate Guitar ou au format ChordPro.</p>
    </div>
  );
}
