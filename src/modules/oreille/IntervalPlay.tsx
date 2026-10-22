// Oreille › Intervalles : deux notes, trouver l'écart.
import { useEffect, useRef, useState } from 'preact/hooks';
import { noteName } from '../../core/theory/notes';
import { audio, now, piano, silence } from '../../core/audio/engine';
import { confusions, recordAnswer } from '../../core/confusions';
import { report } from '../../core/events';
import { Keyboard } from '../../ui/Keyboard';
import { AnswerActions } from '../../ui/AnswerActions';
import { PlayIcon } from '../../ui/icons';
import { IV_LEVELS, IntervalQuestion, IvDir, explainInterval, intervalById, intervalDiff, makeIntervalDuel, makeIntervalQuestion } from './intervals';
import { Tally } from './questions';

const article = (id: string) => (id === 'tri' ? 'un' : 'une');
const PROMPT: Record<IvDir, string> = { up: 'Quel intervalle, en montant ?', down: 'Quel intervalle, en descendant ?', harm: 'Quel intervalle ? (les deux notes ensemble)' };

export function IntervalPlay({
  level,
  items,
  duelMode,
  onRecord,
  onStop
}: {
  level: number;
  items: Tally;
  duelMode: boolean;
  onRecord: (item: string, result: 'ok' | 'ko' | 'guess') => void;
  onStop: () => void;
}) {
  const last = useRef<string | undefined>(undefined);
  const make = (): IntervalQuestion => {
    const pairs = confusions('intervalle');
    if (duelMode) {
      const d = makeIntervalDuel(pairs, level, last.current);
      if (d) return d;
    }
    return makeIntervalQuestion(level, items, pairs, last.current);
  };
  const [q, setQ] = useState<IntervalQuestion>(make);
  const [answer, setAnswer] = useState<string | null>(null);
  const [session, setSession] = useState({ c: 0, t: 0, streak: 0 });
  const qStart = useRef(performance.now());
  const pool = q.choices ?? (IV_LEVELS[level] ?? IV_LEVELS[0]).ids;

  /** Les deux notes : l'une après l'autre (dans le sens de la question) ou ensemble. */
  const play = (qq: IntervalQuestion = q, dir: IvDir = qq.dir, semis = qq.iv.semis) => {
    audio();
    silence();
    const t0 = now() + 0.06;
    const lo = qq.low;
    const hi = qq.low + semis;
    if (dir === 'harm') {
      piano(lo, t0, 2, 0.6);
      piano(hi, t0 + 0.005, 2, 0.6);
    } else {
      const [x, y] = dir === 'up' ? [lo, hi] : [hi, lo];
      piano(x, t0, 0.75, 0.6);
      piano(y, t0 + 0.7, 1.6, 0.6);
    }
  };
  useEffect(() => {
    play(q);
    return () => silence();
  }, []);

  const choose = (id: string) => {
    if (answer) return;
    const ok = id === q.iv.id;
    setAnswer(id);
    onRecord('iv:' + q.iv.id, ok ? 'ok' : 'ko');
    recordAnswer('intervalle', q.iv.id, id, pool);
    setSession((s) => ({ c: s.c + (ok ? 1 : 0), t: s.t + 1, streak: ok ? s.streak + 1 : 0 }));
    play(q);
  };
  const next = (guessed = false) => {
    if (answer) report({ type: 'answer', exo: 'oreille-iv', level, ok: answer === q.iv.id && !guessed, ms: performance.now() - qStart.current, duel: !!q.choices });
    qStart.current = performance.now();
    const nq = make();
    last.current = nq.iv.id;
    setQ(nq);
    setAnswer(null);
    play(nq);
  };

  const ok = answer === q.iv.id;
  // La rivale : la réponse fausse, ou l'autre du duel.
  const other = answer && !ok ? answer : q.choices && answer ? q.choices.find((x) => x !== q.iv.id) : undefined;
  const otherIv = other ? intervalById(other) : undefined;

  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onStop}>
          Arrêter
        </button>
        <span class="play-meta">
          Intervalles · {q.choices ? 'mes confusions · ' : ''}{session.c}/{session.t}
          {session.streak > 1 ? ` · ${session.streak} d’affilée` : ''}
        </span>
      </header>
      <section class="ear-stage">
        <div class="playrow">
          <button class="play big-play" aria-label="Réécouter" onClick={() => play()}>
            <PlayIcon />
          </button>
          {q.dir === 'harm' ? (
            <button class="btn" onClick={() => play(q, 'up')}>
              Séparées
            </button>
          ) : (
            <button class="btn" onClick={() => play(q, 'harm')}>
              Ensemble
            </button>
          )}
        </div>
        <h2 class="prompt">{PROMPT[q.dir]}</h2>
        {answer ? (
          <div class="fb">
            <p class={'verdict ' + (ok ? 'ok' : 'bad')}>
              {ok ? `Oui, ${article(q.iv.id)} ${q.iv.name}.` : `Non, c’était ${article(q.iv.id)} ${q.iv.name}${otherIv ? ` (pas ${article(otherIv.id)} ${otherIv.name})` : ''}.`}
            </p>
            {explainInterval(q).map((t) => (
              <p key={t} class="muted">
                {t}
              </p>
            ))}
            {otherIv ? (
              <div class="compare">
                <span class="label">Compare, depuis la même note</span>
                <div class="row-actions">
                  <button class="btn sm" onClick={() => play(q)}>
                    <PlayIcon /> {q.iv.short}
                  </button>
                  <button class="btn sm" onClick={() => play(q, q.dir, otherIv.semis)}>
                    <PlayIcon /> {otherIv.short}
                  </button>
                </div>
                <p class="small">{intervalDiff(q.iv.id, otherIv.id)}</p>
              </div>
            ) : null}
            <Keyboard
              lo={48}
              hi={84}
              marks={{ [q.low]: 'ok', [q.high]: 'ok' }}
              labels={{ [q.low]: noteName(q.a), [q.high]: noteName(q.b) }}
              center={[q.low, q.high]}
            />
          </div>
        ) : null}
      </section>
      <div class="thumb-zone">
        {answer ? (
          <AnswerActions
            ok={ok}
            onNext={() => next()}
            onGuess={() => {
              onRecord('iv:' + q.iv.id, 'guess');
              setSession((s) => ({ ...s, c: Math.max(0, s.c - 1), streak: 0 }));
              next(true);
            }}
          />
        ) : (
          <div class={'choices' + (pool.length === 2 ? ' two' : ' iv')}>
            {pool.map((id) => {
              const iv = intervalById(id)!;
              return (
                <button key={id} class="choice" onClick={() => choose(id)}>
                  <span>{iv.short}</span>
                  <small>
                    {iv.semis} demi-ton{iv.semis > 1 ? 's' : ''}
                  </small>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
