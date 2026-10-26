// Oreille : intervalles, nature d'un accord, accord entier, progressions, ligne de basse, construire un accord.
import { useEffect, useRef, useState } from 'preact/hooks';
import { QUALITIES, chordNotes, chordSymbol, rootPc, spellInChord } from '../../core/theory/chords';
import { mod, noteName, plainName } from '../../core/theory/notes';
import { PROGRESSIONS, romanLine } from '../../core/theory/progressions';
import { audio, bass, now, piano, playChord, silence } from '../../core/audio/engine';
import { load, save } from '../../core/storage';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { PlayIcon } from '../../ui/icons';
import { AnswerActions } from '../../ui/AnswerActions';
import { notesMarks } from '../../ui/keyboardMarks';
import { HINTS, PROG_LEVELS, QUALITY_LEVELS, qualityDiff } from './data';
import { EarMode, EarQuestion, Tally, checkBuild, earVoicing, makeDuelQuestion, makeEarQuestion, makeProgSetQuestion, makeSetQuestion, progChords } from './questions';
import { FullPlay } from './FullChord';
import { IntervalPlay } from './IntervalPlay';
import { BassPlay } from './BassPlay';
import { intervalById } from './intervals';
import { changeText, changes, pairCue } from './pairs';

/** Rappel de la méthode, quand il y a plus de deux accords à départager. */
const METHOD = 'La 3ce : clair ou sombre ? La 7e : au repos ou qui tire ? Sombre et qui tire : la 5te, stable ou instable ?';
/** La méthode pour reconnaître une suite (leçon « Reconnaître une suite », étape 4). */
const PROG_METHOD = 'Le 1er accord est le I, retiens-le. Puis suis la basse : elle monte de 4 notes = IV, de 5 notes = V. L’accord triste, le seul mineur = VIm. « Basse seule » pour l’entendre mieux.';
/** Les accords de 4 sons de base : on dit quelle note change de l'un à l'autre. */
const FOUR = ['maj7', 'm7', '7', 'm7b5', 'dim7'];
import { Domain, Pair, confusions, recordAnswer } from '../../core/confusions';
import { report } from '../../core/events';
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

/**
 * Un exercice d'oreille, au niveau fixé par le parcours. duel : seulement les paires que l'élève confond
 * (si l'exercice le permet et qu'il en a). set : les natures d'accord proposées (2 à 5), toujours les mêmes boutons.
 */
export function OreilleRun({ mode, level, duel = false, set, onExit }: { mode: Exercise; level: number; duel?: boolean; set?: string[]; onExit: () => void }) {
  const [stats, setStats] = useState<Stats>(() => {
    const s = load('oreille', DEFAULT);
    return { ...s, mode, lv: { ...s.lv, [mode]: level }, focus: duel && duelable(mode) ? 'confusions' : 'all' };
  });
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
  const lv = clampLv(level);
  const confused = stats.focus === 'confusions';
  if (mode === 'iv') return <IntervalPlay level={lv} items={stats.items} duelMode={confused && confusions('intervalle').length > 0} onRecord={single('iv' + lv)} onStop={onExit} />;
  if (mode === 'bass') return <BassPlay level={lv} items={stats.items} onRecord={(r) => recordMany('bass' + lv, r)} onGuess={(l) => regrade('bass' + lv, l)} onStop={onExit} />;
  if (mode === 'full') return <FullPlay level={lv} items={stats.items} duelMode={confused && confusions('degre').length > 0} onRecord={single('full' + lv)} onStop={onExit} />;
  return <EarPlay stats={stats} setStats={setStats} mode={mode} set={mode === 'ear' || mode === 'prog' ? set : undefined} onStop={onExit} />;
}

/** Les confusions de l'élève, par exercice d'oreille (pour proposer de les départager). */
export function confusionsFor(mode: Exercise): Pair[] {
  return mode === 'build' || mode === 'bass' ? [] : confusions(domainOf(mode));
}
export type OreilleMode = Exercise;
export const oreilleItemName = itemName;

