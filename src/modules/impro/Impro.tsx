// Impro guidée : la boucle tourne (basse et batterie), l'élève improvise à la main droite sur quelques notes
// permises, une consigne par passage. Le micro compte les notes dans la gamme, les silences, le rythme imposé et
// les notes de l'accord sur le 1er temps. « Exemple » : l'appli improvise d'abord, pour entendre ce qu'on attend.
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio, bass, drum, now, piano, playChord } from '../../core/audio/engine';
import { chordPcs, chordSymbol, rootPc } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { report } from '../../core/events';
import { listenOnsets, micGate, readMono, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { NoteTracker } from '../../core/listen/tracker';
import { Ev, backingBar, schedule } from '../../core/rhythm/play';
import { swingRatio } from '../../core/rhythm/patterns';
import { tolerance } from '../../core/rhythm/timing';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { MicPill } from '../../ui/MicPill';
import { PlayIcon } from '../../ui/icons';
import { useWakeLock } from '../../ui/wakeLock';
import { micOffset } from '../reglages/Calibrate';
import { IMPRO, ImproLevel, TakeNote, TakeResult, barsOf, exampleLine, scaleOf, scoreTake, tipOf } from './impro';

type Phase = 'ready' | 'count' | 'play' | 'result';

/** Le rythme imposé en mots : « 1, 2-et, 4 | 1 ». */
const rhythmText = (r: number[]) =>
  [0, 1]
    .map((bar) =>
      r
        .filter((e) => Math.floor(e / 8) === bar)
        .map((e) => `${Math.floor((e % 8) / 2) + 1}${e % 2 ? '-et' : ''}`)
        .join(', ') || '–'
    )
    .join(' | ');
const LO = 53;
const HI = 84;

export function ImproRun({ level, onExit }: { level: string; onExit: () => void }) {
  useMicRelease();
  const l = IMPRO[level];
  return l ? <Run l={l} onEnd={onExit} /> : null;
}

function Run({ l, onEnd }: { l: ImproLevel; onEnd: () => void }) {
  const [take, setTake] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [demo, setDemo] = useState(false);
  const [pos, setPos] = useState<{ bar: number; beat: number } | null>(null);
  const [result, setResult] = useState<TakeResult | null>(null);
  const [early, setEarly] = useState(false);
  const [last, setLast] = useState<number | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const mic = useMicState();
  const listening = mic === 'on';
  const stopRef = useRef<(() => void) | null>(null);
  const timers = useRef<number[]>([]);
  const unlisten = useRef<(() => void) | null>(null);
  const tracker = useRef(new NoteTracker());
  const notes = useRef<TakeNote[]>([]);
  const onsets = useRef<number[]>([]);
  const startAt = useRef(0);
  useWakeLock(true);
  const spb = 60 / l.tempo;
  const swing = l.feel === 'swing' ? swingRatio(l.tempo) : 0.5;
  const chords = barsOf(l);
  const scale = scaleOf(l);

  const stopAll = () => {
    stopRef.current?.();
    stopRef.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    unlisten.current?.();
    unlisten.current = null;
  };
  useEffect(() => () => stopAll(), []);

  /** Décompte d'une mesure, puis le passage. demo : l'appli improvise, rien n'est mesuré. */
  const go = (isDemo: boolean) => {
    stopAll();
    audio();
    setDemo(isDemo);
    setResult(null);
    setEarly(false);
    setLast(null);
    const t0 = now() + 0.25;
    const start = t0 + 4 * spb;
    startAt.current = start;
    const evs: Ev[] = [];
    for (let b = 0; b < 4; b++) evs.push({ t: t0 + b * spb, run: (x) => drum('pedal', x, b === 0 ? 0.4 : 0.3) });
    // Sans micro (ou pour l'exemple), un accord doux fait entendre la boucle ; micro ouvert, basse et batterie
    // seulement, pour que le micro n'entende que le piano.
    const pad = isDemo || !listening;
    chords.forEach((c, bar) => {
      const tb = start + bar * 4 * spb;
      backingBar(evs, tb, spb, l.feel, l.tempo);
      const r = rootPc(c);
      const root = 36 + mod(r - 36, 12) - (mod(r - 36, 12) > 7 ? 12 : 0);
      evs.push({ t: tb, run: (x) => bass(root, x, 1.8 * spb, 0.8) });
      evs.push({ t: tb + 2 * spb, run: (x) => bass(l.feel === 'swing' ? root + 7 : root, x, 1.8 * spb, 0.7) });
      if (pad) {
        const v = chordPcs(c).map((p) => 48 + mod(p - 48, 12) + (mod(p - 48, 12) < 5 ? 12 : 0)).sort((a, b) => a - b);
        evs.push({ t: tb, run: (x) => playChord(v, x, 3.8 * spb, 0.22, 0.01) });
      }
    });
    if (isDemo)
      for (const n of exampleLine(l, swing)) {
        evs.push({ t: start + n.beat * spb, run: (x) => piano(n.midi, x, n.dur * spb, 0.62) });
        // La note de l'exemple s'allume au clavier.
        timers.current.push(window.setTimeout(() => setLast(n.midi), (start + n.beat * spb - now()) * 1000));
      }
    stopRef.current = schedule(evs);
    const end = start + l.bars * 4 * spb;
    for (let b = 0; b < l.bars * 4; b++) timers.current.push(window.setTimeout(() => setPos({ bar: Math.floor(b / 4), beat: b % 4 }), (start + b * spb - now()) * 1000));
    timers.current.push(window.setTimeout(() => setPhase('play'), (start - now()) * 1000));
    setPhase('count');
    setPos(null);
    if (!isDemo && listening) {
      notes.current = [];
      onsets.current = [];
      tracker.current = new NoteTracker();
      unlisten.current = listenOnsets((t) => onsets.current.push(t));
    }
    timers.current.push(
      window.setTimeout(() => {
        setPos(null);
        unlisten.current?.();
        unlisten.current = null;
        if (isDemo || !listening) {
          setPhase('ready');
          return;
        }
        const off = micOffset() / 1000;
        const ns = notes.current.map((n) => ({ ...n, t: n.t - off }));
        const os = onsets.current.map((t) => t - start - off);
        const res = scoreTake(l, ns, os, spb, swing, Math.max(70, tolerance(l.tempo) * 1.5));
        // Des notes pendant le décompte : le micro entend sans doute l'accompagnement.
        setEarly(ns.filter((n) => n.t < -0.5 * spb).length >= 3);
        setResult(res);
        setPhase('result');
        setTake((n) => n + 1);
        setScore((x) => ({ ok: x.ok + (res.ok ? 1 : 0), total: x.total + 1 }));
        report({ type: 'answer', exo: 'impro', level: Object.keys(IMPRO).indexOf(l.id), ok: res.ok, ms: (end - start) * 1000 });
      }, (end - now() + 0.6) * 1000)
    );
  };

  // Les notes de la main droite, une à la fois, datées depuis le 1er temps du passage.
  useMicLoop(
    listening && !demo && (phase === 'count' || phase === 'play'),
    () => {
      const m = readMono();
      if (!m) return;
      const ev = tracker.current.push(m.pitch, m.level, now() * 1000, micGate());
      // Sous F3 : la contrebasse de l'accompagnement, pas la main droite.
      if (!ev || ev.midi < LO) return;
      // Confirmée ~0,1 s après l'attaque.
      notes.current.push({ t: ev.t / 1000 - 0.1 - startAt.current, midi: ev.midi });
      setLast(ev.midi);
    },
    50
  );

  const curBar = pos?.bar ?? (phase === 'count' ? 0 : -1);
  const shown = chords[Math.max(0, curBar)];
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  const targets = l.target ? chordPcs(shown) : [];
  for (let m = LO; m <= HI; m++) {
    const i = scale.indexOf(mod(m, 12));
    if (i < 0) continue;
    marks[m] = targets.includes(mod(m, 12)) ? 'sel' : 'soft';
    labels[m] = l.names[i];
  }
  if (last !== null && phase !== 'result') marks[last] = scale.includes(mod(last, 12)) ? 'ok' : 'bad';
  const resting = curBar >= 0 && !!l.rests?.includes(curBar);

  return (
    <div class="screen play-screen impro-run">
      <header class="topbar">
        <button
          class="btn ghost sm"
          onClick={() => {
            stopAll();
            onEnd();
          }}
        >
          Arrêter
        </button>
        <span class="play-meta">
          Passage {take + (phase === 'result' ? 0 : 1)}
          {score.total ? ` · ${score.ok}/${score.total} réussi${score.ok > 1 ? 's' : ''}` : ''}
        </span>
        <MicPill echo />
      </header>
      <section class="impro-head">
        <p class="impro-name">{l.name}</p>
        <p class="muted small">{l.notesText}</p>
        <p class="impro-tip">{tipOf(l, take)}</p>
        {l.rhythm ? <p class="small">Rythme imposé, sur 2 mesures : <b>{rhythmText(l.rhythm)}</b></p> : null}
      </section>
      <div class="comp-grid impro-grid">
        {chords.map((c, bar) => (
          <div key={bar} class={'comp-bar' + (bar === curBar ? ' cur' : '') + (l.rests?.includes(bar) ? ' rest' : '')}>
            <b class="sym">{chordSymbol(c)}</b>
            {l.rests?.includes(bar) ? <small>silence</small> : null}
            {l.rhythm ? (
              <span class="comp-cells">
                {Array.from({ length: 8 }, (_, e) => {
                  const on = l.rhythm!.includes((bar % 2) * 8 + e);
                  const now = pos?.bar === bar && Math.floor(e / 2) === pos.beat;
                  return <i key={e} class={(on ? 'on' : '') + (now ? ' now' : '') + (e % 2 ? '' : ' beat')} />;
                })}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {phase !== 'result' ? <Keyboard lo={LO} hi={HI} fit marks={marks} labels={labels} /> : null}
      {phase === 'count' ? (
        <p class="phase-line">{demo ? 'Exemple : écoute, l’appli improvise.' : 'Décompte : 1, 2, 3, 4…'}</p>
      ) : phase === 'play' ? (
        <p class="phase-line">{demo ? 'Exemple : écoute, l’appli improvise.' : resting ? 'Silence : écoute la boucle.' : listening ? 'Improvise ! Le micro écoute.' : 'Improvise ! (micro coupé : rien n’est mesuré)'}</p>
      ) : null}
      {result ? (
        <div class="fb">
          <p class={'verdict ' + (result.ok ? 'ok' : 'bad')}>{result.ok ? 'Réussi.' : 'Pas encore.'}</p>
          <p class="muted">
            {result.notes} notes · {result.inScale} % dans les notes permises · {result.breaths} respiration{result.breaths > 1 ? 's' : ''}
            {result.rests !== undefined ? ` · silences tenus : ${result.rests} %` : ''}
            {result.rhythm !== undefined ? ` · rythme : ${result.rhythm} %` : ''}
            {result.targets !== undefined ? ` · 1ers temps visés : ${result.targets} %` : ''}
          </p>
          {result.fix.map((t) => (
            <p key={t} class="small">
              {t}
            </p>
          ))}
          {result.ok ? <p class="muted small">Prochain passage : une nouvelle consigne, en haut.</p> : null}
          {early ? <p class="banner warn">Le micro a entendu des notes pendant le décompte : il capte sans doute l’accompagnement. Mets un écouteur, ou baisse le volume.</p> : null}
        </div>
      ) : null}
      <div class="thumb-zone">
        {phase === 'ready' || phase === 'result' ? (
          <div class="row-actions">
            <button class="btn" onClick={() => go(true)}>
              <PlayIcon /> Exemple
            </button>
            <button class="btn primary grow" onClick={() => go(false)}>
              {phase === 'result' ? 'Passage suivant' : 'Jouer'}
            </button>
          </div>
        ) : (
          <div class="row-actions">
            <button
              class="btn grow"
              onClick={() => {
                stopAll();
                setPos(null);
                setPhase('ready');
              }}
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
