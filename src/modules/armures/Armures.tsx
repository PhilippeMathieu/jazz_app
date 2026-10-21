// Gammes et armures : réglages, partie, résultat.
import { useEffect, useRef, useState } from 'preact/hooks';
import { load, save } from '../../core/storage';
import { report } from '../../core/game';
import { TopBar } from '../../ui/Screen';
import { LevelPicker, SprintOptions, StartButton, levelName, levelShort } from '../../ui/Setup';
import { StatBars } from '../../ui/StatBars';
import { Clock, fmtSec } from '../../ui/Clock';
import { AnswerActions } from '../../ui/AnswerActions';
import { KeySigStaff } from '../../ui/KeySigStaff';
import { LEVELS, NAME_ROWS, accidentals, Question, Tally, explain, judgeNames, keyText, makeQuestion, sigLabel, solf } from './drill';

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
const better = (a: RunRecord, b: RunRecord | undefined, mode: RunMode) =>
  !b || a.correct > b.correct || (a.correct === b.correct && (mode === 'serie' ? a.ms < b.ms : a.total < b.total));

export function Armures() {
  const [saved, setSaved] = useState<Saved>(() => load('armures', DEFAULT));
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  useEffect(() => save('armures', saved), [saved]);

  const finish = (list: Answer[], complete: boolean) => {
    const { level, mode } = saved;
    const res: RunRecord = { correct: list.filter(known).length, total: list.length, ms: list.reduce((s, a) => s + a.ms, 0) };
    const rk = `${level}-${mode}`;
    const rec = complete && res.total > 0 && better(res, saved.records[rk], mode);
    setNewRecord(rec);
    setAnswers(list);
    setSaved((s) => {
      let { items, bySig } = s;
      list.forEach((a) => {
        const it = items[a.q.id] ?? { c: 0, t: 0 };
        items = { ...items, [a.q.id]: { c: it.c + (known(a) ? 1 : 0), t: it.t + 1 } };
        const k = sigKey(a.q.key.n);
        const b = bySig[k] ?? { c: 0, t: 0, ms: 0 };
        bySig = { ...bySig, [k]: { c: b.c + (known(a) ? 1 : 0), t: b.t + 1, ms: b.ms + a.ms } };
      });
      return { ...s, items, bySig, records: rec ? { ...s.records, [rk]: res } : s.records };
    });
    setPhase('done');
  };

  if (phase === 'play') return <Play saved={saved} onFinish={finish} />;
  if (phase === 'done') return <Result saved={saved} answers={answers} newRecord={newRecord} onAgain={() => setPhase('play')} onSetup={() => setPhase('setup')} />;
  return <Setup saved={saved} setSaved={setSaved} onStart={() => setPhase('play')} />;
}

// ---------------------------------------------------------------- Réglages

const SIG_ORDER = ['0', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯', '7♯', '1♭', '2♭', '3♭', '4♭', '5♭', '6♭', '7♭'];

function Setup({ saved, setSaved, onStart }: { saved: Saved; setSaved: (f: (s: Saved) => Saved) => void; onStart: () => void }) {
  const { level, mode } = saved;
  const rec = saved.records[`${level}-${mode}`];
  const sigs = SIG_ORDER.filter((k) => saved.bySig[k]);
  return (
    <div class="screen">
      <TopBar title="Gammes et armures" />
      <p class="intro">Dans les deux sens : 3 ♯ à la clé → A majeur (la) ; A majeur → F♯ C♯ G♯.</p>
      <LevelPicker exo="armures" levels={LEVELS} value={level} onChange={(v) => setSaved((s) => ({ ...s, level: v }))} />
      <SprintOptions mode={mode} n={SERIE_N} what="questions" onChange={(v) => setSaved((s) => ({ ...s, mode: v }))} />
      <StartButton onClick={onStart} />
      <p class="muted small">
        Record : {rec ? (mode === 'sprint' ? `${rec.correct} justes sur ${rec.total}` : `${rec.correct}/${rec.total} en ${fmtSec(rec.ms)}`) : 'aucun pour l’instant'}.
      </p>
      <details class="help">
        <summary>Les règles à retenir</summary>
        <p class="small">
          <b>Ordre des dièses</b> : <span class="mono">fa do sol ré la mi si</span> (F C G D A E B). Tonique majeure = dernier ♯ + ½ ton. 3 ♯ : F♯ C♯ G♯ → G♯ + ½ ton = A.
        </p>
        <p class="small">
          <b>Ordre des bémols</b> : l’inverse, <span class="mono">si mi la ré sol do fa</span>. Tonique majeure = l’avant-dernier ♭. 3 ♭ : B♭ E♭ A♭ → E♭. Exception : 1 ♭ = F.
        </p>
        <p class="small">
          <b>Relatif mineur</b> : même armure, tonique 1 ton ½ plus bas (6e degré). A majeur → F♯ mineur.
        </p>
      </details>
      {sigs.length ? (
        <section>
          <h2 class="label">Réussite par armure</h2>
          <StatBars rows={sigs.map((k) => ({ label: k === '0' ? 'rien' : k, c: saved.bySig[k].c, t: saved.bySig[k].t, value: `${Math.round((saved.bySig[k].c / saved.bySig[k].t) * 100)} % · ${fmtSec(saved.bySig[k].ms / saved.bySig[k].t)}` }))} />
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Partie

function Play({ saved, onFinish }: { saved: Saved; onFinish: (a: Answer[], complete: boolean) => void }) {
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
  const over = (n: number) => (mode === 'serie' && n >= SERIE_N) || (mode === 'sprint' && spent.current >= SPRINT_MS);

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
          {levelShort(level)} · {mode === 'sprint' ? `${correct} justes` : `${answers.length + (current ? 0 : 1)}/${SERIE_N}`}
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

// ---------------------------------------------------------------- Résultat

function Result({ saved, answers, newRecord, onAgain, onSetup }: { saved: Saved; answers: Answer[]; newRecord: boolean; onAgain: () => void; onSetup: () => void }) {
  const correct = answers.filter(known).length;
  const ms = answers.reduce((s, a) => s + a.ms, 0);
  const wrong = answers.filter((a) => !known(a));
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
      {newRecord ? <p class="banner ok">Nouveau record, {levelName(saved.level).toLowerCase()}.</p> : null}
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
                <b>
                  {keyText(a.q.minor ? a.q.key.minor : a.q.key.major, a.q.minor)} · {sigLabel(a.q.key.n)}
                </b>
                <span class="small">{a.ok ? 'juste, mais deviné' : <>tu as répondu <span class="bad">{a.given || 'rien'}</span></>}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
