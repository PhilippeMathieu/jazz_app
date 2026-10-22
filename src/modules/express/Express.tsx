// Analyse express : réglages, partie chronométrée, résultat.
import { useRef, useState } from 'preact/hooks';
import { chordSymbol } from '../../core/theory/chords';
import { keyLabel } from '../../core/chart/model';
import { playSequence } from '../../core/audio/play';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { SpeakerIcon } from '../../ui/icons';
import { Clock } from '../../ui/Clock';
import { AnswerActions } from '../../ui/AnswerActions';
import { ChordKeys } from '../../ui/ChordKeys';
import { Question, Seq, Tally, isRight, makeRound } from './drill';

type RunMode = 'sprint' | 'serie';
const SPRINT_MS = 60_000;

interface RunRecord {
  correct: number;
  total: number;
  ms: number;
}
interface Saved {
  /** Analyser (questions sur une grille) ou réharmoniser. */
  exercise: 'analyse' | 'reharm';
  level: number;
  mode: RunMode;
  records: Record<string, RunRecord>;
  byType: Record<string, { c: number; t: number; ms: number }>;
  byTemplate: Tally;
}
const DEFAULT: Saved = { exercise: 'analyse', level: 0, mode: 'sprint', records: {}, byType: {}, byTemplate: {} };

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


const playSeq = (seq: Seq) => playSequence(seq.chords.map((c) => c.chord));

// ---------------------------------------------------------------- Partie

function Play({ saved, onFinish, total }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void; total: number }) {
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
  const over = (n: number) => (mode === 'serie' && n >= total) || (mode === 'sprint' && spent.current >= SPRINT_MS);

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
    const lastA = answers[answers.length - 1];
    if (lastA) report({ type: 'answer', exo: 'express', level: level, ok: lastA.ok && !guessed, ms: lastA.ms });
    const list = guessed ? answers.map((a, i) => (i === answers.length - 1 ? { ...a, guessed: true } : a)) : answers;
    if (guessed) setAnswers(list);
    if (over(list.length)) end(list);
    else next();
  };

  if (!q) return null;
  const long = q.type === 'pattern' || q.type === 'key' || q.type === 'scale';
  const alsoOk = current?.ok && current.choice !== q.answer;
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

// ---------------------------------------------------------------- Lancement direct

/** Une série de questions d'analyse au niveau fixé par le parcours. */
export function ExpressRun({ level, total, onExit }: { level: number; total: number; onExit: () => void }) {
  const [saved] = useState<Saved>(() => ({ ...load('express', DEFAULT), level, mode: 'serie' }));
  const finish = (list: Answer[], complete: boolean) => {
    const s = load('express', DEFAULT);
    const byType = { ...s.byType };
    const byTemplate = { ...s.byTemplate };
    list.forEach((a) => {
      const b = byType[a.q.type] ?? { c: 0, t: 0, ms: 0 };
      byType[a.q.type] = { c: b.c + (known(a) ? 1 : 0), t: b.t + 1, ms: b.ms + a.ms };
      const id = a.q.seq.template.id;
      const tt = byTemplate[id] ?? { c: 0, t: 0 };
      byTemplate[id] = { c: tt.c + (known(a) ? 1 : 0), t: tt.t + 1 };
    });
    save('express', { ...s, byType, byTemplate });
    if (!complete) onExit();
  };
  return <Play saved={saved} onFinish={finish} total={total} />;
}
