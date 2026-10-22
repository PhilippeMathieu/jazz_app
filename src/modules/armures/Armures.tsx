// Gammes et armures : une série de questions, dans les deux sens (armure ↔ tonalité), au niveau fixé par le parcours.
import { useRef, useState } from 'preact/hooks';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { Clock } from '../../ui/Clock';
import { AnswerActions } from '../../ui/AnswerActions';
import { KeySigStaff } from '../../ui/KeySigStaff';
import { NAME_ROWS, accidentals, Question, Tally, explain, judgeNames, keyText, makeQuestion, sigLabel, solf } from './drill';

type RunMode = 'sprint' | 'serie';
const SPRINT_MS = 60_000;

interface RunRecord {
  correct: number;
  total: number;
  ms: number;
}
interface Saved {
  level: number;
  mode: RunMode;
  records: Record<string, RunRecord>;
  /** Par question (sens, armure, majeur/mineur) : sert au tirage. */
  items: Tally;
  /** Par armure (« 3♯ », « 2♭ ») : les points faibles. */
  bySig: Record<string, { c: number; t: number; ms: number }>;
}
const DEFAULT: Saved = { level: 0, mode: 'serie', records: {}, items: {}, bySig: {} };

interface Answer {
  q: Question;
  given: string;
  ok: boolean;
  ms: number;
  guessed?: boolean;
}
const known = (a: Answer) => a.ok && !a.guessed;
const sigKey = (n: number) => (n === 0 ? '0' : `${Math.abs(n)}${n > 0 ? '♯' : '♭'}`);
/** Une série de questions au niveau fixé par le parcours. */
export function ArmuresRun({ level, total, onExit }: { level: number; total: number; onExit: () => void }) {
  const [saved] = useState<Saved>(() => ({ ...load('armures', DEFAULT), level, mode: 'serie' }));
  const finish = (list: Answer[], complete: boolean) => {
    const s = load('armures', DEFAULT);
    let { items, bySig } = s;
    list.forEach((a) => {
      const it = items[a.q.id] ?? { c: 0, t: 0 };
      items = { ...items, [a.q.id]: { c: it.c + (known(a) ? 1 : 0), t: it.t + 1 } };
      const k = sigKey(a.q.key.n);
      const b = bySig[k] ?? { c: 0, t: 0, ms: 0 };
      bySig = { ...bySig, [k]: { c: b.c + (known(a) ? 1 : 0), t: b.t + 1, ms: b.ms + a.ms } };
    });
    save('armures', { ...s, items, bySig });
    if (!complete) onExit();
  };
  return <Play saved={saved} total={total} onFinish={finish} />;
}

// ---------------------------------------------------------------- Partie

function Play({ saved, onFinish, total }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void; total: number }) {
  const { level, mode } = saved;
  const tally = useRef<Tally>({ ...saved.items });
  const [q, setQ] = useState<Question>(() => makeQuestion(level, tally.current));
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [current, setCurrent] = useState<Answer | null>(null);
  const [typed, setTyped] = useState<string[]>([]);
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
    setTyped([]);
    setQ((p) => makeQuestion(level, tally.current, Math.random, p.id));
    qStart.current = performance.now();
  };
  const over = (n: number) => (mode === 'serie' && n >= total) || (mode === 'sprint' && spent.current >= SPRINT_MS);

  const answer = (given: string, ok: boolean) => {
    if (current) return;
    const ms = Math.min(performance.now() - qStart.current, mode === 'sprint' ? SPRINT_MS - spent.current : Infinity);
    spent.current += ms;
    const a: Answer = { q, given, ok, ms };
    const it = tally.current[q.id] ?? { c: 0, t: 0 };
    tally.current[q.id] = { c: it.c + (ok ? 1 : 0), t: it.t + 1 };
    setAnswers((l) => [...l, a]);
    setCurrent(a);
  };
  const proceed = (guessed: boolean) => {
    const last = answers[answers.length - 1];
    let list = answers;
    if (last) report({ type: 'answer', exo: 'armures', level, ok: last.ok && !guessed, ms: last.ms });
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
  const name = keyText(q.minor ? q.key.minor : q.key.major, q.minor);
  const showStaff = q.kind === 'sig2key' || !!current;
  const prompt =
    q.kind === 'sig2key' ? `Quelle tonalité ${q.minor ? 'mineure' : 'majeure'} ?` : q.kind === 'key2sig' ? 'Qu’y a-t-il à la clé ?' : 'Cite les altérations, dans l’ordre.';
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={() => end(answers, false)}>
          Arrêter
        </button>
        <span class="play-meta">
          {mode === 'sprint' ? `${correct} justes` : `${Math.min(total, answers.length + (current ? 0 : 1))}/${total}`}
        </span>
        <Clock limitMs={mode === 'sprint' ? SPRINT_MS : undefined} spent={spent} qStart={qStart} paused={!!current} onTimeout={() => end(answers)} />
      </header>

      <section class={'tq-card ks-card' + (current ? ' answered' : '')}>
        {q.kind !== 'sig2key' || current ? <span class="ks-key">{name} <span class="muted">({solf(q.minor ? q.key.minor : q.key.major)})</span></span> : null}
        {showStaff ? <KeySigStaff n={q.key.n} label={`Armure : ${sigLabel(q.key.n)}`} /> : null}
        <span class="tq-roman">{current ? (q.key.n ? `${sigLabel(q.key.n)} : ${accidentals(q.key.n).join(' ')}` : 'rien à la clé') : prompt}</span>
        {q.kind === 'names' && !current ? <span class="ks-typed mono">{typed.length ? typed.join(' ') : '…'}</span> : null}
      </section>

      <div class="thumb-zone">
        {current ? (
          <div class="fb">
            <p class={'verdict ' + (current.ok ? 'ok' : 'bad')}>{current.ok ? 'Juste.' : `Non : ${q.answer || 'rien'} (tu as dit ${current.given || 'rien'}).`}</p>
            {explain(q).map((l, i) => (
              <p key={i} class="muted">
                {l}
              </p>
            ))}
          </div>
        ) : null}
        {q.kind === 'names' ? (
          current ? null : (
            <>
              {NAME_ROWS.map((row, r) => (
                <div key={r} class="choices names">
                  {row.map((x) => (
                    <button key={x} class="choice" disabled={typed.includes(x) || typed.length >= 7} onClick={() => setTyped((t) => [...t, x])}>
                      {x}
                    </button>
                  ))}
                </div>
              ))}
              <div class="row-actions">
                <button class="btn" onClick={() => setTyped((t) => t.slice(0, -1))} disabled={!typed.length}>
                  Effacer
                </button>
                <button class="btn primary" onClick={() => answer(typed.join(' '), judgeNames(q, typed))}>
                  {typed.length ? 'Valider' : 'Rien à la clé'}
                </button>
              </div>
            </>
          )
        ) : (
          <div class="choices">
            {q.choices.map((c) => {
              const state = current ? (c === q.answer ? ' is-ok' : c === current.given ? ' is-bad' : '') : '';
              return (
                <button key={c} class={'choice' + state} disabled={!!current} onClick={() => answer(c, c === q.answer)}>
                  {c}
                  {q.kind === 'sig2key' ? <small>{solf(c)}</small> : null}
                </button>
              );
            })}
          </div>
        )}
        {current ? <AnswerActions ok={current.ok} onNext={() => proceed(false)} onGuess={() => proceed(true)} /> : null}
      </div>
    </div>
  );
}
