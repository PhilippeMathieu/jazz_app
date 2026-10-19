import { useState } from 'preact/hooks';
import { LIBRARY } from '../../library/charts';
import { EXERCISES } from '../../library/exercises';
import { userCharts } from '../../library/userCharts';
import { Chart, keyLabel } from '../../core/chart/model';
import { BackIcon, ChevronIcon } from '../../ui/icons';
import { go } from '../../ui/router';
import { load, save } from '../../core/storage';
import type { ImproMode } from './ImproView';

const INTRO: Record<ImproMode, string> = {
  gammes:
    'Pour chaque accord, la gamme à jouer est déduite de l’analyse : un G7 qui va vers Cm n’appelle pas la même gamme qu’un G7 qui va vers C. Le clavier suit le play-along en direct.',
  guide:
    'Les guide tones sont la 3ce et la 7e de chaque accord. Deux lignes qui bougent le moins possible : c’est le squelette de toute impro sur la grille.'
};

function Row({ c, mode }: { c: Chart; mode: ImproMode }) {
  return (
    <a class="row" href={`#/impro/${mode}/${c.id}`}>
      <h3>{c.title}</h3>
      <span class="meta"><ChevronIcon /></span>
      <p>{keyLabel(c.key)} · {c.bars.length} mesures{c.subtitle ? ` · ${c.subtitle.split(',')[0]}` : ''}</p>
    </a>
  );
}

export function Impro() {
  const [mode, setModeState] = useState<ImproMode>(() => load('impro', { mode: 'gammes' as ImproMode }).mode);
  const setMode = (m: ImproMode) => {
    setModeState(m);
    save('impro', { mode: m });
  };
  const mine = userCharts();
  return (
    <div class="screen">
      <div class="topbar">
        <button class="back" aria-label="Retour" onClick={() => go('/')}><BackIcon /></button>
        <h1>Improviser</h1>
      </div>
      <div class="seg wide" role="group" aria-label="Exercice">
        <button aria-pressed={mode === 'gammes'} onClick={() => setMode('gammes')}>Gammes</button>
        <button aria-pressed={mode === 'guide'} onClick={() => setMode('guide')}>Guide tones</button>
      </div>
      <p class="muted small" style="margin:0">{INTRO[mode]}</p>

      <h2 class="list-title">Exercices</h2>
      <div class="list">{EXERCISES.map((c) => <Row key={c.id} c={c} mode={mode} />)}</div>

      <h2 class="list-title">Standards</h2>
      <div class="list">{LIBRARY.map((c) => <Row key={c.id} c={c} mode={mode} />)}</div>

      {mine.length ? (
        <>
          <h2 class="list-title">Mes grilles</h2>
          <div class="list">{mine.map((c) => <Row key={c.id} c={c} mode={mode} />)}</div>
        </>
      ) : null}

      <p class="muted small" style="margin:0">
        Pas encore possible : l’écoute de ton jeu au micro pour vérifier tes notes. Sur iPhone, le navigateur ne permet pas de brancher un clavier MIDI.
      </p>
    </div>
  );
}