type SetStats = (f: (s: Stats) => Stats) => void;

/**
 * Deux progressions, accord par accord : ce qui change entre la bonne réponse et l'autre.
 * « 2e accord : V7/IV (bonne) au lieu de V7/II (ta réponse) ».
 */
export function progDiff(truth: string, other: string, wrong: boolean): string {
  const a = romanLine(truth).split(' – ');
  const b = romanLine(other).split(' – ');
  const them = wrong ? 'ta réponse' : PROGRESSIONS[other].name;
  const head = `${PROGRESSIONS[truth].name} : ${a.join(' – ')} ; ${them} : ${b.join(' – ')}.`;
  if (a.length !== b.length) return `${head} Pas le même nombre d’accords (${a.length} contre ${b.length}).`;
  const ord = (i: number) => (i === 0 ? '1er' : `${i + 1}e`);
  const changes = a.map((x, i) => (x === b[i] ? null : `${ord(i)} accord : ${x} au lieu de ${b[i]}`)).filter(Boolean);
  if (!changes.length) return head;
  const same = a.length - changes.length;
  return `Ce qui change : ${changes.join(' ; ')}.${same ? ` Le reste est identique (${same} accord${same > 1 ? 's' : ''}).` : ''}`;
}

/** Question suivante : natures imposées, duel sur une paire confondue, ou tout le niveau (confusions plus fréquentes). */
function nextQuestion(stats: Stats, mode: EarMode, level: number, last?: string, set?: string[], recent: string[] = []): EarQuestion {
  const pairs: Pair[] = mode === 'build' ? [] : confusions(domainOf(mode));
  if (set && mode === 'prog') return makeProgSetQuestion(set, stats.items, recent, pairs);
  if (set) return makeSetQuestion(set, level, stats.items, recent, pairs);
  if (stats.focus === 'confusions' && mode !== 'build') {
    const d = makeDuelQuestion(mode, pairs, level, last);
    if (d) return d;
  }
  return makeEarQuestion(mode, level, stats.items, last, Math.random, pairs);
}

