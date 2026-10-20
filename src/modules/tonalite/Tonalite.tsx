// Accords de la tonalité : réglages, partie chronométrée, résultat.
import { useEffect, useRef, useState } from 'preact/hooks';
import { keyLabel, keyName } from '../../core/chart/model';
import { QUALITIES } from '../../core/theory/chords';
import { noteName } from '../../core/theory/notes';
import { playOne } from '../../core/audio/play';
import { load, save } from '../../core/storage';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { StatBars } from '../../ui/StatBars';
import { Clock, fmtSec } from '../../ui/Clock';
import { SpeakerIcon } from '../../ui/icons';
import { AnswerActions } from '../../ui/AnswerActions';
import { DegQuality, LEVELS, MAJOR, MINOR, Question, Tally, chordOf, choicesFor, harmonize, makeQuestion } from './drill';

type RunMode = 'sprint' | 'serie';
const SPRINT_MS = 60_000;
const SERIE_N = 20;

interface RunRecord {
  correct: number;
  total: number;
  ms: number;
}
type Timed = Record<string, { c: number; t: number; ms: number }>;
interface Saved {
  level: number;
  mode: RunMode;
  records: Record<string, RunRecord>;
  /** Par couple tonalité-degré : sert au tirage. */
  items: Tally;
  /** Par degré (« M:IIIm7 », « m:V7 ») et par tonalité (« D », « Am »). */
  byDeg: Timed;
  byKey: Timed;
}
const DEFAULT: Saved = { level: 1, mode: 'sprint', records: {}, items: {}, byDeg: {}, byKey: {} };

interface Answer {
  q: Question;
  choice: DegQuality;
  ok: boolean;
  ms: number;
  /** Juste, mais au hasard : compte comme à revoir. */
  guessed?: boolean;
}
const known = (a: Answer) => a.ok && !a.guessed;

const degKey = (q: Question) => `${q.key.mode === 'major' ? 'M' : 'm'}:${q.degree.roman}`;
const symOf = (q: DegQuality) => QUALITIES[q].sym;
const better = (a: RunRecord, b: RunRecord | undefined, mode: RunMode) =>
  !b || a.correct > b.correct || (a.correct === b.correct && (mode === 'serie' ? a.ms < b.ms : a.total < b.total));

/** Degrés dans l'ordre, pour les statistiques. */
const DEG_ORDER = [...MAJOR.map((d) => ({ id: 'M:' + d.roman, label: d.roman })), ...MINOR.map((d) => ({ id: 'm:' + d.roman, label: d.roman + ' (mineur)' }))];

function add(t: Timed, k: string, ok: boolean, ms: number): Timed {
  const b = t[k] ?? { c: 0, t: 0, ms: 0 };
  return { ...t, [k]: { c: b.c + (ok ? 1 : 0), t: b.t + 1, ms: b.ms + ms } };
}

