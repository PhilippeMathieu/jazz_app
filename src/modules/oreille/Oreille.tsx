// Oreille : intervalles, nature d'un accord, accord entier, progressions, ligne de basse, construire un accord.
import { useEffect, useRef, useState } from 'preact/hooks';
import { QUALITIES, chordNotes, chordSymbol, rootPc, spellInChord } from '../../core/theory/chords';
import { mod, noteName, plainName } from '../../core/theory/notes';
import { PROGRESSIONS, romanLine } from '../../core/theory/progressions';
import { audio, now, piano, playChord, silence } from '../../core/audio/engine';
import { load, save } from '../../core/storage';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Field, LevelPicker, StartButton, levelName, levelShort } from '../../ui/Setup';
import { StatBars } from '../../ui/StatBars';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { PlayIcon } from '../../ui/icons';
import { AnswerActions } from '../../ui/AnswerActions';
import { notesMarks } from '../../ui/keyboardMarks';
import { HINTS, LEVEL_LABELS, PROG_LEVELS, QUALITY_LEVELS, qualityDiff } from './data';
import { EarMode, EarQuestion, Tally, checkBuild, earVoicing, makeDuelQuestion, makeEarQuestion, progChords } from './questions';
import { FULL_FREE, FULL_LEVEL_LABELS, FULL_TONAL } from './full';
import { FullPlay } from './FullChord';
import { IntervalPlay } from './IntervalPlay';
import { BassPlay } from './BassPlay';
import { IV_LEVELS, intervalById } from './intervals';
import { BASS_LEVELS } from './bassline';
import { Domain, Pair, clearConfusions, confusions, recordAnswer } from '../../core/confusions';
import { report } from '../../core/game';
import { chordOnPc } from '../../core/theory/chords';

interface Stats {
  mode: Exercise;
  lv: Partial<Record<Exercise, number>>;
  items: Tally;
  recent: Record<string, number[]>;
  /** Tout le niveau, ou seulement les paires confondues (duel à deux réponses). */
  focus?: 'all' | 'confusions';
}
/** Les exercices : ceux du générateur de questions, plus « Accord entier », « Intervalles », « Ligne de basse ». */
type Exercise = EarMode | 'full' | 'iv' | 'bass';
const DOMAIN: Record<Exercise, Domain> = { ear: 'accord', build: 'accord', prog: 'prog', full: 'degre', iv: 'intervalle', bass: 'basse' };
const domainOf = (m: Exercise): Domain => DOMAIN[m];
const itemName = (m: Exercise, k: string) => (m === 'prog' ? PROGRESSIONS[k]?.name ?? k : m === 'full' || m === 'bass' ? k : m === 'iv' ? intervalById(k)?.short ?? k : qualSym(k));
/** Exercices où « Mes confusions » fait départager deux réponses. */
const duelable = (m: Exercise) => m !== 'build' && m !== 'bass';
// Toutes les clés doivent figurer ici : au chargement, seules les clés connues sont gardées.
const DEFAULT: Stats = { mode: 'ear', lv: { iv: 0, ear: 0, full: 0, prog: 0, bass: 0, build: 0 }, items: {}, recent: {}, focus: 'all' };
const INTRO: Record<Exercise, string> = {
  iv: 'Avec des écouteurs : deux notes, tu dis l’écart. La base pour entendre les accords et les lignes.',
  ear: 'Avec des écouteurs : l’appli joue, tu reconnais. Après chaque réponse, l’accord s’affiche au clavier.',
  full: 'Avec des écouteurs : une référence, puis un accord ; tu dis sa fondamentale et sa nature.',
  prog: 'Avec des écouteurs : une suite d’accords, tu reconnais l’enchaînement.',
  bass: 'Avec des écouteurs (les graves passent mal sur le haut-parleur) : l’accord de la tonique, puis 4 notes de contrebasse ; tu dis leur degré.',
  build: 'Un accord s’affiche, tu touches ses notes au clavier.'
};
const PROMPT: Record<EarMode, string> = { ear: 'Quel accord ?', prog: 'Quelle progression ?', build: 'Construis cet accord' };
/** Accords de 3 sons : « majeur », « mineur » (le symbole seul serait vide pour le majeur). */
const qualSym = (k: string) => (k === 'maj' ? 'majeur' : k === 'min' ? 'mineur' : QUALITIES[k].sym);
const qualSub = (k: string) => (k === 'maj' ? 'ex. C' : k === 'min' ? 'ex. Cm' : QUALITIES[k].name);
const clampLv = (n: number | undefined) => (n !== undefined && n >= 0 && n <= 4 ? n : 0);
const EXERCISES: { value: Exercise; label: string; sub: string }[] = [
  { value: 'iv', label: 'Intervalles', sub: 'L’écart entre deux notes' },
  { value: 'ear', label: 'Accords', sub: 'Entendre un accord, dire sa nature' },
  { value: 'full', label: 'Accord entier', sub: 'La fondamentale aussi, après une référence' },
  { value: 'prog', label: 'Progressions', sub: 'Reconnaître une suite d’accords' },
  { value: 'bass', label: 'Ligne de basse', sub: 'Les degrés joués par la contrebasse' },
  { value: 'build', label: 'Construire', sub: 'Toucher les notes d’un accord' }
];
const isExercise = (x?: string): x is Exercise => !!x && EXERCISES.some((e) => e.value === x);

