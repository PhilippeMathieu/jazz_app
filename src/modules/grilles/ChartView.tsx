import { useEffect, useMemo, useState } from 'preact/hooks';
import { Chart, flatten, keyName, keyLabel, transposeChart } from '../../core/chart/model';
import { analyze } from '../../core/analysis/analyze';
import { chordNotes, chordSymbol, spellInChord } from '../../core/theory/chords';
import { noteName, signedPc } from '../../core/theory/notes';
import { audio, chord as playChord, now } from '../../core/audio/engine';
import { displayVoicing } from '../../core/audio/voicing';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';
import { load, save } from '../../core/storage';
import { PlayerBar, usePlayer } from '../../ui/PlayerBar';

export function ChartView({ chart: original }: { chart: Chart }) {
  const [view, setView] = useState(() => load('grille-view', { analysis: true }));
  const [shift, setShift] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => save('grille-view', view), [view]);

  const chart = useMemo(() => transposeChart(original, shift), [original, shift]);
  const flat = useMemo(() => flatten(chart), [chart]);
  const an = useMemo(() => analyze(chart), [chart]);
  const player = usePlayer(chart, original.id, original.tempo);
  const pos = player.pos;
  const flip = () => setView((v) => ({ analysis: !v.analysis }));

  // Lignes de 4 mesures, avec retour à la ligne à chaque section.
  const rows = useMemo(() => {
    const out: { label?: string; bars: number[] }[] = [];
    chart.bars.forEach((b, i) => {
      const last = out[out.length - 1];
      if (!last || b.section || last.bars.length === 4) out.push({ label: b.section, bars: [i] });
      else last.bars.push(i);
    });
    return out;
  }, [chart]);

  const chordsByBar = useMemo(() => {
    const m = new Map<number, number[]>();
    flat.forEach((f) => m.set(f.bar, [...(m.get(f.bar) ?? []), f.index]));
    return m;
  }, [flat]);

  const keyStarts = useMemo(() => {
    const m = new Map<number, string>();
    an.regions.forEach((r) => {
      const bar = flat[r.from].bar;
      if (!m.has(bar)) m.set(bar, keyName(r.key));
    });
    return m;
  }, [an, flat]);

  const bracketPart = (i: number) => {
    const b = an.brackets.find((x) => x.from <= i && i <= x.to);
    if (!b) return 'bk none';
    return `bk${i === b.from ? ' l' : ''}${i === b.to ? ' r' : ''}${b.kind === 'iiSubV' ? ' sub' : ''}`;
  };

  const show = view.analysis;
  const sel = selected !== null ? flat[selected] : null;
  const selAn = selected !== null ? an.chords[selected] : null;

  const voicing = sel ? displayVoicing(sel.chord) : [];
  const names = sel ? chordNotes(sel.chord) : [];
  const labels: Record<number, string> = {};
  const marks: Record<number, Mark> = {};
  if (sel) {
    voicing.forEach((m) => {
      marks[m] = 'hit';
      labels[m] = spellInChord(sel.chord, m);
    });
  }

  return (
    <>
      <div class="screen with-player">
        <div class="topbar">
          <button class="back" aria-label="Retour" onClick={() => go('/grilles')}><BackIcon /></button>
          <h1>{chart.title}</h1>
          <a class="btn primary" href={`#/impro/gammes/${original.id}`}>Improviser</a>
        </div>

        <div class="chart-head">
          <div class="stepper" role="group" aria-label="Transposer">
            <button aria-label="Transposer un demi-ton plus bas" onClick={() => setShift((s) => s - 1)}>−</button>
            <span title={keyLabel(chart.key)}>
              {keyName(chart.key)}
              {signedPc(shift) ? <small class="muted"> {signedPc(shift) > 0 ? '+' : ''}{signedPc(shift)}</small> : null}
            </span>
            <button aria-label="Transposer un demi-ton plus haut" onClick={() => setShift((s) => s + 1)}>+</button>
          </div>
          <div class="seg" role="group" aria-label="Affichage de l'analyse">
            <button aria-pressed={show} onClick={() => !show && flip()}>Analyse</button>
            <button aria-pressed={!show} onClick={() => show && flip()}>Masquée</button>
          </div>
        </div>
        {chart.notes ? <p class="chart-notes">{chart.notes}</p> : null}

        <div class="sheet">
          {rows.map((row, ri) => (
            <div key={ri}>
              {row.label ? <div class="sec-label">{row.label}</div> : null}
              <div class="sysrow">
                {row.bars.map((bi) => {
                  const idxs = chordsByBar.get(bi) ?? [];
                  return (
                    <div key={bi} class={'bar' + (pos?.bar === bi ? ' now' : '')}>
                      <span class="barnum">{bi + 1}</span>
                      {show && keyStarts.has(bi) ? <span class="keytag">{keyStarts.get(bi)}</span> : null}
                      <div class={'chords' + (idxs.length > 1 ? ' two' : '')}>
                        {idxs.map((ci) => {
                          const a = an.chords[ci];
                          const f = flat[ci];
                          return (
                            <button
                              key={ci}
                              class={'ch' + (pos?.chord === ci ? ' now' : '') + (selected === ci ? ' sel' : '')}
                              onClick={() => {
                                setSelected(ci);
                                const v = displayVoicing(f.chord);
                                audio();
                                playChord(v, now() + 0.02, 1.4, 0.55);
                              }}
                            >
                              <span class="sym">{chordSymbol(f.chord)}</span>
                              {show ? (
                                <span class={'rn' + (a.diatonic ? '' : ' out')}>
                                  {a.roman}
                                  {a.resolution ? <span class="res">{a.resolution === 'sub' ? '⇣' : '↗'}</span> : null}
                                </span>
                              ) : null}
                              {show ? <i class={bracketPart(ci)} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {show ? (
          <div class="legend">
            <span><i />ii–V</span>
            <span><i class="sub" />ii–SubV</span>
            <span><b>↗</b> résout une quarte plus haut</span>
            <span><b>⇣</b> résout un demi-ton plus bas</span>
            <span><b class="sub">bleu</b> hors tonalité</span>
          </div>
        ) : null}

        {sel && selAn ? (
          <div class="chord-card">
            <div class="head">
              <span class="big-sym">{chordSymbol(sel.chord)}</span>
              {show ? <span class="rn-big">{selAn.roman} · {keyName(selAn.key)}</span> : null}
            </div>
            {show ? <p>{selAn.explain}</p> : <p class="muted">Analyse masquée : trouve sa fonction toi-même, puis affiche l'analyse pour vérifier.</p>}
            <div class="notes">Notes de l'accord : {names.map(noteName).join(' · ')}</div>
            <div class="notes">
              Voicing joué : {spellInChord(sel.chord, voicing[0])} à la basse, puis {voicing.slice(1).map((m) => spellInChord(sel.chord, m)).join(' ')}
            </div>
            <Keyboard lo={36} hi={84} marks={marks} labels={labels} center={voicing} />
            <div class="actions">
              <button class="btn" onClick={() => { audio(); playChord(voicing, now() + 0.02, 1.6, 0.55); }}>Écouter</button>
              <button class="btn" onClick={() => { audio(); voicing.forEach((m, i) => playChord([m], now() + 0.02 + i * 0.18, 1.2, 0.55)); }}>Arpège</button>
              <button class="btn" onClick={() => player.start(sel.bar)}>Jouer depuis la mesure {sel.bar + 1}</button>
              <button class="btn quiet" onClick={() => setSelected(null)}>Fermer</button>
            </div>
          </div>
        ) : (
          <p class="muted small">Touche un accord pour l'entendre et voir son rôle dans la grille.</p>
        )}
      </div>

      <PlayerBar p={player} fromBar={selected !== null ? flat[selected].bar : 0} />
    </>
  );
}
