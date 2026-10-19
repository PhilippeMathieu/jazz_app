import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chart, keyLabel, keyName, transposeChart } from '../../core/chart/model';
import { guideTones, improvPlan } from '../../core/analysis/improv';
import { QUALITIES, chordPcs, chordSymbol, spellInChord } from '../../core/theory/chords';
import { mod, noteName, pcOf, signedPc } from '../../core/theory/notes';
import { SCALES, scaleNotes } from '../../core/theory/scales';
import { audio, chord as playChord, now } from '../../core/audio/engine';
import { displayVoicing } from '../../core/audio/voicing';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';
import { PlayerBar, usePlayer } from '../../ui/PlayerBar';

export type ImproMode = 'gammes' | 'guide';

const TIPS: Record<ImproMode, string[]> = {
  gammes: [
    'Commence lentement (70 à 90 BPM), en croches, depuis la fondamentale de chaque accord.',
    'Puis enchaîne les gammes sans sauter : à chaque changement d’accord, repars de la note la plus proche.',
    'Vise une note de l’accord (en orange) sur le premier temps de chaque mesure.'
  ],
  guide: [
    'Joue la ligne 1 en rondes à la main droite, basse à la main gauche. Puis la ligne 2.',
    'La 7e d’un accord descend souvent d’un demi-ton vers la 3ce du suivant : c’est le son du ii–V.',
    'Ensuite, improvise librement mais retombe sur la note de la ligne au premier temps de chaque accord.'
  ]
};

const LO = 55;
const HI = 79;

