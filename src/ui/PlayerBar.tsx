import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from '../core/chart/model';
import { ChartPlayer, Position } from '../core/player/player';
import { onLoadState, LoadState } from '../core/audio/engine';
import { load, save } from '../core/storage';
import { PlayIcon, StopIcon } from './icons';

interface Prefs {
  tempo: Record<string, number>;
  bass: boolean;
  comp: boolean;
  drums: boolean;
  countIn: boolean;
}
const DEFAULT_PREFS: Prefs = { tempo: {}, bass: true, comp: true, drums: true, countIn: true };
type Toggle = 'bass' | 'comp' | 'drums' | 'countIn';

/** Lecteur de grille partagé par la vue Grille et la vue Improviser. */
export function usePlayer(chart: Chart, tempoId: string, defaultTempo: number) {
  const [prefs, setPrefs] = useState<Prefs>(() => load('grille-prefs', DEFAULT_PREFS));
  const [pos, setPos] = useState<Position | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const player = useRef<ChartPlayer | null>(null);
  const tempo = prefs.tempo[tempoId] ?? defaultTempo;

  useEffect(() => onLoadState(setLoadState), []);
  useEffect(() => save('grille-prefs', prefs), [prefs]);

  // Recréé quand la grille ou l'instrumentation change ; reprend là où il en était.
  useEffect(() => {
    const wasPlaying = player.current?.playing;
    const bar = pos?.bar ?? 0;
    player.current?.stop();
    player.current = new ChartPlayer(chart, { tempo, bass: prefs.bass, comp: prefs.comp, drums: prefs.drums, countIn: prefs.countIn }, setPos);
    if (wasPlaying) player.current.start(bar);
    return () => player.current?.stop();
  }, [chart, prefs.bass, prefs.comp, prefs.drums, prefs.countIn]);

  return {
    pos,
    tempo,
    prefs,
    loadState,
    playing: () => !!player.current?.playing,
    start: (bar = 0) => player.current?.start(bar),
    stop: () => player.current?.stop(),
    toggle: (bar = 0) => {
      const p = player.current!;
      if (p.playing) p.stop();
      else p.start(bar);
    },
    setTempo: (bpm: number) => {
      player.current?.setTempo(bpm);
      setPrefs((p) => ({ ...p, tempo: { ...p.tempo, [tempoId]: bpm } }));
    },
    flip: (k: Toggle) => setPrefs((p) => ({ ...p, [k]: !p[k] }))
  };
}
export type PlayerApi = ReturnType<typeof usePlayer>;

export function PlayerBar({ p, fromBar = 0 }: { p: PlayerApi; fromBar?: number }) {
  const on = !!p.pos || p.playing();
  return (
    <div class="player">
      <div class="player-inner">
        <div class="player-main">
          <button class="play" aria-label={on ? 'Arrêter' : 'Lire la grille'} onClick={() => p.toggle(fromBar)}>
            {on ? <StopIcon /> : <PlayIcon />}
          </button>
          <div class="tempo">
            <label for="tempo">
              <span>Tempo</span>
              <b>{p.tempo} BPM</b>
            </label>
            <input id="tempo" type="range" min={40} max={280} step={2} value={p.tempo} onInput={(e) => p.setTempo(Number((e.target as HTMLInputElement).value))} />
          </div>
        </div>
        <div class="toggles">
          <button class="chip" aria-pressed={p.prefs.bass} onClick={() => p.flip('bass')}>Basse</button>
          <button class="chip" aria-pressed={p.prefs.comp} onClick={() => p.flip('comp')}>Piano</button>
          <button class="chip" aria-pressed={p.prefs.drums} onClick={() => p.flip('drums')}>Batterie</button>
          <button class="chip" aria-pressed={p.prefs.countIn} onClick={() => p.flip('countIn')}>Décompte</button>
          {p.loadState === 'loading' ? <span class="loading">Chargement du piano…</span> : null}
          {p.loadState === 'error' ? <span class="loading">Piano de secours (échantillons indisponibles)</span> : null}
        </div>
      </div>
    </div>
  );
}