function EarPlay({ stats, setStats, mode, set, onStop }: { stats: Stats; setStats: SetStats; mode: EarMode; set?: string[]; onStop: () => void }) {
  const level = clampLv(stats.lv[mode]);
  const last = useRef<string | undefined>(undefined);
  /** Réponses justes des dernières questions (natures imposées : pas plus de 3 fois la même). */
  const truths = useRef<string[]>([]);
  const [q, setQ] = useState<EarQuestion>(() => nextQuestion(stats, mode, level, undefined, set));
  const duel = !!((q.mode === 'ear' && q.choices?.length === 2) || (q.mode === 'prog' && stats.focus === 'confusions' && q.choices.length === 2));
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
  /** La basse seule (les fondamentales), pour suivre les degrés. */
  const playBass = (qq: EarQuestion) => {
    if (qq.mode !== 'prog') return;
    audio();
    stop();
    const t0 = now() + 0.06;
    const step = 1.3;
    qq.chords.forEach((c, i) => {
      bass(c.notes[0], t0 + i * step, step - 0.1, 0.9);
      timers.current.push(window.setTimeout(() => setLit(i), i * step * 1000 + 60));
    });
    timers.current.push(window.setTimeout(() => setLit(-1), qq.chords.length * step * 1000));
  };
  const fresh = (m: EarMode, l: number, autoplay: boolean) => {
    stop();
    if (q.mode === 'ear' || q.mode === 'prog') truths.current = [...truths.current, q.mode === 'ear' ? q.q : q.id].slice(-3);
    const nq = nextQuestion(stats, m, l, last.current, set, truths.current);
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

  const answered = answer !== null;
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
      const root = q.mode === 'ear' ? q.c.chord.root : null;
      const diff =
        q.mode === 'ear' && root && FOUR.includes(truth) && FOUR.includes(other)
          ? `De ${chordSymbol({ root, quality: truth })} à ${chordSymbol({ root, quality: other })}, ce qui change : ${changes(root, truth, other).map(changeText).join(' ; ')}. ${pairCue(truth, other)}`
          : q.mode === 'ear'
            ? qualityDiff(truth, other, (k) => QUALITIES[k].iv, qualSym)
            : progDiff(truth, other, !ok);
      compare = (
        <div class="compare">
          <span class="label">{!ok ? 'Compare ta réponse et la bonne' : 'Compare avec l’autre'}, sur la même {q.mode === 'ear' ? 'fondamentale' : 'tonalité'}</span>
          <div class="row-actions">
            <button class="btn sm" onClick={() => hear(truth)}>
              <PlayIcon /> {!ok ? 'La bonne : ' : ''}
              {itemName(mode, truth)}
            </button>
            <button class="btn sm" onClick={() => hear(other)}>
              <PlayIcon /> {!ok ? 'Ta réponse : ' : ''}
              {itemName(mode, other)}
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
          {set ? set.map((k) => (mode === 'prog' ? romanLine(k) : qualSym(k))).join(set.length === 2 ? ' ou ' : ' · ') : EXERCISES.find((e) => e.value === mode)?.label} · {duel && !set ? 'mes confusions · ' : ''}
          {session.c}/{session.t}
          {session.streak > 1 ? ` · ${session.streak} d’affilée` : ''}
        </span>
      </header>

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
              <>
                <button class="btn" onClick={() => playBass(q)}>
                  Basse seule
                </button>
                <div class="dots" aria-hidden="true">
                  {q.chords.map((_, i) => <i key={i} class={lit === i ? 'on' : ''} />)}
                </div>
              </>
            )}
          </div>
        )}
        <h2 class="prompt">{PROMPT[mode]}</h2>
        {set && set.length > 2 && !answered && mode !== 'prog' ? <p class="muted small">{METHOD}</p> : null}
        {mode === 'prog' && !answered ? <p class="muted small">{PROG_METHOD}</p> : null}
        {answered ? (
          <div class="fb">
            {q.mode === 'ear' ? (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? `Juste : ${chordSymbol(q.c.chord)}.` : `Non, c’était ${chordSymbol(q.c.chord)}.`}</p>
                <p class="muted">{HINTS[q.q]}</p>
              </>
            ) : q.mode === 'prog' ? (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? `Juste : ${PROGRESSIONS[q.id].name}.` : `Non : c’était ${PROGRESSIONS[q.id].name}, tu as dit ${PROGRESSIONS[answer!]?.name ?? answer}.`}</p>
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
        {answered && set && q.mode === 'prog' ? (
          <div class="compare">
            <span class="label">Les {set.length} suites, dans la même tonalité, pour comparer</span>
            <div class="chips text">
              {set.map((k) => (
                <button
                  key={k}
                  class="chip"
                  aria-pressed={k === q.id}
                  onClick={() => {
                    audio();
                    stop();
                    const t0 = now() + 0.05;
                    progChords(k, q.tonic).forEach((c, i) => playChord(c.notes, t0 + i * 1.3, 1.2, 0.6));
                  }}
                >
                  {romanLine(k)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {answered && set && set.length > 2 && q.mode === 'ear' ? (
          <div class="compare">
            <span class="label">Les {set.length} sur {noteName(q.c.chord.root)}, pour comparer</span>
            <div class="chips text">
              {set.map((k) => (
                <button
                  key={k}
                  class="chip"
                  aria-pressed={k === q.q}
                  onClick={() => {
                    audio();
                    stop();
                    playChord(earVoicing(chordOnPc(rootPc(q.c.chord), k), 1, () => 0), now() + 0.05, 2, 0.6);
                  }}
                >
                  {chordSymbol({ root: q.c.chord.root, quality: k })}
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