export function ImproView({ chart: original, mode: initialMode }: { chart: Chart; mode: ImproMode }) {
  const [mode, setMode] = useState<ImproMode>(initialMode);
  const [shift, setShift] = useState(0);
  const [selected, setSelected] = useState(0);
  const chart = useMemo(() => transposeChart(original, shift), [original, shift]);
  const plan = useMemo(() => improvPlan(chart), [chart]);
  const player = usePlayer(chart, original.id, original.tempo);
  const live = useRef<HTMLDivElement>(null);
  const n = plan.flat.length;
  const cur = player.pos ? player.pos.chord : Math.min(selected, n - 1);
  const nx = (cur + 1) % n;

  // Garde la mesure jouée visible entre le panneau fixe et le lecteur.
  useEffect(() => {
    if (!player.pos) return;
    const el = document.querySelector(`[data-ci="${player.pos.chord}"]`);
    if (!el || !live.current) return;
    const r = el.getBoundingClientRect();
    const top = live.current.getBoundingClientRect().bottom + 8;
    const bottom = window.innerHeight - 150;
    if (r.top < top || r.bottom > bottom) window.scrollBy({ top: r.top - top - 20, behavior: 'smooth' });
  }, [player.pos?.bar]);

  const rows = useMemo(() => {
    const out: { label?: string; bars: number[] }[] = [];
    chart.bars.forEach((b, i) => {
      const last = out[out.length - 1];
      if (!last || b.section || last.bars.length === 4) out.push({ label: b.section, bars: [i] });
      else last.bars.push(i);
    });
    return out;
  }, [chart]);
  const byBar = useMemo(() => {
    const m = new Map<number, number[]>();
    plan.flat.forEach((f) => m.set(f.bar, [...(m.get(f.bar) ?? []), f.index]));
    return m;
  }, [plan]);

  const f = plan.flat[cur];
  const a = plan.analysis.chords[cur];
  const sc = plan.scales[cur];
  const c = f.chord;
  const rp = pcOf(c.root);
  const chordTones = new Set(chordPcs(c).filter((_, i) => QUALITIES[c.quality].iv[i] < 12));
  const notes = scaleNotes(c.root, rp, sc.scale);
  const gt = guideTones(c);

  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  if (mode === 'gammes') {
    const pcs = new Map(notes.map((nn) => [pcOf(nn), noteName(nn)]));
    for (let m = LO; m <= HI; m++) {
      const p = mod(m, 12);
      if (!pcs.has(p)) continue;
      marks[m] = chordTones.has(p) ? 'hit' : 'soft';
      labels[m] = pcs.get(p)!;
    }
  } else {
    const A = plan.guideA[cur];
    const B = plan.guideB[cur];
    marks[A.midi] = 'hit';
    labels[A.midi] = A.name;
    marks[B.midi] = 'ok';
    labels[B.midi] = B.name;
  }

  const fc = plan.flat[nx].chord;
  const nextLabel =
    mode === 'gammes'
      ? `${chordSymbol(fc)} · ${SCALES[plan.scales[nx].scale].name}`
      : `${chordSymbol(fc)} · ligne 1 ${plan.guideA[nx].name} (${plan.guideA[nx].role}), ligne 2 ${plan.guideB[nx].name} (${plan.guideB[nx].role})`;

  const preview = (i: number) => {
    setSelected(i);
    if (player.playing()) return;
    audio();
    playChord(displayVoicing(plan.flat[i].chord), now() + 0.02, 1.2, 0.5);
  };

  return (
    <>
      <div class="screen with-player">
        <div class="topbar">
          <button class="back" aria-label="Retour" onClick={() => go('/impro')}><BackIcon /></button>
          <h1>{chart.title}</h1>
        </div>
        <div class="chart-head">
          <div class="stepper" role="group" aria-label="Transposer">
            <button aria-label="Un demi-ton plus bas" onClick={() => setShift((s) => s - 1)}>−</button>
            <span>
              {keyName(chart.key)}
              {signedPc(shift) ? <small class="muted"> {signedPc(shift) > 0 ? '+' : ''}{signedPc(shift)}</small> : null}
            </span>
            <button aria-label="Un demi-ton plus haut" onClick={() => setShift((s) => s + 1)}>+</button>
          </div>
          <div class="seg" role="group" aria-label="Exercice">
            <button aria-pressed={mode === 'gammes'} onClick={() => setMode('gammes')}>Gammes</button>
            <button aria-pressed={mode === 'guide'} onClick={() => setMode('guide')}>Guide tones</button>
          </div>
        </div>

        <div class="live" ref={live}>
          <div class="live-head">
            <span class="big-sym">{chordSymbol(c)}</span>
            <span class="rn-big">{a.roman}</span>
            <span class="muted small">{keyLabel(a.key)}</span>
          </div>
          {mode === 'gammes' ? (
            <>
              <div class="scale-name">
                <b>{SCALES[sc.scale].name}</b>
                {sc.alt ? <span class="muted small"> · ou {SCALES[sc.alt].name}</span> : null}
              </div>
              <div class="scale-notes">
                {notes.map((nn, i) => (
                  <span key={i} class={chordTones.has(pcOf(nn)) ? 'ct' : ''}>{noteName(nn)}</span>
                ))}
              </div>
              <p class="why">{sc.why}</p>
            </>
          ) : (
            <>
              <div class="guide-pair">
                <span><i class="dot a" />Ligne 1 : <b>{plan.guideA[cur].name}</b> ({plan.guideA[cur].role})</span>
                <span><i class="dot b" />Ligne 2 : <b>{plan.guideB[cur].name}</b> ({plan.guideB[cur].role})</span>
              </div>
              <p class="why">
                Guide tones de {chordSymbol(c)} : {gt.thirdLabel} = {spellInChord(c, gt.third)}, {gt.seventhLabel} = {spellInChord(c, gt.seventh)}.
              </p>
            </>
          )}
          <Keyboard lo={LO} hi={HI} marks={marks} labels={labels} fit />
          <div class="next-line">Ensuite : {nextLabel}</div>
        </div>

        <div class="sheet">
          {rows.map((row, ri) => (
            <div key={ri}>
              {row.label ? <div class="sec-label">{row.label}</div> : null}
              <div class="sysrow">
                {row.bars.map((bi) => {
                  const idxs = byBar.get(bi) ?? [];
                  return (
                    <div key={bi} class={'bar compact' + (player.pos?.bar === bi ? ' now' : '')}>
                      <span class="barnum">{bi + 1}</span>
                      <div class={'chords' + (idxs.length > 1 ? ' two' : '')}>
                        {idxs.map((ci) => (
                          <button key={ci} data-ci={ci} class={'ch' + (cur === ci ? ' now' : '') + (!player.pos && selected === ci ? ' sel' : '')} onClick={() => preview(ci)}>
                            <span class="sym">{chordSymbol(plan.flat[ci].chord)}</span>
                            <span class="rn">
                              {mode === 'gammes' ? SCALES[plan.scales[ci].scale].short : `${plan.guideA[ci].name} · ${plan.guideB[ci].name}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <section class="tips">
          <h2>Comment travailler</h2>
          <ol>
            {TIPS[mode].map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </section>
      </div>
      <PlayerBar p={player} fromBar={player.pos ? 0 : plan.flat[Math.min(selected, n - 1)].bar} />
    </>
  );
}
