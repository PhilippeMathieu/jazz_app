// Mode pupitre : téléphone posé sur le piano, lisible à distance, sans avoir à le toucher.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Chart, keyName } from '../core/chart/model';
import { improvPlan } from '../core/analysis/improv';
import { QUALITIES, chordPcs, chordSymbol } from '../core/theory/chords';
import { mod, noteName, pcOf } from '../core/theory/notes';
import { SCALES, scaleNotes } from '../core/theory/scales';
import { Keyboard, Mark } from './Keyboard';
import { PlayerApi } from './PlayerBar';
import { PlayIcon, StopIcon } from './icons';
import { useWakeLock } from './wakeLock';

export type StandMode = 'accords' | 'gammes' | 'guide';

/** Taille de police (en % de la largeur du bloc) pour qu'un symbole tienne sur une ligne. */
const fit = (sym: string, max: number, k: number) => Math.min(max, k / Math.max(3, [...sym].length)).toFixed(1);

export function Stand({ chart, player, initial, startIndex = 0, onClose }: { chart: Chart; player: PlayerApi; initial: StandMode; startIndex?: number; onClose: () => void }) {
  const [mode, setMode] = useState<StandMode>(initial);
  const plan = useMemo(() => improvPlan(chart), [chart]);
  useWakeLock(true);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const n = plan.flat.length;
  const pos = player.pos;
  const cur = pos ? pos.chord : Math.min(startIndex, n - 1);
  const f = plan.flat[cur];
  const nx = plan.flat[(cur + 1) % n];
  const a = plan.analysis.chords[cur];
  const sc = plan.scales[cur];
  const c = f.chord;

  // Temps de l'accord en cours : carrés allumés jusqu'au temps joué.
  const absBeat = pos ? pos.bar * chart.beatsPerBar + pos.beatInBar : -1;
  const beatInChord = pos ? absBeat - f.start : -1;

  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  const lo = 55;
  const hi = 79;
  let info = '';
  if (mode === 'gammes') {
    const notes = scaleNotes(c.root, pcOf(c.root), sc.scale);
    const tones = new Set(chordPcs(c).filter((_, i) => QUALITIES[c.quality].iv[i] < 12));
    const names = new Map(notes.map((x) => [pcOf(x), noteName(x)]));
    for (let m = lo; m <= hi; m++) {
      const p = mod(m, 12);
      if (!names.has(p)) continue;
      marks[m] = tones.has(p) ? 'hit' : 'soft';
      labels[m] = names.get(p)!;
    }
    info = SCALES[sc.scale].name;
  } else if (mode === 'guide') {
    const A = plan.guideA[cur];
    const B = plan.guideB[cur];
    marks[A.midi] = 'hit';
    labels[A.midi] = A.name;
    marks[B.midi] = 'ok';
    labels[B.midi] = B.name;
    info = `${A.name} (${A.role}) · ${B.name} (${B.role})`;
  } else {
    info = `${a.roman} · ${keyName(a.key)}`;
  }
  const nextInfo =
    mode === 'gammes' ? SCALES[plan.scales[(cur + 1) % n].scale].short : mode === 'guide' ? `${plan.guideA[(cur + 1) % n].name} · ${plan.guideB[(cur + 1) % n].name}` : plan.analysis.chords[(cur + 1) % n].roman;

  const on = !!pos || player.playing();
  return (
    <div class="stand" role="dialog" aria-label="Mode pupitre">
      <div class="stand-top">
        <div class="seg" role="group" aria-label="Affichage">
          <button aria-pressed={mode === 'accords'} onClick={() => setMode('accords')}>Accords</button>
          <button aria-pressed={mode === 'gammes'} onClick={() => setMode('gammes')}>Gammes</button>
          <button aria-pressed={mode === 'guide'} onClick={() => setMode('guide')}>Guide tones</button>
        </div>
        <button class="btn" onClick={onClose}>Fermer</button>
      </div>

      <div class="stand-main">
        <div class="stand-chords">
          <div class="stand-now">
            <span class="stand-bar">Mesure {f.bar + 1}/{chart.bars.length}</span>
            <span class="stand-sym" style={`font-size:${fit(chordSymbol(c), 34, 150)}cqw`}>{chordSymbol(c)}</span>
            <span class="stand-info">{info}</span>
            <div class="beats" aria-hidden="true">
              {Array.from({ length: Math.max(1, Math.round(f.beats)) }, (_, i) => <i key={i} class={i <= beatInChord ? 'on' : ''} />)}
            </div>
          </div>
          <div class="stand-next">
            <span class="eyebrow">Ensuite</span>
            <span class="stand-sym2" style={`font-size:${fit(chordSymbol(nx.chord), 16, 70)}cqw`}>{chordSymbol(nx.chord)}</span>
            <span class="stand-info2">{nextInfo}</span>
          </div>
        </div>
        {mode !== 'accords' ? (
          <div class="stand-kb">
            <Keyboard lo={lo} hi={hi} marks={marks} labels={labels} fit />
          </div>
        ) : null}
      </div>

      <div class="stand-controls">
        <button class="stand-step" aria-label="Plus lent" onClick={() => player.setTempo(Math.max(40, player.tempo - 4))}>−</button>
        <button class="play big-play" aria-label={on ? 'Arrêter' : 'Lancer'} onClick={() => player.toggle(f.bar)}>
          {on ? <StopIcon /> : <PlayIcon />}
        </button>
        <button class="stand-step" aria-label="Plus rapide" onClick={() => player.setTempo(Math.min(280, player.tempo + 4))}>+</button>
        <span class="stand-tempo">{player.tempo} BPM</span>
      </div>
    </div>
  );
}
