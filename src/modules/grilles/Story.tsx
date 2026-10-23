// Comprendre un morceau, puis vérifier qu'on a compris :
// - « Comprendre » : la grille racontée phrase par phrase, en mots simples, chaque phrase à écouter ;
// - « Quiz » : pour chaque phrase, dire ce qui s'y passe (ii–V–I, suite pop, dominante secondaire…).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chart } from '../../core/chart/model';
import { chordsByBar } from '../../core/chart/layout';
import { ImprovPlan } from '../../core/analysis/improv';
import { Phrase, Story, Tag, answerById, answers, storyOf } from '../../core/analysis/story';
import { chordSymbol } from '../../core/theory/chords';
import { audio, now, playChord } from '../../core/audio/engine';
import { displayVoicing } from '../../core/audio/voicing';
import { report } from '../../core/events';
import { seeded, shuffle } from '../../core/random';
import { PlayerApi } from '../../ui/usePlayer';
import { PlayIcon, StopIcon } from '../../ui/icons';

export const useStory = (chart: Chart, plan: ImprovPlan): Story => useMemo(() => storyOf(chart, plan.flat, plan.analysis, plan.scales), [chart, plan]);

const barsText = (p: Phrase) => (p.from === p.to ? `mesure ${p.from + 1}` : `mesures ${p.from + 1}–${p.to + 1}`);

/** Écouter une phrase avec l'accompagnement, et s'arrêter à sa fin. */
function usePhrasePlayer(player: PlayerApi, phrases: Phrase[]) {
  const [playing, setPlaying] = useState<number | null>(null);
  const playingRef = useRef<number | null>(null);
  playingRef.current = playing;
  // En quittant la vue (autre onglet), la phrase en cours s'arrête.
  useEffect(() => () => void (playingRef.current !== null && player.stop()), []);
  useEffect(() => {
    if (playing === null) return;
    if (!player.playing) return setPlaying(null);
    const p = phrases[playing];
    const b = player.pos?.bar;
    if (b !== undefined && (b > p.to || b < p.from)) {
      player.stop();
      setPlaying(null);
    }
  }, [player.pos?.bar, player.playing]);
  const toggle = (i: number) => {
    if (playing === i) {
      player.stop();
      return setPlaying(null);
    }
    audio();
    player.start(phrases[i].from);
    setPlaying(i);
  };
  return { playing, toggle };
}

