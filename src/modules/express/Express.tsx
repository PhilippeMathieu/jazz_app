import { useEffect, useRef, useState } from 'preact/hooks';
import { chordSymbol } from '../../core/theory/chords';
import { keyLabel } from '../../core/chart/model';
import { audio, bass, chord as playChord, now } from '../../core/audio/engine';
import { voiceLead, bassRoot } from '../../core/audio/voicing';
import { load, save } from '../../core/storage';
import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';
import { LEVELS, QTYPE_LABEL, QType, Question, Seq, makeRound } from './drill';

type RunMode = 'sprint' | 'serie';
const SPRINT_MS = 60_000;
const SERIE_N = 20;

interface Record_ {
  correct: number;
  total: number;
  ms: number;
}
interface Saved {
  level: number;
  mode: RunMode;
  records: Record<string, Record_>;
  byType: Partial<Record<QType, { c: number; t: number; ms: number }>>;
}
const DEFAULT: Saved = { level: 1, mode: 'sprint', records: {}, byType: {} };

interface Answer {
  q: Question;
  choice: string;
  ok: boolean;
  ms: number;
}

const fmt = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const better = (a: Record_, b: Record_ | undefined, mode: RunMode) =>
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
  const [queue, setQueue] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [current, setCurrent] = useState<Answer | null>(null);
  const [newRecord, setNewRecord] = useState(false);
  const [, setTick] = useState(0);
  const qStart = useRef(0);
  const spent = useRef(0);
  const finished = useRef(false);

  useEffect(() => save('express', saved), [saved]);

  const { level, mode } = saved;
  const q = queue[0];
  const elapsedLive = spent.current + (phase === 'play' && !current ? performance.now() - qStart.current : 0);

  useEffect(() => {
    if (phase !== 'play') return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      if (mode === 'sprint' && !current && spent.current + performance.now() - qStart.current >= SPRINT_MS) finish();
    }, 100);
    return () => clearInterval(id);
  }, [phase, current, mode]);

  const start = () => {
    finished.current = false;
    spent.current = 0;
    setAnswers([]);
    setCurrent(null);
    setNewRecord(false);
    setQueue(makeRound(level));
    setPhase('play');
    qStart.current = performance.now();
  };

  const next = () => {
    if (finished.current) return;
    setCurrent(null);
    setQueue((qq) => {
      const rest = qq.slice(1);
      return rest.length ? rest : makeRound(level);
    });
    qStart.current = performance.now();
  };

  /** complete : la série ou le sprint est allé au bout (seul cas où un record compte). */
  const finish = (list: Answer[] = answers, complete = true) => {
    if (finished.current) return;
    finished.current = true;
    const res: Record_ = { correct: list.filter((a) => a.ok).length, total: list.length, ms: list.reduce((s, a) => s + a.ms, 0) };
    const key = `${level}-${mode}`;
    const rec = complete && res.total > 0 && better(res, saved.records[key], mode);
    setNewRecord(rec);
    setSaved((s) => {
      const byType = { ...s.byType };
      list.forEach((a) => {
        const b = byType[a.q.type] ?? { c: 0, t: 0, ms: 0 };
        byType[a.q.type] = { c: b.c + (a.ok ? 1 : 0), t: b.t + 1, ms: b.ms + a.ms };
      });
      return { ...s, byType, records: rec ? { ...s.records, [key]: res } : s.records };
    });
    setPhase('done');
  };

  const choose = (choice: string) => {
    if (current || !q) return;
    const ms = Math.min(performance.now() - qStart.current, mode === 'sprint' ? SPRINT_MS - spent.current : Infinity);
    spent.current += ms;
    const a: Answer = { q, choice, ok: choice === q.answer, ms };
    const list = [...answers, a];
    setAnswers(list);
    setCurrent(a);
    const over = (mode === 'serie' && list.length >= SERIE_N) || (mode === 'sprint' && spent.current >= SPRINT_MS);
    // Bonne réponse : on enchaîne. Mauvaise : l'explication reste affichée jusqu'à « Continuer ».
    if (a.ok) window.setTimeout(() => (over ? finish(list) : next()), 450);
  };

  // ------------------------------------------------------------ Réglages
  if (phase === 'setup') {
    const rec = saved.records[`${level}-${mode}`];
    const types = (Object.keys(QTYPE_LABEL) as QType[]).filter((t) => saved.byType[t]);
    return (
      <div class="screen">
        <div class="topbar">
          <button class="back" aria-label="Retour" onClick={() => go('/')}><BackIcon /></button>
          <h1>Analyse express</h1>
        </div>
        <p class="muted small" style="margin:0">
          Une suite d'accords, trois questions dessus, le plus vite possible : degré, schéma, tonalité, 9 ou ♭9, guide tones, gamme.
        </p>
        <div class="levels three">
          {LEVELS.map((l, i) => (
            <button key={i} class="lv" aria-pressed={level === i + 1} onClick={() => setSaved((s) => ({ ...s, level: i + 1 }))}>
              <b>{l.label}</b>
              <span>{l.desc}</span>
            </button>
          ))}
        </div>
        <div class="seg wide" role="group" aria-label="Mode">
          <button aria-pressed={mode === 'sprint'} onClick={() => setSaved((s) => ({ ...s, mode: 'sprint' }))}>Sprint 60 s</button>
          <button aria-pressed={mode === 'serie'} onClick={() => setSaved((s) => ({ ...s, mode: 'serie' }))}>Série de {SERIE_N}</button>
        </div>
        <p class="muted small" style="margin:0">
          {mode === 'sprint'
            ? 'Un maximum de bonnes réponses en 60 secondes de réflexion. Le chrono s’arrête pendant les explications.'
            : `${SERIE_N} questions, chronométrées. Le chrono s’arrête pendant les explications.`}
        </p>
        <div class="record">
          <span class="eyebrow">Record N{level} · {mode === 'sprint' ? 'sprint' : 'série'}</span>
          <b>
            {rec
              ? mode === 'sprint'
                ? `${rec.correct} bonnes réponses sur ${rec.total}`
                : `${rec.correct}/${rec.total} en ${fmt(rec.ms)}`
              : 'Aucun pour l’instant'}
          </b>
        </div>
        <button class="next" onClick={start}>Démarrer</button>

        {types.length ? (
          <section class="stats">
            <h2>Par type de question</h2>
            <div class="bars">
              {types.map((t) => {
                const b = saved.byType[t]!;
                const acc = b.c / b.t;
                const col = acc >= 0.8 ? 'var(--ok)' : acc >= 0.5 ? 'var(--accent)' : 'var(--bad)';
                return (
                  <div class="statbar" key={t}>
                    <span class="lb">{QTYPE_LABEL[t]}</span>
                    <span class="tr"><span class="fl" style={`width:${Math.max(4, acc * 100)}%;background:${col}`} /></span>
                    <span class="v">{Math.round(acc * 100)} % · {fmt(b.ms / b.t)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  // ------------------------------------------------------------ Résultats
  if (phase === 'done') {
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
        <div class="topbar">
          <button class="back" aria-label="Retour" onClick={() => setPhase('setup')}><BackIcon /></button>
          <h1>Résultat</h1>
        </div>
        <div class="result">
          <div><b>{correct}<small>/{answers.length}</small></b><span>bonnes réponses</span></div>
          <div><b>{answers.length ? fmt(ms / answers.length) : '—'}</b><span>par réponse</span></div>
          <div><b>{fmt(ms)}</b><span>de réflexion</span></div>
        </div>
        {newRecord ? <div class="nudge"><span>Nouveau record en N{level}.</span></div> : null}
        <div class="bars">
          {per.map((x) => {
            const acc = x.c / x.n;
            const col = acc >= 0.8 ? 'var(--ok)' : acc >= 0.5 ? 'var(--accent)' : 'var(--bad)';
            return (
              <div class="statbar" key={x.t}>
                <span class="lb">{QTYPE_LABEL[x.t]}</span>
                <span class="tr"><span class="fl" style={`width:${Math.max(4, acc * 100)}%;background:${col}`} /></span>
                <span class="v">{x.c}/{x.n} · {fmt(x.ms / x.n)}</span>
              </div>
            );
          })}
        </div>
        <div style="display:flex;gap:8px">
          <button class="next" style="flex:1" onClick={start}>Rejouer</button>
          <button class="btn" onClick={() => setPhase('setup')}>Réglages</button>
        </div>
        {wrong.length ? (
          <section class="stats">
            <h2>À revoir</h2>
            <div class="mistakes">
              {wrong.map((a, i) => (
                <div class="mistake" key={i}>
                  <div class="mono small">{a.q.seq.chords.map((c) => chordSymbol(c.chord)).join('  ')}</div>
                  <b>{a.q.prompt}</b>
                  <div class="small">
                    <span class="verdict bad">{a.choice}</span> → <span class="verdict ok">{a.q.answer}</span>
                  </div>
                  <p class="hint">{a.q.explain}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  // ------------------------------------------------------------ Jeu
  if (!q) return null;
  const remaining = Math.max(0, SPRINT_MS - elapsedLive);
  const focus = q.focus;
  const long = q.type === 'pattern' || q.type === 'key' || q.type === 'scale';
  const correctSoFar = answers.filter((a) => a.ok).length;
  return (
    <div class="screen play-screen">
      <div class="topbar">
        <button class="back" aria-label="Arrêter" onClick={() => finish(answers, false)}><BackIcon /></button>
        <h1>N{level}</h1>
        <div class="score">
          <div>
            <span>{mode === 'sprint' ? Math.ceil(remaining / 1000) + ' s' : fmt(elapsedLive)}</span>
            <small>{mode === 'sprint' ? 'restant' : 'chrono'}</small>
          </div>
          <div>
            <span>{mode === 'sprint' ? correctSoFar : `${answers.length + (current ? 0 : 1)}/${SERIE_N}`}</span>
            <small>{mode === 'sprint' ? 'justes' : 'question'}</small>
          </div>
        </div>
      </div>
      {mode === 'sprint' ? (
        <div class="timebar"><span style={`width:${(remaining / SPRINT_MS) * 100}%`} /></div>
      ) : null}

      <section class="seqcard">
        <div class="seqhead">
          <span class="eyebrow">{q.seq.showKey && q.type !== 'key' ? `En ${keyLabel(q.seq.key)}` : 'Tonalité non indiquée'}</span>
          <button class="chip" onClick={() => playSeq(q.seq)}>Écouter</button>
        </div>
        <div class="seqchords">
          {q.seq.chords.map((c, i) => (
            <div key={i} class={'seqchord' + (focus === i ? ' focus' : '')}>
              <span class="sym">{chordSymbol(c.chord)}</span>
              <span class="rn">{current ? c.roman : ' '}</span>
            </div>
          ))}
        </div>
      </section>

      <h2 class="prompt">{q.prompt}</h2>

      {/* Zone de réponse en bas d'écran : à portée du pouce, téléphone tenu d'une main. */}
      <div class="thumb-zone">
        {current && !current.ok ? (
          <div class="fb">
            <p class="verdict bad">Réponse : {q.answer}</p>
            <p class="hint">{q.explain}</p>
          </div>
        ) : null}
        <div class={'choices' + (long ? ' long' : '') + (q.choices.length === 2 ? ' two' : '')}>
          {q.choices.map((c) => {
            const state = current ? (c === q.answer ? ' is-ok' : c === current.choice ? ' is-bad' : '') : '';
            return (
              <button key={c} class={'choice' + state} disabled={!!current} onClick={() => choose(c)}>
                {c}
              </button>
            );
          })}
        </div>
        {current && !current.ok ? (
          <button
            class="next"
            onClick={() => {
              const over = (mode === 'serie' && answers.length >= SERIE_N) || (mode === 'sprint' && spent.current >= SPRINT_MS);
              if (over) finish();
              else next();
            }}
          >
            Continuer
          </button>
        ) : null}
      </div>
    </div>
  );
}
