// Lecture de notes : réglages, partie chronométrée (clavier, noms ou piano au micro), résultat.
import { useEffect, useRef, useState } from 'preact/hooks';
import { mod } from '../../core/theory/notes';
import { Written, writtenName } from '../../core/theory/staff';
import { audio, now, piano } from '../../core/audio/engine';
import { MIC_MESSAGES, micSettings, readNote, startMic, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { NoteTracker } from '../../core/listen/tracker';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { Clock } from '../../ui/Clock';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { Staff } from '../../ui/Staff';
import { SpeakerIcon } from '../../ui/icons';
import { AnswerActions } from '../../ui/AnswerActions';
import { CLEF_LABEL, LETTER_CHOICES, explainNote, Question, keyIsRight, makeQuestion, nameIsRight, playedVerdict, solfegeName } from './reading';

type RunMode = 'sprint' | 'serie';
type AnswerMode = 'clavier' | 'noms' | 'piano';
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
  answer: AnswerMode;
  records: Record<string, RunRecord>;
  /** Par note et par clé (« G:D5 », « F:E2 ») : tirage et statistiques. */
  byItem: Timed;
}
const DEFAULT: Saved = { level: 1, mode: 'sprint', answer: 'clavier', records: {}, byItem: {} };

interface Answer {
  q: Question;
  ok: boolean;
  ms: number;
  /** Ce qui a été donné (nom ou note entendue), pour « À revoir ». */
  given: string;
  /** Juste, mais au hasard : compte comme à revoir. */
  guessed?: boolean;
}
const known = (a: Answer) => a.ok && !a.guessed;

const fullName = (w: Written) => `${writtenName(w)} · ${solfegeName(w)}`;
const PLAIN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const midiName = (m: number) => PLAIN[mod(m, 12)] + (Math.floor(m / 12) - 1);

// ---------------------------------------------------------------- Partie