/** preset : l'exercice à ouvrir (« iv », « bass »…), ou « confusions » (le premier qui en a) ; focus : sur les confusions. */
export function Oreille({ preset, focus }: { preset?: string; focus?: boolean }) {
  const [stats, setStats] = useState<Stats>(() => {
    const s = load('oreille', DEFAULT);
    if (isExercise(preset)) return { ...s, mode: preset, focus: focus && duelable(preset) ? 'confusions' : 'all' };
    if (preset !== 'confusions') return s;
    const mode: Exercise = confusions('accord').length ? 'ear' : confusions('degre').length ? 'full' : confusions('prog').length ? 'prog' : confusions('intervalle').length ? 'iv' : 'ear';
    return { ...s, mode, focus: 'confusions' };
  });
  const [running, setRunning] = useState(false);
  useEffect(() => save('oreille', stats), [stats]);
  /** Enregistre des réponses (élément, juste ?) dans les statistiques de l'exercice, au niveau donné. */
  const recordMany = (rk: string, results: [string, boolean][]) =>
    setStats((s) => {
      const items = { ...s.items };
      for (const [item, good] of results) {
        const it = items[item] ?? { c: 0, t: 0 };
        items[item] = { c: it.c + (good ? 1 : 0), t: it.t + 1 };
      }
      return { ...s, items, recent: { ...s.recent, [rk]: [...(s.recent[rk] ?? []), ...results.map(([, g]) => (g ? 1 : 0))].slice(-10) } };
    });
  /** « J'ai deviné » : les dernières bonnes réponses comptent comme des erreurs. */
  const regrade = (rk: string, list: string[]) =>
    setStats((s) => {
      const items = { ...s.items };
      for (const item of list) if (items[item]) items[item] = { ...items[item], c: Math.max(0, items[item].c - 1) };
      const rec = [...(s.recent[rk] ?? [])];
      for (let i = Math.max(0, rec.length - list.length); i < rec.length; i++) rec[i] = 0;
      return { ...s, items, recent: { ...s.recent, [rk]: rec } };
    });
  const single = (rk: string) => (item: string, result: 'ok' | 'ko' | 'guess') => (result === 'guess' ? regrade(rk, [item]) : recordMany(rk, [[item, result === 'ok']]));
  if (running && stats.mode === 'iv') {
    const level = clampLv(stats.lv.iv);
    return <IntervalPlay level={level} items={stats.items} duelMode={stats.focus === 'confusions' && confusions('intervalle').length > 0} onRecord={single('iv' + level)} onStop={() => setRunning(false)} />;
  }
  if (running && stats.mode === 'bass') {
    const level = clampLv(stats.lv.bass);
    return <BassPlay level={level} items={stats.items} onRecord={(r) => recordMany('bass' + level, r)} onGuess={(l) => regrade('bass' + level, l)} onStop={() => setRunning(false)} />;
  }
  if (running && stats.mode === 'full') {
    const level = clampLv(stats.lv.full);
    return (
      <FullPlay
        level={level}
        items={stats.items}
        duelMode={stats.focus === 'confusions' && confusions('degre').length > 0}
        onRecord={single('full' + level)}
        onStop={() => setRunning(false)}
      />
    );
  }
  if (running) return <EarPlay stats={stats} setStats={setStats} mode={stats.mode as EarMode} onStop={() => setRunning(false)} />;
  return <EarSetup stats={stats} setStats={setStats} onStart={() => (audio(), setRunning(true))} />;
}

type SetStats = (f: (s: Stats) => Stats) => void;

