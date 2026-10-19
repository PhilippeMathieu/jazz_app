// Mode pupitre : téléphone posé sur le piano, lisible à distance, sans avoir à le toucher.
import { useEffect, useState } from 'preact/hooks';
import { Chart, keyName } from '../core/chart/model';
import { ImprovPlan } from '../core/analysis/improv';
import { chordSymbol } from '../core/theory/chords';
import { SCALES } from '../core/theory/scales';
import { Keyboard, Mark } from './Keyboard';
import { PlayerApi } from './usePlayer';
import { CloseIcon, PlayIcon, StopIcon } from './icons';
import { useWakeLock } from './wakeLock';
import { Segmented } from './Segmented';
import { fitSymbol } from './fit';
import { scaleMarks } from './keyboardMarks';

export type StandMode = 'analyse' | 'gammes' | 'guide';
const LO = 55;
const HI = 79;

export function Stand({ chart, plan, player, initial, startIndex = 0, onClose }: { chart: Chart; plan: ImprovPlan; player: PlayerApi; initial: StandMode; startIndex?: number; onClose: () => void }) {
  const [mode, setMode] = useState<StandMode>(initial);
  useWakeLock(true);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const n = plan.flat.length;
  if (!n) return null;
  const pos = player.pos;
  const cur = pos ? pos.chord : Math.min(startIndex, n - 1);
  const nx = (cur + 1) % n;
  const f = plan.flat[cur];
  const c = f.chord;
  const a = plan.analysis.chords[cur];
  const beatInChord = pos ? pos.bar * chart.beatsPerBar + pos.beatInBar - f.start : -1;

  let marks: Record<number, Mark> = {};
  let labels: Record<number, string> = {};
  const info = (i: number) =>
    mode === 'gammes'
      ? SCALES[plan.scales[i].scale].name
      : mode === 'guide'
        ? `${plan.guideA[i].name} (${plan.guideA[i].role}) · ${plan.guideB[i].name} (${plan.guideB[i].role})`
        : `${plan.analysis.chords[i].roman} · ${keyName(plan.analysis.chords[i].key)}`;
  if (mode === 'gammes') ({ marks, labels } = scaleMarks(c, plan.scales[cur].scale, LO, HI));
  if (mode === 'guide') {
    const A = plan.guideA[cur];
    const B = plan.guideB[cur];
    marks = { [A.midi]: 'hit', [B.midi]: 'ok' };
    labels = { [A.midi]: A.name, [B.midi]: B.name };
  }
  const sym = chordSymbol(c);
  const nextSym = chordSymbol(plan.flat[nx].chord);

  return (
    <div class="stand" role="dialog" aria-label="Mode pupitre">
      <div class="stand-top">
        <Segmented
          label="Affichage"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'analyse', label: 'Degrés' },
            { value: 'gammes', label: 'Gammes' },
            { value: 'guide', label: 'Guide tones' }
          ]}
        />
        <button class="icon-btn" aria-label="Fermer le pupitre" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div class="stand-main">
        <div class="stand-chords">
          <div class="stand-now">
            <span class="stand-bar">Mesure {f.bar + 1} / {chart.bars.length}</span>
            <span class="stand-sym" style={`font-size:min(${fitSymbol(sym, 34, 150)}cqw, 26vh)`}>{sym}</span>
            <span class="stand-info">{info(cur)}</span>
            <div class="beats" aria-hidden="true">
              {Array.from({ length: Math.max(1, Math.round(f.beats)) }, (_, i) => <i key={i} class={i <= beatInChord ? 'on' : ''} />)}
            </div>
          </div>
          <div class="stand-next">
            <span class="stand-bar">Ensuite</span>
            <span class="stand-sym2" style={`font-size:min(${fitSymbol(nextSym, 22, 90)}cqw, 13vh)`}>{nextSym}</span>
            <span class="stand-info2">{info(nx)}</span>
          </div>
        </div>
        {mode !== 'analyse' ? (
          <div class="stand-kb">
            <Keyboard lo={LO} hi={HI} marks={marks} labels={labels} fit big />
          </div>
        ) : (
          <p class="stand-explain">{a.explain}</p>
        )}
      </div>

      <div class="stand-controls">
        <button class="round-btn" aria-label="Plus lent" onClick={() => player.setTempo(Math.max(40, player.tempo - 4))}>−</button>
        <button class="play big-play" aria-label={player.playing ? 'Arrêter' : 'Lancer'} onClick={() => player.toggle(f.bar)}>
          {player.playing ? <StopIcon /> : <PlayIcon />}
        </button>
        <button class="round-btn" aria-label="Plus rapide" onClick={() => player.setTempo(Math.min(300, player.tempo + 4))}>+</button>
        <span class="stand-tempo">{player.tempo} BPM</span>
      </div>
    </div>
  );
}
