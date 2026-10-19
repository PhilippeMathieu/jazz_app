// Analyse express : réglages, partie chronométrée, résultat.
import { useEffect, useRef, useState } from 'preact/hooks';
import { chordSymbol } from '../../core/theory/chords';
import { keyLabel } from '../../core/chart/model';
import { audio, bass, now, playChord } from '../../core/audio/engine';
import { bassRoot, voiceLead } from '../../core/audio/voicing';
import { load, save } from '../../core/storage';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { StatBars } from '../../ui/StatBars';
import { SpeakerIcon } from '../../ui/icons';
import { LEVELS, QTYPE_LABEL, QType, Question, Seq, Tally, isRight, makeRound } from './drill';

type RunMode = 'sprint' | 'serie';
const SPRINT_MS = 60_000;
const SERIE_N = 20;

interface RunRecord {
  correct: number;
  total: number;
  ms: number;
}
interface Saved {
  level: number;
  mode: RunMode;
  records: Record<string, RunRecord>;
  byType: Record<string, { c: number; t: number; ms: number }>;
  byTemplate: Tally;
}
const DEFAULT: Saved = { level: 1, mode: 'sprint', records: {}, byType: {}, byTemplate: {} };

interface Answer {
  q: Question;
  choice: string;
  ok: boolean;
  ms: number;
}

const fmt = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const better = (a: RunRecord, b: RunRecord | undefined, mode: RunMode) =>
  !b || a.correct > b.correct || (a.correct === b.correct && (mode === 'serie' ? a.ms < b.ms : a.total < b.total));

function playSeq(seq: Seq) {
  audio();
  let prev: number[] | null = null;
  const t0 = now() + 0.05;
  seq.chords.forEach((c, i) => {
    const v = voiceLead(c.chord, prev);
    prev = v;
    bass(bassRoot(c.chord, 36), t0 + i * 1.1, 1.0, 0.8);
    playChord(v, t0 + i * 1.1, 1.0, 0.5);
  });
}

export function Express() {
  const [saved, setSaved] = useState<Saved>(() => load('express', DEFAULT));
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  useEffect(() => save('express', saved), [saved]);

  const finish = (list: Answer[], complete: boolean) => {
    const { level, mode } = saved;
    const res: RunRecord = { correct: list.filter((a) => a.ok).length, total: list.length, ms: list.reduce((s, a) => s + a.ms, 0) };
    const key = `${level}-${mode}`;
    const rec = complete && res.total > 0 && better(res, saved.records[key], mode);
    setNewRecord(rec);
    setAnswers(list);
    setSaved((s) => {
      const byType = { ...s.byType };
      const byTemplate = { ...s.byTemplate };
      list.forEach((a) => {
        const b = byType[a.q.type] ?? { c: 0, t: 0, ms: 0 };
        byType[a.q.type] = { c: b.c + (a.ok ? 1 : 0), t: b.t + 1, ms: b.ms + a.ms };
        const id = a.q.seq.template.id;
        const tt = byTemplate[id] ?? { c: 0, t: 0 };
        byTemplate[id] = { c: tt.c + (a.ok ? 1 : 0), t: tt.t + 1 };
      });
      return { ...s, byType, byTemplate, records: rec ? { ...s.records, [key]: res } : s.records };
    });
    setPhase('done');
  };

  if (phase === 'play') return <Play saved={saved} onFinish={finish} />;
  if (phase === 'done') return <Result saved={saved} answers={answers} newRecord={newRecord} onAgain={() => setPhase('play')} onSetup={() => setPhase('setup')} />;
  return <Setup saved={saved} setSaved={setSaved} onStart={() => setPhase('play')} />;
}

// ---------------------------------------------------------------- Réglages