/** Les mesures d'une phrase, accords et (si demandé) degrés ; toucher un accord le fait entendre. */
function PhraseBars({ plan, phrase, degrees, nowBar }: { plan: ImprovPlan; phrase: Phrase; degrees: boolean; nowBar?: number }) {
  const byBar = useMemo(() => chordsByBar(plan.flat), [plan]);
  const barsList = Array.from({ length: phrase.to - phrase.from + 1 }, (_, k) => phrase.from + k);
  const hear = (ci: number) => {
    audio();
    playChord(displayVoicing(plan.flat[ci].chord, plan.scales[ci].scale), now() + 0.02, 1.3, 0.55);
  };
  return (
    <div class="sysrow ph-bars">
      {barsList.map((bi) => {
        const idxs = byBar.get(bi) ?? [];
        return (
          <div key={bi} class={'bar' + (nowBar === bi ? ' now' : '')}>
            <span class="barnum">{bi + 1}</span>
            <div class={'chords' + (idxs.length > 1 ? ' two' : '')}>
              {idxs.map((ci) => (
                <button key={ci} class="ch" onClick={() => hear(ci)}>
                  <span class="sym">{chordSymbol(plan.flat[ci].chord)}</span>
                  <span class="rn">{degrees ? phrase.degrees[ci] ?? ' ' : ' '}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Comprendre

export function Comprendre({ chart, plan, player }: { chart: Chart; plan: ImprovPlan; player: PlayerApi }) {
  const story = useStory(chart, plan);
  const pp = usePhrasePlayer(player, story.phrases);
  const nowBar = player.pos?.bar;
  return (
    <div class="story">
      <section class="story-sum">
        <span class="label">En bref</span>
        <ul>
          {story.summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {chart.notes ? <p class="small">{chart.notes}</p> : null}
        <p class="muted small">
          Phrase par phrase ci-dessous : touche ▶ pour écouter une phrase avec l’accompagnement, ou un accord pour l’entendre seul. Sous chaque accord, son degré dans la tonalité
          {chart.genre && chart.genre !== 'jazz' ? ' : en majuscule un accord majeur (I, IV, V), en minuscule un mineur (ii, iii, vi).' : '.'}
        </p>
      </section>
      {story.phrases.map((p, i) => {
        const here = nowBar !== undefined && nowBar >= p.from && nowBar <= p.to;
        return (
          <article key={i} class={'phrase' + (here ? ' now' : '') + (p.same !== undefined ? ' same' : '')}>
            <header class="ph-head">
              <span class="ph-where">
                {p.section ? <b>{p.section}</b> : null}
                <span class="muted small">{barsText(p)}</span>
              </span>
              <button class="icon-btn ph-play" aria-label={pp.playing === i ? 'Arrêter' : 'Écouter la phrase'} onClick={() => pp.toggle(i)}>
                {pp.playing === i ? <StopIcon /> : <PlayIcon />}
              </button>
            </header>
            <h3 class="ph-title">{p.title}</h3>
            <PhraseBars plan={plan} phrase={p} degrees nowBar={here ? nowBar : undefined} />
            {p.same === undefined ? <p class="ph-text">{p.text}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Quiz

/** Réponses qui se recouvrent : une phrase « ii–V–I » contient aussi un « V–I », une suite pop peut contenir un ii–V–I… */
const CONFLICTS: Partial<Record<Tag, Tag[]>> = {
  iiVI: ['iiV', 'VI', 'turn'],
  iiVi: ['iiV', 'VI', 'minor'],
  iiV: ['iiVI', 'iiVi', 'turn'],
  VI: ['iiVI', 'iiVi', 'sec', 'minor', 'turn'],
  sec: ['VI', 'turn'],
  turn: ['iiVI', 'iiV', 'sec', 'VI'],
  pop: ['iiVI', 'iiV', 'VI'],
  rock: ['borrow', 'minor'],
  borrow: ['rock', 'back'],
  back: ['borrow'],
  minor: ['VI', 'iiVi', 'rock']
};
const POOL_JAZZ: Tag[] = ['iiVI', 'iiVi', 'iiV', 'sec', 'subV', 'back', 'turn', 'static', 'blues'];
const POOL_POP: Tag[] = ['sec', 'borrow', 'rock', 'minor', 'static', 'iiVI'];

interface Question {
  phrase: Phrase;
  index: number;
  choices: string[];
}

/**
 * Les questions d'une grille : une par phrase qui a quelque chose à reconnaître (reprises et « sans surprise » exceptés).
 * Pour une suite connue, les autres choix sont des suites voisines (même famille) : il faut la reconnaître précisément.
 */
export function quizOf(story: Story, genre: string, seed: number): Question[] {
  const rng = seeded(seed);
  const all = answers();
  const pool: string[] = genre === 'jazz' ? POOL_JAZZ : POOL_POP;
  return story.phrases
    .map((phrase, index) => ({ phrase, index }))
    .filter(({ phrase }) => phrase.same === undefined && phrase.tag !== 'tonic')
    .map(({ phrase, index }) => {
      const bad = new Set<string>([...phrase.truths, ...phrase.tags.flatMap((t) => CONFLICTS[t] ?? []), 'tonic']);
      const ans = answerById(phrase.answer);
      const named = phrase.answer.startsWith('n:');
      const near = named ? shuffle(all.filter((a) => a.id.startsWith('n:') && a.family === ans?.family).map((a) => a.id), rng) : [];
      const present = shuffle([...new Set(story.phrases.map((p) => p.answer))], rng);
      const others = [...near, ...present, ...shuffle(pool, rng)].filter((t, k, a) => a.indexOf(t) === k && !bad.has(t) && t !== phrase.answer);
      return { phrase, index, choices: shuffle([phrase.answer, ...others.slice(0, 3)], rng) };
    });
}

export function PhraseQuiz({ chart, plan, player, onExplain }: { chart: Chart; plan: ImprovPlan; player: PlayerApi; onExplain: () => void }) {
  const story = useStory(chart, plan);
  const [round, setRound] = useState(0);
  const questions = useMemo(() => quizOf(story, chart.genre ?? 'jazz', [...chart.id].reduce((s, c) => s + c.charCodeAt(0), 0) + round * 7919), [story, round]);
  const [k, setK] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const pp = usePhrasePlayer(player, story.phrases);
  const restart = () => {
    setRound((r) => r + 1);
    setK(0);
    setPicked(null);
    setResults([]);
  };

  if (!questions.length)
    return (
      <div class="story">
        <p class="intro">Rien de particulier à reconnaître dans cette grille : que des accords de la gamme. Lis-la dans « Comprendre ».</p>
      </div>
    );

  if (k >= questions.length) {
    const ok = results.filter(Boolean).length;
    return (
      <div class="story">
        <div class={'result-card ' + (ok / questions.length >= 0.8 ? 'ok' : 'bad')}>
          <b>
            {ok} / {questions.length}
          </b>
          <span>phrases bien reconnues</span>
        </div>
        <div class="list">
          {questions.map((q, i) => (
            <div key={i} class="row">
              <span class={'check ' + (results[i] ? 'done' : 'todo')} />
              <span class="row-main">
                <span class="row-title">{q.phrase.title}</span>
                <span class="row-sub">{barsText(q.phrase)}</span>
              </span>
            </div>
          ))}
        </div>
        <div class="row-actions">
          <button class="btn" onClick={onExplain}>
            Relire l’explication
          </button>
          <button class="btn primary grow" onClick={restart}>
            Recommencer
          </button>
        </div>
      </div>
    );
  }

  const q = questions[k];
  const answered = picked !== null;
  const right = picked === q.phrase.answer;
  const choose = (t: string) => {
    if (answered) return;
    setPicked(t);
    const res = [...results, t === q.phrase.answer];
    setResults(res);
    if (res.length === questions.length) {
      const found = res.filter(Boolean).length;
      report({ type: 'analyse', chart: chart.id, found, total: questions.length, bad: questions.length - found });
    }
  };
  const next = () => {
    if (pp.playing !== null) pp.toggle(pp.playing);
    setPicked(null);
    setK((x) => x + 1);
  };
  return (
    <div class="story quiz">
      <p class="muted small">
        Phrase {k + 1} sur {questions.length} · {q.phrase.section ? `${q.phrase.section}, ` : ''}
        {barsText(q.phrase)}
      </p>
      <article class="phrase">
        <header class="ph-head">
          <h3 class="ph-title">{answered ? q.phrase.title : 'Qu’est-ce qui se passe dans cette phrase ?'}</h3>
          <button class="icon-btn ph-play" aria-label="Écouter la phrase" onClick={() => pp.toggle(q.index)}>
            {pp.playing === q.index ? <StopIcon /> : <PlayIcon />}
          </button>
        </header>
        <PhraseBars plan={plan} phrase={q.phrase} degrees={answered} />
        {answered ? (
          <>
            <p class={'verdict ' + (right ? 'ok' : 'bad')}>{right ? 'Juste.' : `Non : ${answerById(q.phrase.answer)?.label ?? ''}.`}</p>
            <p class="ph-text">{q.phrase.text}</p>
          </>
        ) : (
          <p class="muted small">Écoute (▶), regarde les accords. Touche un accord pour l’entendre seul.</p>
        )}
      </article>
      {answered ? (
        <button class="btn primary block" onClick={next}>
          {k + 1 < questions.length ? 'Phrase suivante' : 'Voir le résultat'}
        </button>
      ) : (
        <div class="choices long">
          {q.choices.map((t) => {
            const a = answerById(t);
            return (
              <button key={t} class="choice" onClick={() => choose(t)}>
                <span>{a?.label}</span>
                <small>{a?.hint}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
