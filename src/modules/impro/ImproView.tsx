import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chart, keyLabel, keyName, transposeChart } from '../../core/chart/model';
import { NoteClass, classifyNote, guideTones, improvPlan, isGuideTone } from '../../core/analysis/improv';
import { QUALITIES, chordPcs, chordSymbol, degreeLabel, spellInChord } from '../../core/theory/chords';
import { mod, noteName, pcOf, signedPc } from '../../core/theory/notes';
import { SCALES, scaleNotes } from '../../core/theory/scales';
import { audio, chord as playChord, now } from '../../core/audio/engine';
import { displayVoicing } from '../../core/audio/voicing';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';
import { PlayerBar, usePlayer } from '../../ui/PlayerBar';
import { Stand } from '../../ui/Stand';
import { micSettings, readMono, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { NoteTracker } from '../../core/listen/tracker';
import { MicToggle } from '../micro/Micro';

interface Hit {
  pc: number;
  cls: NoteClass;
  guide: boolean;
}
const CLS_LABEL: Record<NoteClass, string> = { chord: 'note de l’accord', scale: 'note de la gamme', out: 'hors gamme' };

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
  const [stand, setStand] = useState(false);
  const chart = useMemo(() => transposeChart(original, shift), [original, shift]);
  const plan = useMemo(() => improvPlan(chart), [chart]);
  const player = usePlayer(chart, original.id, original.tempo);
  const live = useRef<HTMLDivElement>(null);
  const n = plan.flat.length;
  const cur = player.pos ? player.pos.chord : Math.min(selected, n - 1);
  const nx = (cur + 1) % n;

  // ---------------------------------------------------------------- Écoute
  const mic = useMicState();
  useMicRelease();
  const listening = mic === 'on';
  const tracker = useRef(new NoteTracker(micSettings().gate));
  const posHist = useRef<{ t: number; chord: number; chorus: number }[]>([]);
  const [log, setLog] = useState<Record<string, Hit[]>>({});
  const [visited, setVisited] = useState<string[]>([]);
  const [lastNote, setLastNote] = useState<{ name: string; deg: string; cls: NoteClass; guide: boolean } | null>(null);
  const [lastChorus, setLastChorus] = useState(0);
  const playing = !!player.pos;

  // Nouvelle lecture : on repart de zéro.
  useEffect(() => {
    if (!playing) return;
    setLog({});
    setVisited([]);
    setLastNote(null);
    posHist.current = [];
    tracker.current = new NoteTracker(micSettings().gate);
  }, [playing]);

  useEffect(() => {
    const p = player.pos;
    if (!p) return;
    posHist.current = [...posHist.current.slice(-12), { t: performance.now(), chord: p.chord, chorus: p.chorus }];
    setLastChorus(p.chorus);
    if (listening) setVisited((v) => [...v, `${p.chorus}:${p.chord}`]);
  }, [player.pos?.chord, player.pos?.chorus]);

  useMicLoop(listening && playing, () => {
    const m = readMono(tracker.current.gate);
    if (!m) return;
    const ev = tracker.current.push(m.pitch, m.level, performance.now());
    if (!ev) return;
    // La note est confirmée ~0,1 s après l'attaque : on l'attribue à l'accord joué à ce moment-là.
    const t = ev.t - 120;
    const hist = posHist.current;
    const h = [...hist].reverse().find((x) => x.t <= t) ?? hist[hist.length - 1];
    if (!h) return;
    const ch = plan.flat[h.chord].chord;
    const pc = ev.midi % 12;
    const hit: Hit = { pc, cls: classifyNote(pc, ch, plan.scales[h.chord].scale), guide: isGuideTone(pc, ch) };
    const key = `${h.chorus}:${h.chord}`;
    setLog((l) => ({ ...l, [key]: [...(l[key] ?? []), hit] }));
    setLastNote({ name: spellInChord(ch, pc), deg: degreeLabel(ch, pc), cls: hit.cls, guide: hit.guide });
  }, 50);

  const allHits = Object.values(log).flat();
  const pct = (k: NoteClass) => (allHits.length ? Math.round((allHits.filter((h) => h.cls === k).length / allHits.length) * 100) : 0);
  const visitedKeys = [...new Set(visited)];
  const doneKeys = visitedKeys.slice(0, playing ? -1 : undefined);
  const guideHits = doneKeys.filter((k) => (log[k] ?? []).some((h) => h.guide)).length;
  const shownChorus = player.pos?.chorus ?? lastChorus;

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
          <button class="btn" onClick={() => setStand(true)}>Pupitre</button>
        </div>
        <div class="listen-bar">
          <MicToggle />
          {listening ? (
            <p class="small muted" style="margin:0">
              Joue la main droite seule. Avec des écouteurs, garde tout l'accompagnement ; sans écouteurs, le micro entend aussi le haut-parleur :{' '}
              {player.prefs.comp || player.prefs.bass ? (
                <button
                  class="linkbtn"
                  onClick={() => {
                    if (player.prefs.comp) player.flip('comp');
                    if (player.prefs.bass) player.flip('bass');
                  }}
                >
                  couper piano et basse
                </button>
              ) : (
                'piano et basse coupés.'
              )}
            </p>
          ) : (
            <p class="small muted" style="margin:0">L'appli peut écouter ta main droite et vérifier tes notes pendant le play-along.</p>
          )}
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
          {listening ? (
            <div class={'heard-line ' + (lastNote ? (mode === 'guide' ? (lastNote.guide ? 'chord' : 'out') : lastNote.cls) : '')}>
              <i class="rec" />
              {lastNote ? (
                <span>
                  <b>{lastNote.name}</b> ({lastNote.deg}) · {mode === 'guide' ? (lastNote.guide ? 'guide tone' : 'pas une guide tone') : CLS_LABEL[lastNote.cls]}
                </span>
              ) : (
                <span class="muted">{playing ? 'J’écoute ta main droite…' : 'Lance le play-along pour que l’écoute démarre.'}</span>
              )}
            </div>
          ) : null}
          <div class="next-line">Ensuite : {nextLabel}</div>
        </div>

        {listening && allHits.length ? (
          <div class="summary">
            {mode === 'gammes' ? (
              <>
                <span><b>{allHits.length}</b> notes</span>
                <span class="s-chord"><b>{pct('chord')} %</b> accord</span>
                <span class="s-scale"><b>{pct('scale')} %</b> gamme</span>
                <span class="s-out"><b>{pct('out')} %</b> hors gamme</span>
              </>
            ) : (
              <>
                <span><b>{guideHits}/{doneKeys.length}</b> accords avec une guide tone</span>
                <span class="s-chord"><b>{allHits.length ? Math.round((allHits.filter((h) => h.guide).length / allHits.length) * 100) : 0} %</b> des notes</span>
              </>
            )}
          </div>
        ) : null}

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
                        {idxs.map((ci) => {
                          const key = `${shownChorus}:${ci}`;
                          const hits = listening ? log[key] ?? [] : [];
                          const done = listening && doneKeys.includes(key);
                          const gState = mode === 'guide' && done ? (hits.some((h) => h.guide) ? ' g-hit' : ' g-miss') : '';
                          return (
                            <button key={ci} data-ci={ci} class={'ch' + (cur === ci ? ' now' : '') + (!player.pos && selected === ci ? ' sel' : '') + gState} onClick={() => preview(ci)}>
                              <span class="sym">{chordSymbol(plan.flat[ci].chord)}</span>
                              <span class="rn">
                                {mode === 'gammes' ? SCALES[plan.scales[ci].scale].short : `${plan.guideA[ci].name} · ${plan.guideB[ci].name}`}
                              </span>
                              {hits.length ? (
                                <span class="hits">
                                  {hits.slice(-8).map((h, i) => (
                                    <i key={i} class={mode === 'guide' ? (h.guide ? 'chord' : 'out') : h.cls} />
                                  ))}
                                </span>
                              ) : null}
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

        <section class="tips">
          <h2>Comment travailler</h2>
          <ol>
            {TIPS[mode].map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </section>
      </div>
      <PlayerBar p={player} fromBar={player.pos ? 0 : plan.flat[Math.min(selected, n - 1)].bar} />
      {stand ? <Stand chart={chart} player={player} initial={mode} startIndex={cur} onClose={() => setStand(false)} /> : null}
    </>
  );
}