function EarSetup({ stats, setStats, onStart }: { stats: Stats; setStats: SetStats; onStart: () => void }) {
  const mode = stats.mode;
  const level = clampLv(stats.lv[mode]);
  const pairs = mode === 'build' ? [] : confusions(domainOf(mode));
  const duel = duelable(mode) && stats.focus === 'confusions' && pairs.length > 0;
  const what = mode === 'prog' ? 'progressions' : mode === 'full' || mode === 'bass' ? 'degrés' : mode === 'iv' ? 'intervalles' : 'accords';
  const pool =
    mode === 'prog'
      ? PROG_LEVELS[level]
      : mode === 'full'
        ? level < FULL_TONAL.length
          ? FULL_TONAL[level].map((x) => x.id)
          : FULL_FREE[level - FULL_TONAL.length]
        : mode === 'iv'
          ? IV_LEVELS[level].ids
          : mode === 'bass'
            ? BASS_LEVELS[level].ids
            : QUALITY_LEVELS[level];
  const levels = mode === 'full' ? FULL_LEVEL_LABELS : mode === 'iv' ? IV_LEVELS.map((l) => l.desc) : mode === 'bass' ? BASS_LEVELS.map((l) => l.desc) : LEVEL_LABELS[mode];
  const rows = pool
    .map((k) => {
      const it = stats.items[mode + ':' + k] ?? { c: 0, t: 0 };
      return { label: mode === 'full' ? (level < FULL_TONAL.length ? k : qualSym(k)) : itemName(mode, k), c: it.c, t: it.t };
    })
    .sort((a, b) => (a.t ? a.c / a.t : 2) - (b.t ? b.c / b.t : 2));
  return (
    <div class="screen">
      <TopBar title="Oreille" />
      <p class="intro">{INTRO[mode]}</p>
      <Field label="Exercice">
        <Segmented cards cols={2} label="Exercice" value={mode} onChange={(m) => setStats((s) => ({ ...s, mode: m }))} options={EXERCISES} />
      </Field>
      {duelable(mode) && pairs.length ? (
        <Field label="Questions">
          <Segmented
            label="Questions"
            value={duel ? 'confusions' : 'all'}
            onChange={(focus) => setStats((s) => ({ ...s, focus }))}
            options={[
              { value: 'all', label: 'Tout le niveau', sub: 'Les accords du niveau choisi ; ceux que tu confonds reviennent plus souvent.' },
              { value: 'confusions', label: `Mes confusions (${pairs.length})`, sub: `Seulement les ${what} que tu confonds, à départager deux par deux.` }
            ]}
          />
        </Field>
      ) : null}
      {duel ? null : <LevelPicker exo={'oreille-' + mode} levels={levels.map((desc) => ({ desc }))} value={level} onChange={(l) => setStats((s) => ({ ...s, lv: { ...s.lv, [mode]: l } }))} />}
      <StartButton onClick={onStart} />
      {mode !== 'build' ? (
        pairs.length ? (
          <section>
            <h2 class="label">Tu confonds</h2>
            <div class="pairs">
              {pairs.slice(0, 6).map((p) => (
                <div key={p.a + p.b} class="pair">
                  <b>
                    {itemName(mode, p.a)} ↔ {itemName(mode, p.b)}
                  </b>
                  <span class="muted small">
                    {p.err} erreur{p.err > 1 ? 's' : ''}
                    {p.ok ? `, ${p.ok} bonne${p.ok > 1 ? 's' : ''} réponse${p.ok > 1 ? 's' : ''} depuis` : ''}
                  </span>
                </div>
              ))}
            </div>
            <p class="muted small">{mode === 'bass' ? 'Ces degrés reviennent plus souvent dans les lignes. ' : ''}Une paire disparaît quand tu as 2 bonnes réponses pour chaque erreur.</p>
            <ConfirmButton label="Oublier ces confusions" confirm="Toucher encore pour confirmer" onConfirm={() => (clearConfusions(domainOf(mode)), setStats((s) => ({ ...s, focus: 'all' })))} />
          </section>
        ) : (
          <p class="muted small">
            Quand tu confonds deux {what}, l’appli s’en souvient : ils reviennent plus souvent{duelable(mode) ? ', et tu pourras t’entraîner sur eux seuls' : ''}.
          </p>
        )
      ) : null}
      {rows.some((r) => r.t) ? (
        <section>
          <h2 class="label">Réussite, {levelName(level).toLowerCase()}</h2>
          <StatBars rows={rows} />
          <ConfirmButton label="Remettre les statistiques à zéro" confirm="Toucher encore pour confirmer" onConfirm={() => setStats((s) => ({ ...s, items: {}, recent: {} }))} />
        </section>
      ) : null}
    </div>
  );
}

