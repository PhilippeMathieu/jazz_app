// Lecture de notes : réglages, partie chronométrée (clavier, noms ou piano au micro), résultat.
import { useEffect, useRef, useState } from 'preact/hooks';
import { mod } from '../../core/theory/notes';
import { Written, writtenName } from '../../core/theory/staff';
import { audio, now, piano } from '../../core/audio/engine';
import { MIC_MESSAGES, micSettings, readNote, startMic, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { NoteTracker } from '../../core/listen/tracker';
import { load, save } from '../../core/storage';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Field, LevelPicker, SprintOptions, StartButton, levelName, levelShort } from '../../ui/Setup';
import { StatBars } from '../../ui/StatBars';
import { Clock, fmtSec } from '../../ui/Clock';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { Staff } from '../../ui/Staff';
import { MicPill } from '../../ui/MicPill';
import { SpeakerIcon } from '../../ui/icons';
import { AnswerActions } from '../../ui/AnswerActions';
import { CLEF_LABEL, LETTER_CHOICES, explainNote, LEVELS, Question, keyIsRight, makeQuestion, nameIsRight, playedVerdict, solfegeName } from './reading';

type RunMode = 'sprint' | 'serie';
type AnswerMode = 'clavier' | 'noms' | 'piano';
const SPRINT_MS = 60_000;
const SERIE_N = 20;
const ANSWER_LABEL: Record<AnswerMode, string> = { clavier: 'Clavier', noms: 'Nom', piano: 'Au piano' };
const ANSWER_SUB: Record<AnswerMode, string> = {
  clavier: 'Touche la note sur le clavier (octave libre).',
  noms: 'Choisis le nom de la note (au niveau 4, avec dièse ou bémol).',
  piano: 'Joue la note sur ton piano, à la bonne octave : le micro vérifie.'
};

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

const better = (a: RunRecord, b: RunRecord | undefined, mode: RunMode) =>
  !b || a.correct > b.correct || (a.correct === b.correct && (mode === 'serie' ? a.ms < b.ms : a.total < b.total));
const fullName = (w: Written) => `${writtenName(w)} · ${solfegeName(w)}`;
const PLAIN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const midiName = (m: number) => PLAIN[mod(m, 12)] + (Math.floor(m / 12) - 1);

export function Lecture() {
  const [saved, setSaved] = useState<Saved>(() => load('lecture', DEFAULT));
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  useEffect(() => save('lecture', saved), [saved]);
  useMicRelease();

  const finish = (list: Answer[], complete: boolean) => {
    const { level, mode, answer } = saved;
    const res: RunRecord = { correct: list.filter(known).length, total: list.length, ms: list.reduce((s, a) => s + a.ms, 0) };
    const rk = `${level}-${mode}-${answer}`;
    const rec = complete && res.total > 0 && better(res, saved.records[rk], mode);
    setNewRecord(rec);
    setAnswers(list);
    setSaved((s) => {
      const byItem = { ...s.byItem };
      list.forEach((a) => {
        const b = byItem[a.q.id] ?? { c: 0, t: 0, ms: 0 };
        byItem[a.q.id] = { c: b.c + (known(a) ? 1 : 0), t: b.t + 1, ms: b.ms + a.ms };
      });
      return { ...s, byItem, records: rec ? { ...s.records, [rk]: res } : s.records };
    });
    setPhase('done');
  };

  if (phase === 'play') return <Play saved={saved} onFinish={finish} />;
  if (phase === 'done') return <Result saved={saved} answers={answers} newRecord={newRecord} onAgain={() => setPhase('play')} onSetup={() => setPhase('setup')} />;
  return <Setup saved={saved} setSaved={setSaved} onStart={() => setPhase('play')} />;
}

// ---------------------------------------------------------------- Réglages

/** Réussite et temps moyen d'une liste de notes. */
function sum(entries: [string, { c: number; t: number; ms: number }][]) {
  return entries.reduce((s, [, v]) => ({ c: s.c + v.c, t: s.t + v.t, ms: s.ms + v.ms }), { c: 0, t: 0, ms: 0 });
}
const valueOf = (v: { c: number; t: number; ms: number }) => `${Math.round((v.c / v.t) * 100)} % · ${fmtSec(v.ms / v.t)}`;