function Setup({ saved, setSaved, onStart }: { saved: Saved; setSaved: (f: (s: Saved) => Saved) => void; onStart: () => void }) {
  const { level, mode } = saved;
  const rec = saved.records[`${level}-${mode}`];
  const types = (Object.keys(QTYPE_LABEL) as QType[]).filter((t) => saved.byType[t]);
  return (
    <div class="screen">
      <TopBar title="Analyse express" />
      <p class="intro">Une suite d’accords, trois questions dessus, le plus vite possible.</p>
      <Segmented
        cards
        label="Niveau"
        value={level}
        onChange={(v) => setSaved((s) => ({ ...s, level: v }))}
        options={LEVELS.map((l, i) => ({ value: i + 1, label: l.label, sub: l.desc }))}
      />
      <Segmented
        label="Format"
        value={mode}
        onChange={(v) => setSaved((s) => ({ ...s, mode: v }))}
        options={[
          { value: 'sprint', label: 'Sprint 60 s' },
          { value: 'serie', label: `${SERIE_N} questions` }
        ]}
      />
      <p class="muted small">
        Record : {rec ? (mode === 'sprint' ? `${rec.correct} justes sur ${rec.total}` : `${rec.correct}/${rec.total} en ${fmt(rec.ms)}`) : 'aucun pour l’instant'}. Le chrono
        s’arrête pendant les explications.
      </p>
      <button class="btn primary block" onClick={onStart}>
        Démarrer
      </button>
      {types.length ? (
        <section>
          <h2 class="label">Réussite par type de question</h2>
          <StatBars
            rows={types.map((t) => {
              const b = saved.byType[t];
              return { label: QTYPE_LABEL[t], c: b.c, t: b.t, value: `${Math.round((b.c / b.t) * 100)} % · ${fmt(b.ms / b.t)}` };
            })}
          />
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Partie

/** Chrono isolé : il se met à jour sans redessiner tout l'écran. */
function Clock({ mode, spent, qStart, paused, onTimeout }: { mode: RunMode; spent: { current: number }; qStart: { current: number }; paused: boolean; onTimeout: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      tick((t) => t + 1);
      if (mode === 'sprint' && !paused && spent.current + performance.now() - qStart.current >= SPRINT_MS) onTimeout();
    }, 200);
    return () => clearInterval(id);
  }, [paused, mode]);
  const elapsed = spent.current + (paused ? 0 : performance.now() - qStart.current);
  if (mode === 'serie') return <span class="clock">{fmt(elapsed)}</span>;
  const remaining = Math.max(0, SPRINT_MS - elapsed);
  return (
    <span class="clock">
      {Math.ceil(remaining / 1000)} s
      <span class="timebar">
        <span style={`width:${(remaining / SPRINT_MS) * 100}%`} />
      </span>
    </span>
  );
}

function Play({ saved, onFinish }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void }) {
  const { level, mode } = saved;
  const stats = { types: saved.byType, templates: saved.byTemplate };
  const [queue, setQueue] = useState<Question[]>(() => makeRound(level, Math.random, stats));
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [current, setCurrent] = useState<Answer | null>(null);
  const qStart = useRef(performance.now());
  const spent = useRef(0);
  const done = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const end = (list: Answer[], complete = true) => {
    if (done.current) return;
    done.current = true;
    onFinish(list, complete);
  };
  const next = () => {
    setCurrent(null);
    setQueue((qq) => (qq.length > 1 ? qq.slice(1) : makeRound(level, Math.random, stats)));
    qStart.current = performance.now();
  };
  const over = (n: number) => (mode === 'serie' && n >= SERIE_N) || (mode === 'sprint' && spent.current >= SPRINT_MS);

  const q = queue[0];
  const choose = (choice: string) => {
    if (current || !q) return;
    const ms = Math.min(performance.now() - qStart.current, mode === 'sprint' ? SPRINT_MS - spent.current : Infinity);
    spent.current += ms;
    const a: Answer = { q, choice, ok: isRight(q, choice), ms };
    const list = [...answers, a];
    setAnswers(list);
    setCurrent(a);
    // Juste : on enchaîne. Faux : l'explication reste jusqu'à « Continuer ».
    if (a.ok) timer.current = window.setTimeout(() => (over(list.length) ? end(list) : next()), choice === q.answer ? 450 : 1400);
  };

  if (!q) return null;
  const long = q.type === 'pattern' || q.type === 'key' || q.type === 'scale';
  const correct = answers.filter((a) => a.ok).length;
  const alsoOk = current?.ok && current.choice !== q.answer;
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={() => end(answers, false)}>
          Arrêter
        </button>
        <span class="play-meta">
          N{level} · {mode === 'sprint' ? `${correct} justes` : `${answers.length + (current ? 0 : 1)}/${SERIE_N}`}
        </span>
        <Clock mode={mode} spent={spent} qStart={qStart} paused={!!current} onTimeout={() => end(answers)} />
      </header>

      <section class="seqcard">
        <div class="seqhead">
          <span class="muted small">{q.seq.showKey && q.type !== 'key' ? `En ${keyLabel(q.seq.key)}` : 'Tonalité non indiquée'}</span>
          <button class="icon-btn" aria-label="Écouter la suite d’accords" onClick={() => playSeq(q.seq)}>
            <SpeakerIcon />
          </button>
        </div>
        <div class="seqchords">
          {q.seq.chords.map((c, i) => (
            <div key={i} class={'seqchord' + (q.focus === i ? ' focus' : '')}>
              <span class="sym">{chordSymbol(c.chord)}</span>
              <span class="rn">{current ? c.roman : ' '}</span>
            </div>
          ))}
        </div>
      </section>

      <h2 class="prompt">{q.prompt}</h2>

      <div class="thumb-zone">
        {current && (!current.ok || alsoOk) ? (
          <div class="fb">
            <p class={'verdict ' + (current.ok ? 'ok' : 'bad')}>{current.ok ? `Juste aussi. L’appli conseille : ${q.answer}.` : `Non : ${q.answer}.`}</p>
            <p class="muted">{q.explain}</p>
          </div>
        ) : null}
        <div class={'choices' + (long ? ' long' : '') + (q.choices.length === 2 ? ' two' : '')}>
          {q.choices.map((c) => {
            const state = current ? (isRight(q, c) && (c === q.answer || c === current.choice) ? ' is-ok' : c === current.choice ? ' is-bad' : '') : '';
            return (
              <button key={c} class={'choice' + state} disabled={!!current} onClick={() => choose(c)}>
                {c}
              </button>
            );
          })}
        </div>
        {current && !current.ok ? (
          <button class="btn primary block" onClick={() => (over(answers.length) ? end(answers) : next())}>
            Continuer
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Résultat

function Result({ saved, answers, newRecord, onAgain, onSetup }: { saved: Saved; answers: Answer[]; newRecord: boolean; onAgain: () => void; onSetup: () => void }) {
  const correct = answers.filter((a) => a.ok).length;
  const ms = answers.reduce((s, a) => s + a.ms, 0);
  const wrong = answers.filter((a) => !a.ok);
  const per = (Object.keys(QTYPE_LABEL) as QType[])
    .map((t) => {
      const l = answers.filter((a) => a.q.type === t);
      return { t, n: l.length, c: l.filter((a) => a.ok).length, ms: l.reduce((s, a) => s + a.ms, 0) };
    })
    .filter((x) => x.n);
  return (
    <div class="screen">
      <TopBar title="Résultat" onBack={onSetup} />
      <div class="result">
        <div>
          <b>
            {correct}
            <small>/{answers.length}</small>
          </b>
          <span>justes</span>
        </div>
        <div>
          <b>{answers.length ? fmt(ms / answers.length) : '—'}</b>
          <span>par réponse</span>
        </div>
        <div>
          <b>{fmt(ms)}</b>
          <span>de réflexion</span>
        </div>
      </div>
      {newRecord ? <p class="banner ok">Nouveau record en N{saved.level}.</p> : null}
      <StatBars rows={per.map((x) => ({ label: QTYPE_LABEL[x.t], c: x.c, t: x.n, value: `${x.c}/${x.n} · ${fmt(x.ms / x.n)}` }))} />
      <div class="row-actions">
        <button class="btn primary" onClick={onAgain}>
          Rejouer
        </button>
        <button class="btn" onClick={onSetup}>
          Réglages
        </button>
      </div>
      {wrong.length ? (
        <section>
          <h2 class="label">À revoir</h2>
          <div class="list">
            {wrong.map((a, i) => (
              <div class="mistake" key={i}>
                <span class="mono small muted">{a.q.seq.chords.map((c) => chordSymbol(c.chord)).join('  ')}</span>
                <b>{a.q.prompt}</b>
                <span class="small">
                  <span class="bad">{a.choice}</span> → <span class="good">{a.q.answer}</span>
                </span>
                <span class="muted small">{a.q.explain}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
