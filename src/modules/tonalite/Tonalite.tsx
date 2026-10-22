// Accords de la tonalité : réglages, partie chronométrée, résultat.
import { useRef, useState } from 'preact/hooks';
import { keyLabel, keyName } from '../../core/chart/model';
import { QUALITIES } from '../../core/theory/chords';
import { noteName } from '../../core/theory/notes';
import { playOne } from '../../core/audio/play';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { Clock } from '../../ui/Clock';
import { SpeakerIcon } from '../../ui/icons';
import { AnswerActions } from '../../ui/AnswerActions';
import { ChordKeys } from '../../ui/ChordKeys';
import { DegQuality, Question, Tally, chordOf, choicesFor, harmonize, makeQuestion } from './drill';

type RunMode = 'sprint' | 'serie';
const SPRINT_MS = 60_000;

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
const DEFAULT: Saved = { level: 0, mode: 'sprint', records: {}, items: {}, byDeg: {}, byKey: {} };

interface Answer {
  q: Question;
  choice: DegQuality;
  ok: boolean;
  ms: number;
  /** Juste, mais au hasard : compte comme à revoir. */
  guessed?: boolean;
}
const known = (a: Answer) => a.ok && !a.guessed;

const degKey = (q: Question) => `${q.degree.triad ? 'T' : q.key.mode === 'major' ? 'M' : 'm'}:${q.degree.roman}`;
const symOf = (q: DegQuality) => QUALITIES[q].sym;

/** Degrés dans l'ordre, pour les statistiques. */

function add(t: Timed, k: string, ok: boolean, ms: number): Timed {
  const b = t[k] ?? { c: 0, t: 0, ms: 0 };
  return { ...t, [k]: { c: b.c + (ok ? 1 : 0), t: b.t + 1, ms: b.ms + ms } };
}

// ---------------------------------------------------------------- Partie

function Play({ saved, onFinish, total }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void; total: number }) {
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
  const over = (n: number) => (mode === 'serie' && n >= total) || (mode === 'sprint' && spent.current >= SPRINT_MS);

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
    const lastA = answers[answers.length - 1];
    if (lastA) report({ type: 'answer', exo: 'tonalite', level: level, ok: lastA.ok && !guessed, ms: lastA.ms });
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

  const row = harmonize(q.key, !!q.degree.triad);
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={() => end(answers, false)}>
          Arrêter
        </button>
        <span class="play-meta">
          {Math.min(total, answers.length + (current ? 0 : 1))}/{total}
        </span>
        <Clock limitMs={mode === 'sprint' ? SPRINT_MS : undefined} spent={spent} qStart={qStart} paused={!!current} onTimeout={() => end(answers)} />
      </header>

      <section class={'tq-card' + (current ? ' answered' : '')}>
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
        {current ? <ChordKeys chord={chordOf(q.key, q.degree)} /> : null}
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

// ---------------------------------------------------------------- Lancement direct

/** Une série de questions au niveau fixé par le parcours. */
export function TonaliteRun({ level, total, onExit }: { level: number; total: number; onExit: () => void }) {
  const [saved] = useState<Saved>(() => ({ ...load('tonalite', DEFAULT), level, mode: 'serie' }));
  const finish = (list: Answer[], complete: boolean) => {
    const s = load('tonalite', DEFAULT);
    let { items, byDeg, byKey } = s;
    list.forEach((a) => {
      const it = items[a.q.id] ?? { c: 0, t: 0 };
      items = { ...items, [a.q.id]: { c: it.c + (known(a) ? 1 : 0), t: it.t + 1 } };
      byDeg = add(byDeg, degKey(a.q), known(a), a.ms);
      byKey = add(byKey, keyName(a.q.key), known(a), a.ms);
    });
    save('tonalite', { ...s, items, byDeg, byKey });
    if (!complete) onExit();
  };
  return <Play saved={saved} onFinish={finish} total={total} />;
}