function Play({ saved, onFinish, total }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void; total: number }) {
  const { level, mode, answer } = saved;
  const tally = useRef({ ...saved.byItem });
  const [q, setQ] = useState<Question>(() => makeQuestion(level, tally.current));
  const [answers, setAnswers] = useState<Answer[]>([]);
  /** Réponse donnée à la note en cours (null : en attente). */
  const [current, setCurrent] = useState<Answer | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [acc, setAcc] = useState(0);
  // Au piano : notes fausses entendues avant la bonne.
  const [heard, setHeard] = useState<{ midi: number; verdict: 'octave' | 'wrong' } | null>(null);
  /** Au piano : première note fausse entendue (pour « À revoir »). */
  const missed = useRef<string | null>(null);
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
    setPicked(null);
    setAcc(0);
    setHeard(null);
    missed.current = null;
    setQ((p) => makeQuestion(level, tally.current, Math.random, p.id));
    qStart.current = performance.now();
    ignoreUntil.current = performance.now() + 300;
    tracker.current.reset();
  };
  const over = (n: number) => (mode === 'serie' && n >= total) || (mode === 'sprint' && spent.current >= SPRINT_MS);

  const settle = (ok: boolean, given: string) => {
    if (current || done.current) return;
    const ms = Math.min(performance.now() - qStart.current, mode === 'sprint' ? SPRINT_MS - spent.current : Infinity);
    spent.current += ms;
    const a: Answer = { q, ok, ms, given };
    const it = tally.current[q.id] ?? { c: 0, t: 0, ms: 0 };
    tally.current[q.id] = { c: it.c + (ok ? 1 : 0), t: it.t + 1, ms: it.ms + ms };
    const list = [...answers, a];
    setAnswers(list);
    setCurrent(a);
    // Au piano, les mains restent sur le clavier : l'explication s'affiche puis on enchaîne seul.
    // Ailleurs, elle reste jusqu'au tap, même si c'est juste.
    if (answer === 'piano') {
      report({ type: 'answer', exo: 'lecture', level: level - 1, ok, ms });
      timer.current = window.setTimeout(() => (over(list.length) ? end(list) : next()), 1800);
    }
  };
  const proceed = (guessed: boolean) => {
    const lastA = answers[answers.length - 1];
    if (lastA) report({ type: 'answer', exo: 'lecture', level: level - 1, ok: lastA.ok && !guessed, ms: lastA.ms });
    let list = answers;
    if (guessed) {
      list = answers.map((a, i) => (i === answers.length - 1 ? { ...a, guessed: true } : a));
      setAnswers(list);
      const it = tally.current[q.id];
      if (it) tally.current[q.id] = { ...it, c: Math.max(0, it.c - 1) };
    }
    if (over(list.length)) end(list);
    else next();
  };

  // ---- Au piano
  const micState = useMicState();
  const tracker = useRef(new NoteTracker(micSettings().gate));
  const ignoreUntil = useRef(performance.now() + 300);
  useMicLoop(
    answer === 'piano' && !current,
    () => {
      const r = readNote(tracker.current.gate);
      if (!r) return;
      const t = performance.now();
      const ev = tracker.current.push(r.pitch, r.level, t);
      if (!ev || t < ignoreUntil.current) return;
      const v = playedVerdict(q, ev.midi);
      if (v === 'ok') settle(!missed.current, missed.current ?? midiName(ev.midi));
      else {
        missed.current ??= midiName(ev.midi);
        setHeard({ midi: ev.midi, verdict: v });
      }
    },
    50
  );

  const onKey = (m: number) => {
    if (current) return;
    setPicked(m);
    settle(keyIsRight(q, m), PLAIN[mod(m, 12)]);
  };
  const onName = (letter: number) => {
    if (current) return;
    setPicked(letter);
    settle(nameIsRight(q, letter, acc), LETTER_CHOICES[letter].name + (acc > 0 ? '♯' : acc < 0 ? '♭' : ''));
  };
  const hear = () => {
    audio();
    piano(q.midi, now() + 0.02, 1.2, 0.6);
  };

  const target = mod(q.midi, 12) + 60;
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  if (current && answer === 'clavier') {
    marks[target] = 'ok';
    labels[target] = PLAIN[mod(q.midi, 12)];
    if (picked !== null && !current.ok) marks[picked] = 'bad';
  }
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

      <section class="read-card">
        <div class="read-head">
          <span class="muted small">{CLEF_LABEL[q.clef]}</span>
          {current && answer !== 'piano' ? (
            <button class="icon-btn" aria-label="Écouter la note" onClick={hear}>
              <SpeakerIcon />
            </button>
          ) : null}
        </div>
        <Staff clef={q.clef} note={q.note} state={current ? (current.ok ? 'ok' : 'bad') : undefined} label={`${CLEF_LABEL[q.clef]}, note à lire`} />
        <p class={'read-name' + (current ? (current.ok ? ' ok' : ' bad') : '')}>{current ? fullName(q.note) : ' '}</p>
      </section>

      <div class="thumb-zone">
        {answer === 'piano' ? (
          <div class="fb">
            {micState !== 'on' ? (
              <p class="muted">{MIC_MESSAGES[micState]} Active le micro avec le bouton ci-dessous.</p>
            ) : current ? (
              <>
                <p class={'verdict ' + (current.ok ? 'ok' : 'bad')}>{current.ok ? 'Juste.' : current.given === 'passée' ? 'Passée.' : 'Trouvée, mais pas du premier coup.'}</p>
                <p class="muted">{explainNote(q.clef, q.note)}</p>
              </>
            ) : heard ? (
              <p class="listen-line">
                <i class="rec" /> {midiName(heard.midi)} : {heard.verdict === 'octave' ? (heard.midi < q.midi ? 'bonne note, une octave trop bas' : 'bonne note, une octave trop haut') : 'pas cette note'}
              </p>
            ) : (
              <p class="listen-line">
                <i class="rec" /> Joue la note…
              </p>
            )}
          </div>
        ) : current ? (
          <div class="fb">
            <p class={'verdict ' + (current.ok ? 'ok' : 'bad')}>{current.ok ? 'Juste.' : `Non (tu as dit ${current.given}).`}</p>
            <p class="muted">{explainNote(q.clef, q.note)}</p>
          </div>
        ) : null}

        {answer === 'clavier' ? <Keyboard lo={60} hi={71} big marks={marks} labels={labels} onKey={onKey} /> : null}

        {answer === 'noms' ? (
          <>
            {level >= 4 ? (
              <div class="seg acc-seg" role="radiogroup" aria-label="Altération">
                {[
                  [-1, '♭ bémol'],
                  [0, '♮'],
                  [1, '♯ dièse']
                ].map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={acc === v} disabled={!!current} onClick={() => setAcc(v as number)}>
                    {l}
                  </button>
                ))}
              </div>
            ) : null}
            <div class="letters">
              {LETTER_CHOICES.map((c) => {
                const state = current ? (c.letter === q.note.letter ? ' is-ok' : c.letter === picked ? ' is-bad' : '') : '';
                return (
                  <button key={c.letter} class={'choice' + state} disabled={!!current} onClick={() => onName(c.letter)}>
                    {c.name}
                    <small>{c.solfege}</small>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {answer === 'piano' ? (
          micState === 'on' ? (
            <button class="btn block" disabled={!!current} onClick={() => settle(false, 'passée')}>
              Passer
            </button>
          ) : (
            <button class="btn primary block" onClick={() => startMic()}>
              Activer le micro
            </button>
          )
        ) : current ? (
          <AnswerActions ok={current.ok} onNext={() => proceed(false)} onGuess={() => proceed(true)} />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Lancement direct

/** Une série de notes à lire, au réglage fixé par le parcours. complete=false : l'élève a arrêté. */
export function LectureRun({ level, answer, total, onExit }: { level: number; answer: AnswerMode; total: number; onExit: () => void }) {
  useMicRelease();
  const [saved] = useState<Saved>(() => ({ ...load('lecture', DEFAULT), level, answer, mode: 'serie' }));
  const finish = (list: Answer[], complete: boolean) => {
    const s = load('lecture', DEFAULT);
    const byItem = { ...s.byItem };
    list.forEach((a) => {
      const b = byItem[a.q.id] ?? { c: 0, t: 0, ms: 0 };
      byItem[a.q.id] = { c: b.c + (known(a) ? 1 : 0), t: b.t + 1, ms: b.ms + a.ms };
    });
    save('lecture', { ...s, byItem });
    if (!complete) onExit();
  };
  return <Play saved={saved} onFinish={finish} total={total} />;
}