function Setup({ saved, setSaved, onStart }: { saved: Saved; setSaved: (f: (s: Saved) => Saved) => void; onStart: () => void }) {
  const { level, mode, answer } = saved;
  const rec = saved.records[`${level}-${mode}-${answer}`];
  const entries = Object.entries(saved.byItem);
  const clefs = (['G', 'F'] as const)
    .map((c) => ({ c, v: sum(entries.filter(([k]) => k.startsWith(c + ':'))) }))
    .filter((x) => x.v.t);
  const weak = entries
    .filter(([, v]) => v.t >= 2)
    .map(([k, v]) => ({ k, v, score: v.c / v.t - v.ms / v.t / 10000 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .filter((x) => x.v.c < x.v.t || x.v.ms / x.v.t > 2000);
  const start = async () => {
    // Au piano : le micro s'ouvre sur ce geste (obligatoire sur iPhone).
    if (answer === 'piano') await startMic();
    onStart();
  };
  return (
    <div class="screen">
      <TopBar title="Notes" actions={answer === 'piano' ? <MicPill /> : undefined} />
      <p class="intro">Une note s’affiche sur la portée : trouve-la le plus vite possible.</p>
      <LevelPicker levels={LEVELS} base={1} value={level} onChange={(v) => setSaved((s) => ({ ...s, level: v }))} />
      <Field label="Répondre">
        <Segmented
          label="Répondre"
          value={answer}
          onChange={(v) => setSaved((s) => ({ ...s, answer: v }))}
          options={(Object.keys(ANSWER_LABEL) as AnswerMode[]).map((a) => ({ value: a, label: ANSWER_LABEL[a], sub: ANSWER_SUB[a] }))}
        />
      </Field>
      <SprintOptions mode={mode} n={SERIE_N} what="notes" onChange={(v) => setSaved((s) => ({ ...s, mode: v }))} />
      <StartButton onClick={start} />
      <p class="muted small">
        Record : {rec ? (mode === 'sprint' ? `${rec.correct} justes sur ${rec.total}` : `${rec.correct}/${rec.total} en ${fmtSec(rec.ms)}`) : 'aucun pour l’instant'}.
      </p>
      <details class="help">
        <summary>Les repères</summary>
        <p class="small">
          <b>Clé de sol</b> : lignes <span class="mono">E G B D F</span> (mi sol si ré fa), interlignes <span class="mono">F A C E</span>. Le sol est sur la 2e ligne.
        </p>
        <p class="small">
          <b>Clé de fa</b> : lignes <span class="mono">G B D F A</span> (sol si ré fa la), interlignes <span class="mono">A C E G</span>. Le fa est sur la 4e ligne.
        </p>
        <p class="small">Le do central (C4) est sur la 1re ligne supplémentaire, sous la clé de sol comme au-dessus de la clé de fa.</p>
      </details>
      {clefs.length ? (
        <section>
          <h2 class="label">Réussite par clé</h2>
          <StatBars rows={clefs.map((x) => ({ label: x.c === 'G' ? 'Clé de sol' : 'Clé de fa', c: x.v.c, t: x.v.t, value: valueOf(x.v) }))} />
        </section>
      ) : null}
      {weak.length ? (
        <section>
          <h2 class="label">Notes à travailler</h2>
          <StatBars rows={weak.map(({ k, v }) => ({ label: `${k.slice(2)} · ${k[0] === 'G' ? 'clé de sol' : 'clé de fa'}`, c: v.c, t: v.t, value: valueOf(v) }))} />
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Partie

function Play({ saved, onFinish }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void }) {
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
  const over = (n: number) => (mode === 'serie' && n >= SERIE_N) || (mode === 'sprint' && spent.current >= SPRINT_MS);

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
    if (answer === 'piano') timer.current = window.setTimeout(() => (over(list.length) ? end(list) : next()), 1800);
  };
  const proceed = (guessed: boolean) => {
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

  const correct = answers.filter(known).length;
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
          {levelShort(level - 1)} · {mode === 'sprint' ? `${correct} justes` : `${answers.length + (current ? 0 : 1)}/${SERIE_N}`}
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

// ---------------------------------------------------------------- Résultat

function Result({ saved, answers, newRecord, onAgain, onSetup }: { saved: Saved; answers: Answer[]; newRecord: boolean; onAgain: () => void; onSetup: () => void }) {
  const correct = answers.filter(known).length;
  const ms = answers.reduce((s, a) => s + a.ms, 0);
  const wrong = answers.filter((a) => !known(a));
  const per = (['treble', 'bass'] as const)
    .map((c) => {
      const l = answers.filter((a) => a.q.clef === c);
      return { c, n: l.length, ok: l.filter(known).length, ms: l.reduce((s, a) => s + a.ms, 0) };
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
          <b>{answers.length ? fmtSec(ms / answers.length) : '—'}</b>
          <span>par note</span>
        </div>
        <div>
          <b>{fmtSec(ms)}</b>
          <span>au total</span>
        </div>
      </div>
      {newRecord ? <p class="banner ok">Nouveau record, {levelName(saved.level - 1).toLowerCase()}.</p> : null}
      <StatBars rows={per.map((x) => ({ label: CLEF_LABEL[x.c], c: x.ok, t: x.n, value: `${x.ok}/${x.n} · ${fmtSec(x.ms / x.n)}` }))} />
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
                <span class="small muted">{CLEF_LABEL[a.q.clef]}</span>
                <b>{fullName(a.q.note)}</b>
                <span class="small">
                  {a.guessed ? 'juste, mais deviné' : <>tu as donné <span class="bad">{a.given}</span></>}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