/** Question suivante : duel sur une paire confondue, ou tout le niveau (confusions plus fréquentes). */
function nextQuestion(stats: Stats, mode: EarMode, level: number, last?: string): EarQuestion {
  const pairs: Pair[] = mode === 'build' ? [] : confusions(domainOf(mode));
  if (stats.focus === 'confusions' && mode !== 'build') {
    const d = makeDuelQuestion(mode, pairs, level, last);
    if (d) return d;
  }
  return makeEarQuestion(mode, level, stats.items, last, Math.random, pairs);
}

function EarPlay({ stats, setStats, mode, onStop }: { stats: Stats; setStats: SetStats; mode: EarMode; onStop: () => void }) {
  const level = clampLv(stats.lv[mode]);
  const last = useRef<string | undefined>(undefined);
  const [q, setQ] = useState<EarQuestion>(() => nextQuestion(stats, mode, level));
  const duel = !!((q.mode === 'ear' && q.choices) || (q.mode === 'prog' && stats.focus === 'confusions' && q.choices.length === 2));
  const [answer, setAnswer] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [lit, setLit] = useState(-1);
  const [shown, setShown] = useState(0);
  const [session, setSession] = useState({ c: 0, t: 0, streak: 0 });
  const timers = useRef<number[]>([]);
  const qStart = useRef(performance.now());
  useEffect(() => {
    if (q.mode !== 'build') play(q);
    return () => stop();
  }, []);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    silence();
    setLit(-1);
  };
  const play = (qq: EarQuestion = q, arp = false) => {
    audio();
    stop();
    const t0 = now() + 0.06;
    if (qq.mode === 'ear') {
      if (arp) qq.c.notes.forEach((m, i) => piano(m, t0 + i * 0.16, 2.2, 0.55));
      else playChord(qq.c.notes, t0, 2.2, 0.6);
    } else if (qq.mode === 'prog') {
      const step = 1.6;
      qq.chords.forEach((c, i) => {
        playChord(c.notes, t0 + i * step, step - 0.1, 0.6);
        timers.current.push(window.setTimeout(() => setLit(i), i * step * 1000 + 60));
      });
      timers.current.push(window.setTimeout(() => setLit(-1), qq.chords.length * step * 1000));
    }
  };
  const fresh = (m: EarMode, l: number, autoplay: boolean) => {
    stop();
    const nq = nextQuestion(stats, m, l, last.current);
    qStart.current = performance.now();
    last.current = nq.mode === 'prog' ? nq.id : nq.q;
    setQ(nq);
    setAnswer(null);
    setOk(null);
    setSel([]);
    setShown(0);
    if (autoplay) play(nq);
  };
  const record = (item: string, good: boolean) => {
    setStats((s) => {
      const it = s.items[item] ?? { c: 0, t: 0 };
      const rk = mode + clampLv(s.lv[mode]);
      return {
        ...s,
        items: { ...s.items, [item]: { c: it.c + (good ? 1 : 0), t: it.t + 1 } },
        recent: { ...s.recent, [rk]: [...(s.recent[rk] ?? []), good ? 1 : 0].slice(-10) }
      };
    });
    setSession((x) => ({ c: x.c + (good ? 1 : 0), t: x.t + 1, streak: good ? x.streak + 1 : 0 }));
  };
  const choose = (a: string) => {
    if (answer !== null || q.mode === 'build') return;
    const truth = q.mode === 'ear' ? q.q : q.id;
    const good = a === truth;
    setAnswer(a);
    setOk(good);
    record(q.mode === 'ear' ? 'ear:' + q.q : 'prog:' + q.id, good);
    recordAnswer(domainOf(q.mode), truth, a, q.mode === 'ear' ? (q.choices ?? pool) : q.choices);
    play(q);
  };
  /** « J'ai deviné » : la dernière réponse juste compte comme à revoir. */
  const regradeLast = () => {
    const item = q.mode === 'ear' ? 'ear:' + q.q : q.mode === 'prog' ? 'prog:' + q.id : 'build:' + q.q;
    setStats((s) => {
      const it = s.items[item];
      const rk = mode + clampLv(s.lv[mode]);
      const rec = [...(s.recent[rk] ?? [])];
      if (rec.length) rec[rec.length - 1] = 0;
      return { ...s, items: it ? { ...s.items, [item]: { ...it, c: Math.max(0, it.c - 1) } } : s.items, recent: { ...s.recent, [rk]: rec } };
    });
    setSession((x) => ({ ...x, c: Math.max(0, x.c - 1), streak: 0 }));
  };
  const validate = () => {
    if (q.mode !== 'build') return;
    const r = checkBuild(q.c.chord, sel);
    setAnswer('build');
    setOk(r.ok);
    record('build:' + q.q, r.ok);
    audio();
    stop();
    playChord(target(), now() + 0.05, 2.2, 0.6);
  };
  const target = () => {
    if (q.mode !== 'build') return [];
    const r = 60 + rootPc(q.c.chord);
    return QUALITIES[q.q].iv.map((i) => {
      let x = r + i;
      while (x > 76) x -= 12;
      return x;
    });
  };
  const setLevel = (l: number) => {
    setStats((s) => ({ ...s, lv: { ...s.lv, [mode]: l } }));
    fresh(mode, l, false);
  };

  const answered = answer !== null;
  const recent = stats.recent[mode + level] ?? [];
  const recentScore = recent.reduce((x, y) => x + y, 0);
  const pool = mode === 'prog' ? PROG_LEVELS[level] : QUALITY_LEVELS[level];

  // Clavier
  let kb = null;
  if (q.mode === 'build') {
    let marks: Record<number, Mark> = {};
    let labels: Record<number, string> = {};
    if (!answered) sel.forEach((m) => ((marks[m] = 'sel'), (labels[m] = plainName(m))));
    else {
      const r = checkBuild(q.c.chord, sel);
      sel.forEach((m) => {
        marks[m] = r.extra.includes(mod(m, 12)) ? 'bad' : 'ok';
        labels[m] = spellInChord(q.c.chord, m);
      });
      for (const p of r.missing) {
        const m = 60 + p;
        marks[m] = 'miss';
        labels[m] = spellInChord(q.c.chord, m);
      }
    }
    kb = (
      <Keyboard
        lo={60}
        hi={71}
        marks={marks}
        labels={labels}
        big
        onKey={
          answered
            ? undefined
            : (m) => {
                audio();
                if (sel.includes(m)) setSel(sel.filter((x) => x !== m));
                else {
                  setSel([...sel, m]);
                  piano(m, now() + 0.01, 1.2, 0.5);
                }
              }
        }
      />
    );
  } else if (answered) {
    const pc = q.mode === 'ear' ? q.c : q.chords[Math.max(0, lit >= 0 ? lit : shown)];
    const km = notesMarks(pc.chord, pc.notes);
    kb = <Keyboard lo={36} hi={84} marks={km.marks} labels={km.labels} center={pc.notes} />;
  }

  // Comparer côte à côte la bonne réponse et sa rivale (celle choisie par erreur, ou l'autre du duel).
  let compare = null;
  if (answered && q.mode !== 'build') {
    const truth = q.mode === 'ear' ? q.q : q.id;
    const other = !ok ? answer! : duel ? (q.choices ?? []).find((x) => x !== truth) : undefined;
    if (other && other !== truth) {
      const hear = (k: string) => {
        audio();
        stop();
        const t0 = now() + 0.05;
        if (q.mode === 'ear') playChord(earVoicing(chordOnPc(rootPc(q.c.chord), k), 1, () => 0), t0, 2, 0.6);
        else progChords(k, q.tonic).forEach((c, i) => playChord(c.notes, t0 + i * 1.3, 1.2, 0.6));
      };
      const diff =
        q.mode === 'ear'
          ? qualityDiff(truth, other, (k) => QUALITIES[k].iv, qualSym)
          : `${PROGRESSIONS[truth].name} : ${romanLine(truth)} ; ${PROGRESSIONS[other].name} : ${romanLine(other)}.`;
      compare = (
        <div class="compare">
          <span class="label">Compare, sur la même {q.mode === 'ear' ? 'fondamentale' : 'tonalité'}</span>
          <div class="row-actions">
            <button class="btn sm" onClick={() => hear(truth)}>
              <PlayIcon /> {itemName(mode, truth)}
            </button>
            <button class="btn sm" onClick={() => hear(other)}>
              <PlayIcon /> {itemName(mode, other)}
            </button>
          </div>
          {diff ? <p class="small">{diff}</p> : null}
        </div>
      );
    }
  }

  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onStop}>
          Arrêter
        </button>
        <span class="play-meta">
          {EXERCISES.find((e) => e.value === mode)?.label} · {duel ? 'mes confusions' : levelShort(level)} · {session.c}/{session.t}
          {session.streak > 1 ? ` · ${session.streak} d’affilée` : ''}
        </span>
      </header>
      {recent.length === 10 && recentScore >= 8 && level < 4 ? (
        <button class="banner ok" onClick={() => setLevel(level + 1)}>
          {recentScore}/10 sur tes dernières réponses : passe au {levelName(level + 1).toLowerCase()}
        </button>
      ) : null}

      <section class="ear-stage">
        {q.mode === 'build' ? (
          <div class="build-head">
            <span class="target-sym">{chordSymbol(q.c.chord)}</span>
            <span class="muted small">Touche les notes, octave libre.</span>
          </div>
        ) : (
          <div class="playrow">
            <button class="play big-play" aria-label="Écouter" onClick={() => play(q)}>
              <PlayIcon />
            </button>
            {q.mode === 'ear' ? (
              <button class="btn" onClick={() => play(q, true)}>
                Arpège
              </button>
            ) : (
              <div class="dots" aria-hidden="true">
                {q.chords.map((_, i) => <i key={i} class={lit === i ? 'on' : ''} />)}
              </div>
            )}
          </div>
        )}
        <h2 class="prompt">{PROMPT[mode]}</h2>
        {answered ? (
          <div class="fb">
            {q.mode === 'ear' ? (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? `Juste : ${chordSymbol(q.c.chord)}.` : `Non, c’était ${chordSymbol(q.c.chord)}.`}</p>
                <p class="muted">{HINTS[q.q]}</p>
              </>
            ) : q.mode === 'prog' ? (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? `Juste : ${PROGRESSIONS[q.id].name}.` : `Non, c’était : ${PROGRESSIONS[q.id].name}.`}</p>
                <div class="pchips">
                  {q.chords.map((c, i) => (
                    <button
                      key={i}
                      class={'pchip' + ((lit >= 0 ? lit : shown) === i ? ' on' : '')}
                      onClick={() => {
                        audio();
                        stop();
                        setShown(i);
                        playChord(c.notes, now() + 0.05, 2, 0.6);
                      }}
                    >
                      <b>{chordSymbol(c.chord)}</b>
                      <span>{c.roman}</span>
                    </button>
                  ))}
                </div>
                <p class="muted">{PROGRESSIONS[q.id].hint}</p>
              </>
            ) : (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? 'Juste.' : 'Pas tout à fait.'}</p>
                <p class="muted">
                  <span class="mono">{chordNotes(q.c.chord).map(noteName).join(' ')}</span>
                  {QUALITIES[q.q].iv.length >= 5 || q.q === '13' ? ' (quinte facultative)' : ''}. {HINTS[q.q]}
                </p>
              </>
            )}
          </div>
        ) : null}
        {compare}
        {kb}
      </section>

      <div class="thumb-zone">
        {q.mode !== 'build' && !answered ? (
          <div class={'choices' + (mode === 'prog' ? ' long' : '') + (duel && mode === 'ear' ? ' two' : '')}>
            {(q.mode === 'prog' ? q.choices : (q.choices ?? pool)).map((k) => (
              <button key={k} class="choice" onClick={() => choose(k)}>
                {mode === 'prog' ? (
                  <>
                    <span>{romanLine(k)}</span>
                    <small>{PROGRESSIONS[k].name}</small>
                  </>
                ) : (
                  <>
                    <span>{qualSym(k)}</span>
                    <small>{qualSub(k)}</small>
                  </>
                )}
              </button>
            ))}
          </div>
        ) : null}
        {q.mode === 'build' && !answered ? (
          <div class="row-actions">
            <button class="btn" disabled={!sel.length} onClick={() => setSel([])}>
              Effacer
            </button>
            <button class="btn primary" disabled={!sel.length} onClick={validate}>
              Valider
            </button>
          </div>
        ) : null}
        {answered ? (
          <AnswerActions
            ok={!!ok}
            onNext={() => {
              report({ type: 'answer', exo: 'oreille-' + mode, level, ok: !!ok, ms: performance.now() - qStart.current, duel });
              fresh(mode, level, q.mode !== 'build');
            }}
            onGuess={() => {
              report({ type: 'answer', exo: 'oreille-' + mode, level, ok: false, ms: performance.now() - qStart.current, duel });
              regradeLast();
              fresh(mode, level, q.mode !== 'build');
            }}
          />
        ) : null}
      </div>

    </div>
  );
}
