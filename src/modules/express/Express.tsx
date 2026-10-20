// Analyse express : réglages, partie chronométrée, résultat.
import { useEffect, useRef, useState } from 'preact/hooks';
import { chordSymbol } from '../../core/theory/chords';
import { keyLabel } from '../../core/chart/model';
import { playSequence } from '../../core/audio/play';
import { load, save } from '../../core/storage';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { StatBars } from '../../ui/StatBars';
import { SpeakerIcon } from '../../ui/icons';
import { Clock, fmtSec } from '../../ui/Clock';
import { AnswerActions } from '../../ui/AnswerActions';
import { ChordKeys } from '../../ui/ChordKeys';
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
const DEFAULT: Saved = { level: 0, mode: 'sprint', records: {}, byType: {}, byTemplate: {} };

interface Answer {
  q: Question;
  choice: string;
  ok: boolean;
  ms: number;
  /** Juste, mais au hasard (« J'ai deviné ») : compte comme à revoir. */
  guessed?: boolean;
}
/** Réponse vraiment sue. */
const known = (a: Answer) => a.ok && !a.guessed;

const fmt = fmtSec;
const better = (a: RunRecord, b: RunRecord | undefined, mode: RunMode) =>
  !b || a.correct > b.correct || (a.correct === b.correct && (mode === 'serie' ? a.ms < b.ms : a.total < b.total));

const playSeq = (seq: Seq) => playSequence(seq.chords.map((c) => c.chord));

export function Express() {
  const [saved, setSaved] = useState<Saved>(() => load('express', DEFAULT));
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  useEffect(() => save('express', saved), [saved]);

  const finish = (list: Answer[], complete: boolean) => {
    const { level, mode } = saved;
    const res: RunRecord = { correct: list.filter(known).length, total: list.length, ms: list.reduce((s, a) => s + a.ms, 0) };
    const key = `${level}-${mode}`;
    const rec = complete && res.total > 0 && better(res, saved.records[key], mode);
    setNewRecord(rec);
    setAnswers(list);
    setSaved((s) => {
      const byType = { ...s.byType };
      const byTemplate = { ...s.byTemplate };
      list.forEach((a) => {
        const b = byType[a.q.type] ?? { c: 0, t: 0, ms: 0 };
        byType[a.q.type] = { c: b.c + (known(a) ? 1 : 0), t: b.t + 1, ms: b.ms + a.ms };
        const id = a.q.seq.template.id;
        const tt = byTemplate[id] ?? { c: 0, t: 0 };
        byTemplate[id] = { c: tt.c + (known(a) ? 1 : 0), t: tt.t + 1 };
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
        label="Niveau"
        value={level}
        onChange={(v) => setSaved((s) => ({ ...s, level: v }))}
        options={LEVELS.map((l, i) => ({ value: i, label: l.label, sub: l.desc }))}
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

function Play({ saved, onFinish }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void }) {
  const { level, mode } = saved;
  const stats = { types: saved.byType, templates: saved.byTemplate };
  const [queue, setQueue] = useState<Question[]>(() => makeRound(level, Math.random, stats));
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [current, setCurrent] = useState<Answer | null>(null);
  const qStart = useRef(performance.now());
  const spent = useRef(0);
  const done = useRef(false);
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
  };
  // Après chaque réponse, juste ou non, l'explication reste affichée (chrono arrêté) jusqu'au tap.
  const proceed = (guessed: boolean) => {
    const list = guessed ? answers.map((a, i) => (i === answers.length - 1 ? { ...a, guessed: true } : a)) : answers;
    if (guessed) setAnswers(list);
    if (over(list.length)) end(list);
    else next();
  };

  if (!q) return null;
  const long = q.type === 'pattern' || q.type === 'key' || q.type === 'scale';
  const correct = answers.filter(known).length;
  const alsoOk = current?.ok && current.choice !== q.answer;
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={() => end(answers, false)}>
          Arrêter
        </button>
        <span class="play-meta">
          {LEVELS[level]?.label} · {mode === 'sprint' ? `${correct} justes` : `${answers.length + (current ? 0 : 1)}/${SERIE_N}`}
        </span>
        <Clock limitMs={mode === 'sprint' ? SPRINT_MS : undefined} spent={spent} qStart={qStart} paused={!!current} onTimeout={() => end(answers)} />
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
        {current && q.focus !== undefined ? (
          <ChordKeys chord={q.seq.chords[q.focus].chord} extra={q.extraPc} scale={q.type === 'scale' ? q.scaleId : undefined} />
        ) : null}
      </section>

      <h2 class="prompt">{q.prompt}</h2>

      <div class="thumb-zone">
        {current ? (
          <div class="fb">
            <p class={'verdict ' + (current.ok ? 'ok' : 'bad')}>
              {current.ok ? (alsoOk ? `Juste aussi. L’appli conseille : ${q.answer}.` : 'Juste.') : `Non : ${q.answer}.`}
            </p>
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
        {current ? <AnswerActions ok={current.ok} onNext={() => proceed(false)} onGuess={() => proceed(true)} /> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Résultat

function Result({ saved, answers, newRecord, onAgain, onSetup }: { saved: Saved; answers: Answer[]; newRecord: boolean; onAgain: () => void; onSetup: () => void }) {
  const correct = answers.filter(known).length;
  const ms = answers.reduce((s, a) => s + a.ms, 0);
  const wrong = answers.filter((a) => !known(a));
  const per = (Object.keys(QTYPE_LABEL) as QType[])
    .map((t) => {
      const l = answers.filter((a) => a.q.type === t);
      return { t, n: l.length, c: l.filter(known).length, ms: l.reduce((s, a) => s + a.ms, 0) };
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
      {newRecord ? <p class="banner ok">Nouveau record, niveau {LEVELS[saved.level]?.label}.</p> : null}
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
                  {a.ok ? <span class="muted">deviné : </span> : <span class="bad">{a.choice} → </span>}
                  <span class="good">{a.q.answer}</span>
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
