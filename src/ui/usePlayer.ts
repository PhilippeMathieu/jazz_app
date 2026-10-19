// Lecteur de grille (play-along) partagé par la vue Grille et le mode pupitre.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from '../core/chart/model';
import { ChartPlayer, Position } from '../core/player/player';
import { onLoadState, LoadState } from '../core/audio/engine';
import { load, save } from '../core/storage';
import { useWakeLock } from './wakeLock';

export interface PlayerPrefs {
  tempo: Record<string, number>;
  bass: boolean;
  comp: boolean;
  drums: boolean;
  countIn: boolean;
}
const DEFAULT_PREFS: PlayerPrefs = { tempo: {}, bass: true, comp: true, drums: true, countIn: true };
export type PlayerToggle = 'bass' | 'comp' | 'drums' | 'countIn';

export function usePlayer(chart: Chart, tempoId: string, defaultTempo: number) {
  const [prefs, setPrefs] = useState<PlayerPrefs>(() => load('grille-prefs', DEFAULT_PREFS));
  const [pos, setPos] = useState<Position | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const player = useRef<ChartPlayer | null>(null);
  const posRef = useRef<Position | null>(null);
  /** Lecture à reprendre quand le lecteur est recréé (instrument coupé, transposition…). */
  const resume = useRef<number | null>(null);
  const tempo = prefs.tempo[tempoId] ?? defaultTempo;

  useEffect(() => onLoadState(setLoadState), []);
  useEffect(() => save('grille-prefs', prefs), [prefs]);
  useWakeLock(playing);

  useEffect(() => {
    const p = new ChartPlayer(chart, { tempo, bass: prefs.bass, comp: prefs.comp, drums: prefs.drums, countIn: prefs.countIn }, (x) => {
      posRef.current = x;
      setPos(x);
    });
    player.current = p;
    if (resume.current !== null) {
      p.start(resume.current);
      setPlaying(p.playing);
      resume.current = null;
    }
    return () => {
      // Le nettoyage passe avant le nouvel effet : on mémorise ici s'il faut reprendre.
      resume.current = p.playing ? (posRef.current?.bar ?? 0) : null;
      p.stop();
    };
  }, [chart, prefs.bass, prefs.comp, prefs.drums, prefs.countIn]);

  const start = (bar = 0) => {
    player.current?.start(bar);
    setPlaying(!!player.current?.playing);
  };
  const stop = () => {
    player.current?.stop();
    setPlaying(false);
  };

  return {
    pos,
    playing,
    tempo,
    prefs,
    loadState,
    start,
    stop,
    toggle: (bar = 0) => (player.current?.playing ? stop() : start(bar)),
    setTempo: (bpm: number) => {
      player.current?.setTempo(bpm);
      setPrefs((p) => ({ ...p, tempo: { ...p.tempo, [tempoId]: bpm } }));
    },
    flip: (k: PlayerToggle) => setPrefs((p) => ({ ...p, [k]: !p[k] })),
    set: (k: PlayerToggle, v: boolean) => setPrefs((p) => ({ ...p, [k]: v }))
  };
}
export type PlayerApi = ReturnType<typeof usePlayer>;