export function Tonalite() {
  const [saved, setSaved] = useState<Saved>(() => load('tonalite', DEFAULT));
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  useEffect(() => save('tonalite', saved), [saved]);

  const finish = (list: Answer[], complete: boolean) => {
    const { level, mode } = saved;
    const res: RunRecord = { correct: list.filter(known).length, total: list.length, ms: list.reduce((s, a) => s + a.ms, 0) };
    const rk = `${level}-${mode}`;
    const rec = complete && res.total > 0 && better(res, saved.records[rk], mode);
    setNewRecord(rec);
    setAnswers(list);
    setSaved((s) => {
      let { items, byDeg, byKey } = s;
      list.forEach((a) => {
        const it = items[a.q.id] ?? { c: 0, t: 0 };
        items = { ...items, [a.q.id]: { c: it.c + (known(a) ? 1 : 0), t: it.t + 1 } };
        byDeg = add(byDeg, degKey(a.q), known(a), a.ms);
        byKey = add(byKey, keyName(a.q.key), known(a), a.ms);
      });
      return { ...s, items, byDeg, byKey, records: rec ? { ...s.records, [rk]: res } : s.records };
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
  const degs = DEG_ORDER.filter((d) => saved.byDeg[d.id]);
  const keys = Object.entries(saved.byKey)
    .filter(([, v]) => v.t >= 3)
    .map(([k, v]) => ({ k, v, score: v.c / v.t - v.ms / v.t / 20000 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
  return (
    <div class="screen">
      <TopBar title="Accords de la tonalité" />
      <p class="intro">Une tonalité, une fondamentale : trouve le type d’accord. En D majeur, F♯ → m7.</p>
      <Segmented
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
        Record : {rec ? (mode === 'sprint' ? `${rec.correct} justes sur ${rec.total}` : `${rec.correct}/${rec.total} en ${fmtSec(rec.ms)}`) : 'aucun pour l’instant'}.
      </p>
      <button class="btn primary block" onClick={onStart}>
        Démarrer
      </button>
      <details class="help">
        <summary>Le truc à retenir</summary>
        <p class="small">
          <b>Majeur</b> : <span class="mono">Δ7 m7 m7 Δ7 7 m7 ø7</span> (I à VII).
        </p>
        <p class="small">
          <b>Mineur</b> : <span class="mono">m7 ø7 Δ7 m7 7 Δ7 7</span>, plus <span class="mono">°7</span> sur la sensible (VII). Le V est 7, pas m7 : c’est la
          sensible du mineur harmonique.
        </p>
      </details>
      {degs.length ? (
        <section>
          <h2 class="label">Réussite par degré</h2>
          <StatBars rows={degs.map((d) => ({ label: d.label, c: saved.byDeg[d.id].c, t: saved.byDeg[d.id].t, value: valueOf(saved.byDeg[d.id]) }))} />
        </section>
      ) : null}
      {keys.length ? (
        <section>
          <h2 class="label">Tonalités à travailler</h2>
          <StatBars rows={keys.map(({ k, v }) => ({ label: k.endsWith('m') ? `${k.slice(0, -1)} mineur` : `${k} majeur`, c: v.c, t: v.t, value: valueOf(v) }))} />
        </section>
      ) : null}
    </div>
  );
}
const valueOf = (v: { c: number; t: number; ms: number }) => `${Math.round((v.c / v.t) * 100)} % · ${fmtSec(v.ms / v.t)}`;

// ---------------------------------------------------------------- Partie

function Play({ saved, onFinish }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void }) {
  const { level, mode } = saved;
  const tally = useRef<Tally>({ ...saved.items });
  const [q, setQ] = useState<Question>(() => makeQuestion(level, tally.current));
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
    setQ((p) => makeQuestion(level, tally.current, Math.random, p.id));
    qStart.current = performance.now();
  };
  const over = (n: number) => (mode === 'serie' && n >= SERIE_N) || (mode === 'sprint' && spent.current >= SPRINT_MS);

  const choose = (choice: DegQuality) => {
    if (current) return;
    const ms = Math.min(performance.now() - qStart.current, mode === 'sprint' ? SPRINT_MS - spent.current : Infinity);
    spent.current += ms;
    const a: Answer = { q, choice, ok: choice === q.answer, ms };
    const it = tally.current[q.id] ?? { c: 0, t: 0 };
    tally.current[q.id] = { c: it.c + (a.ok ? 1 : 0), t: it.t + 1 };
    const list = [...answers, a];
    setAnswers(list);
    setCurrent(a);
  };
  // Explication après chaque réponse (chrono arrêté). « J'ai deviné » : la question reviendra.
  const proceed = (guessed: boolean) => {
    let list = answers;
    if (guessed) {
      list = answers.map((a, i) => (i === answers.length - 1 ? { ...a, guessed: true } : a));
      setAnswers(list);
      const it = tally.current[q.id];
      if (it) tally.current[q.id] = { c: Math.max(0, it.c - 1), t: it.t };
    }
    if (over(list.length)) end(list);
    else next();
  };

  const correct = answers.filter(known).length;
  const row = harmonize(q.key);
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={() => end(answers, false)}>
          Arrêter
        </button>
        <span class="play-meta">
          N{level} · {mode === 'sprint' ? `${correct} justes` : `${answers.length + (current ? 0 : 1)}/${SERIE_N}`}
        </span>
        <Clock limitMs={mode === 'sprint' ? SPRINT_MS : undefined} spent={spent} qStart={qStart} paused={!!current} onTimeout={() => end(answers)} />
      </header>

      <section class="tq-card">
        <div class="tq-head">
          <span class="tq-key">En {keyLabel(q.key)}</span>
          {current ? (
            <button class="icon-btn" aria-label="Écouter l’accord" onClick={() => playOne(chordOf(q.key, q.degree))}>
              <SpeakerIcon />
            </button>
          ) : null}
        </div>
        <div class="tq-chord">
          <span class="tq-root">{noteName(q.root)}</span>
          {current ? <span class={'tq-qual' + (current.ok ? '' : ' bad')}>{symOf(q.answer)}</span> : null}
        </div>
        <span class="tq-roman">{current ? q.degree.roman : 'Quel accord ?'}</span>
        {current ? (
          <div class="harmo">
            {row.map((x) => (
              <div key={x.degree.roman} class={'hchip' + (x.degree.roman === q.degree.roman ? ' focus' : '')}>
                <span class="sym">{x.symbol}</span>
                <span class="rn">{x.degree.roman}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div class="thumb-zone">
        {current ? (
          <div class="fb">
            <p class={'verdict ' + (current.ok ? 'ok' : 'bad')}>
              {current.ok ? 'Juste : ' : 'Non : '}
              {noteName(q.root)}
              {symOf(q.answer)}.
            </p>
            <p class="muted">{q.explain}</p>
          </div>
        ) : null}
        <div class="choices qual">
          {choicesFor(level).map((c) => {
            const state = current ? (c.q === q.answer ? ' is-ok' : c.q === current.choice ? ' is-bad' : '') : '';
            return (
              <button key={c.q} class={'choice' + state} disabled={!!current} onClick={() => choose(c.q)}>
                {c.sym}
                <small>{c.name}</small>
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
  const per = DEG_ORDER.map((d) => {
    const l = answers.filter((a) => degKey(a.q) === d.id);
    return { ...d, n: l.length, c: l.filter(known).length, ms: l.reduce((s, a) => s + a.ms, 0) };
  }).filter((x) => x.n);
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
          <b>{answers.length ? fmtSec(ms / answers.length) : '—'}</b>
          <span>par réponse</span>
        </div>
        <div>
          <b>{fmtSec(ms)}</b>
          <span>de réflexion</span>
        </div>
      </div>
      {newRecord ? <p class="banner ok">Nouveau record en N{saved.level}.</p> : null}
      <StatBars rows={per.map((x) => ({ label: x.label, c: x.c, t: x.n, value: `${x.c}/${x.n} · ${fmtSec(x.ms / x.n)}` }))} />
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
                <span class="small muted">En {keyLabel(a.q.key)}</span>
                <b>
                  {noteName(a.q.root)}
                  {symOf(a.q.answer)} · {a.q.degree.roman}
                </b>
                <span class="small">
                  {a.ok ? 'juste, mais deviné' : <>tu as répondu <span class="bad">{symOf(a.choice)}</span></>}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
