// Barre de lecture du play-along : lecture, tempo, instruments.
import { useState } from 'preact/hooks';
import { Drawer } from './Drawer';
import { PlayIcon, SlidersIcon, StopIcon } from './icons';
import { PlayerApi, PlayerToggle } from './usePlayer';

const TOGGLES: [PlayerToggle, string][] = [
  ['bass', 'Basse'],
  ['comp', 'Piano'],
  ['drums', 'Batterie'],
  ['countIn', 'Décompte']
];

export function PlayerBar({ p, fromBar = 0 }: { p: PlayerApi; fromBar?: number }) {
  const [open, setOpen] = useState(false);
  const off = TOGGLES.filter(([k]) => !p.prefs[k] && k !== 'countIn').map(([, l]) => l.toLowerCase());
  return (
    <>
      <div class="player">
        <div class="player-inner">
          <button class="play" aria-label={p.playing ? 'Arrêter' : 'Lire la grille'} onClick={() => p.toggle(fromBar)}>
            {p.playing ? <StopIcon /> : <PlayIcon />}
          </button>
          <div class="tempo" role="group" aria-label="Tempo">
            <button class="icon-btn" aria-label="Plus lent" onClick={() => p.setTempo(Math.max(40, p.tempo - 4))}>−</button>
            <span>
              <b>{p.tempo}</b> BPM
            </span>
            <button class="icon-btn" aria-label="Plus rapide" onClick={() => p.setTempo(Math.min(300, p.tempo + 4))}>+</button>
          </div>
          <button class="icon-btn" aria-label="Instruments" onClick={() => setOpen(true)}>
            <SlidersIcon />
          </button>
        </div>
        {off.length || p.loadState === 'loading' || p.loadState === 'error' ? (
          <p class="player-note">
            {p.loadState === 'loading' ? 'Chargement du piano… ' : p.loadState === 'error' ? 'Piano de secours (échantillons indisponibles). ' : ''}
            {off.length ? `Coupé : ${off.join(', ')}.` : ''}
          </p>
        ) : null}
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} label="Instruments">
        <h2 class="drawer-title">Instruments</h2>
        <div class="toggles">
          {TOGGLES.map(([k, l]) => (
            <label key={k} class="toggle">
              <input type="checkbox" checked={p.prefs[k]} onChange={() => p.flip(k)} />
              <span>{l}</span>
            </label>
          ))}
        </div>
        <label class="field">
          <span>Tempo : {p.tempo} BPM</span>
          <input id="tempo" type="range" min={40} max={300} step={2} value={p.tempo} onInput={(e) => p.setTempo(Number((e.target as HTMLInputElement).value))} />
        </label>
      </Drawer>
    </>
  );
}
