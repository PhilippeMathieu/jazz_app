// Lecteur de grille (play-along) partagé par la vue Grille et le mode pupitre.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from '../core/chart/model';
import { ChartPlayer, PlayerOptions, Position } from '../core/player/player';
import { MelNote } from '../core/melody/melody';
import { onLoadState, LoadState } from '../core/audio/engine';
import { load, save } from '../core/storage';
import { useWakeLock } from './wakeLock';
import { grooveOf } from '../core/rhythm/styles';

export interface PlayerPrefs {
  tempo: Record<string, number>;
  /** Style choisi par grille (sinon celui de la grille). */
  style: Record<string, string>;
  bass: boolean;
  comp: boolean;
  drums: boolean;
  countIn: boolean;
  /** Mélodie enregistrée, quand le morceau en a une. */
  melody: boolean;
}
const DEFAULT_PREFS: PlayerPrefs = { tempo: {}, style: {}, bass: true, comp: true, drums: true, countIn: true, melody: true };
export type PlayerToggle = 'bass' | 'comp' | 'drums' | 'countIn' | 'melody';
const NO_MELODY: MelNote[] = [];

/** melody : mélodie enregistrée, déjà transposée (même tableau d'un rendu à l'autre). */
export function usePlayer(chart: Chart, tempoId: string, defaultTempo: number, melody: MelNote[] = NO_MELODY) {
  const [prefs, setPrefs] = useState<PlayerPrefs>(() => load('grille-prefs', DEFAULT_PREFS));
  const [pos, setPos] = useState<Position | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const player = useRef<ChartPlayer | null>(null);
  const posRef = useRef<Position | null>(null);
  /** Lecture à reprendre quand le lecteur est recréé (instrument coupé, transposition…). */
  const resume = useRef<number | null>(null);
  const tempo = prefs.tempo[tempoId] ?? defaultTempo;
  const style = prefs.style[tempoId] ?? chart.style;
  const base = () => ({ bass: prefs.bass, comp: prefs.comp, drums: prefs.drums, countIn: prefs.countIn, melody, melodyOn: prefs.melody && melody.length > 0 });

  useEffect(() => onLoadState(setLoadState), []);
  useEffect(() => save('grille-prefs', prefs), [prefs]);
  useWakeLock(playing);

  useEffect(() => {
    const p = new ChartPlayer(chart, { tempo, style, ...base() }, (x) => {
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
  }, [chart, style, prefs.bass, prefs.comp, prefs.drums, prefs.countIn, prefs.melody, melody]);

  const start = (bar = 0) => {
    player.current?.start(bar);
    setPlaying(!!player.current?.playing);
  };
  const stop = () => {
    player.current?.stop();
    // Fin d'une lecture à réglages imposés (enregistrement) : on revient aux réglages choisis.
    if (player.current) Object.assign(player.current.opts, base());
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
    /** Lecture avec des réglages imposés le temps d'une lecture (ex. : piano coupé pour enregistrer). */
    startWith: (bar: number, o: Partial<PlayerOptions>) => {
      if (player.current) Object.assign(player.current.opts, o);
      start(bar);
    },
    beatMap: () => player.current?.beatMap() ?? null,
    beatOfBar: (bar: number) => player.current?.beatOfBar(bar) ?? 0,
    length: () => player.current?.length ?? 0,
    hasMelody: melody.length > 0,
    setTempo: (bpm: number) => {
      player.current?.setTempo(bpm);
      setPrefs((p) => ({ ...p, tempo: { ...p.tempo, [tempoId]: bpm } }));
    },
    style,
    meter: chart.beatsPerBar,
    /** Change le style ; le tempo passe à celui du style s'il était hors de sa plage. */
    setStyle: (id: string) => {
      const g = grooveOf(id);
      setPrefs((p) => {
        const t = p.tempo[tempoId] ?? defaultTempo;
        const inRange = t >= g.tempo[0] && t <= g.tempo[1];
        return { ...p, style: { ...p.style, [tempoId]: id }, tempo: inRange ? p.tempo : { ...p.tempo, [tempoId]: g.defaultTempo } };
      });
    },
    flip: (k: PlayerToggle) => setPrefs((p) => ({ ...p, [k]: !p[k] })),
    set: (k: PlayerToggle, v: boolean) => setPrefs((p) => ({ ...p, [k]: v }))
  };
}
export type PlayerApi = ReturnType<typeof usePlayer>;
