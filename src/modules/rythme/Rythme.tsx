// Rythme : tenir le tempo, lire et taper un rythme, reconnaître un rythme ou un style.
import { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { RHYTHMS, RHYTHM_LEVELS, RPattern, countOf, rhythmById, rhythmsOf } from '../../core/rhythm/patterns';
import { calibrate, countInHits, drift, scoreTiming, tolerance, TimingResult } from '../../core/rhythm/timing';
import { GROOVES, STYLE_ORDER, StyleId } from '../../core/rhythm/styles';
import { playClicks, playGroove, playRhythm, stopPlayback } from '../../core/rhythm/play';
import { audio, now } from '../../core/audio/engine';
import { startMic, useMicRelease, useMicState } from '../../core/listen/mic';
import { load, save } from '../../core/storage';
import { shuffle, weightedPick } from '../../core/random';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Field, LevelPicker, MoreOptions, StartButton, levelShort } from '../../ui/Setup';
import { MicPill } from '../../ui/MicPill';
import { CountIn, GridLegend, RhythmGrid, HitMark, useBeatClock, useCursor } from '../../ui/RhythmGrid';
import { AnswerActions } from '../../ui/AnswerActions';
import { PlayIcon } from '../../ui/icons';
import { Input, useHits } from './input';
import { Domain, Pair, clearConfusions, confusionWeight, confusions, recordAnswer, rivalsOf } from '../../core/confusions';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { report } from '../../core/game';

type Exercise = 'tempo' | 'taper' | 'oreille' | 'style';
type Tally = Record<string, { c: number; t: number }>;
interface Saved {
  exercise: Exercise;
  input: Input;
  level: number;
  /** Tempo par niveau de rythme. */
  tempo: Record<string, number>;
  variant: number;
  keepTempo: number;
  /** Décalage mesuré (ms) par façon de jouer. */
  offsets: Record<string, number>;
  patterns: Tally;
  styles: Tally;
  /** Reconnaître : tout, ou seulement les paires confondues. */
  focus?: 'all' | 'confusions';
}
const DEFAULT: Saved = { exercise: 'tempo', input: 'tap', level: 0, tempo: {}, variant: 0, keepTempo: 80, offsets: {}, patterns: {}, styles: {} };
const LEVEL_TEMPO = [80, 80, 90, 100, 70, 100];

const EXERCISES: { value: Exercise; label: string; sub: string; how: string[] }[] = [
  {
    value: 'tempo',
    label: 'Tenir le tempo',
    sub: 'Taper avec le métronome, puis sans',
    how: [
      'Le métronome compte « 1, 2, 3, 4 » pour lancer.',
      'Tape les temps demandés pendant 8 mesures. Selon le niveau, le clic se tait par moments : continue seul.',
      'Tu vois si tu es en place, et si tu accélères ou ralentis.'
    ]
  },
  {
    value: 'taper',
    label: 'Lire et taper',
    sub: 'Un rythme écrit : l’écouter, le taper',
    how: [
      'Lis le rythme (case pleine = un coup) et écoute-le.',
      'Après le décompte « 1, 2, 3, 4 », tape-le 2 fois de suite, sur la batterie.',
      'Chaque case se colore : vert en place, bleu trop tôt, rouge trop tard.'
    ]
  },
  {
    value: 'oreille',
    label: 'Reconnaître un rythme',
    sub: 'L’entendre, le retrouver écrit',
    how: ['Écoute le rythme, joué 2 fois.', 'Choisis, parmi 4 rythmes écrits, celui que tu as entendu.', 'L’explication s’affiche ; tu peux réécouter.']
  },
  {
    value: 'style',
    label: 'Reconnaître un style',
    sub: 'Swing, bossa, samba…',
    how: [
      'Écoute 4 mesures d’accompagnement : batterie, basse, piano.',
      'Choisis le style parmi 4.',
      'Les indices pour le reconnaître s’affichent, et tu peux comparer les styles.'
    ]
  }
];

/** Niveaux de « Tenir le tempo » : où sonne le clic, où taper. */
interface Variant {
  name: string;
  hint: string;
  clicks: number[];
  taps: number[];
  /** Mesures où le clic sonne. */
  heard: (bar: number) => boolean;
  hat?: boolean;
}
const VARIANTS: Variant[] = [
  { name: 'Avec le clic', hint: 'Le clic compte 1, 2, 3, 4 : tape en même temps que lui.', clicks: [0, 1, 2, 3], taps: [0, 1, 2, 3], heard: () => true },
  {
    name: 'Sur 2 et 4',
    hint: 'Le clic compte les 4 temps ; toi, tape seulement sur 2 et 4, comme le charleston du batteur en jazz.',
    clicks: [0, 1, 2, 3],
    taps: [1, 3],
    heard: () => true
  },
  {
    name: 'Clic sur 2 et 4',
    hint: 'Le clic ne sonne que sur 2 et 4 : tape les 4 temps, en sentant le 1 et le 3 toi-même.',
    clicks: [1, 3],
    taps: [0, 1, 2, 3],
    heard: () => true,
    hat: true
  },
  { name: 'Une mesure sur deux', hint: 'Le clic sonne une mesure, se tait la suivante : garde le même tempo.', clicks: [0, 1, 2, 3], taps: [0, 1, 2, 3], heard: (b) => b % 2 === 0 },
  { name: 'Seul', hint: '2 mesures de clic, puis 6 mesures seul : le vrai test.', clicks: [0, 1, 2, 3], taps: [0, 1, 2, 3], heard: (b) => b < 2 }
];
const BARS = 8;

type SetSaved = (p: Partial<Saved>) => void;

/** piano : on écoute le micro. preset : exercice et niveau ouverts depuis une leçon (#/rythme/taper/3). */
export function Rythme({ piano, preset }: { piano?: boolean; preset?: { exercise: string; level: number; confusions?: boolean } }) {
  const [saved, setSaved] = useState<Saved>(() => {
    const s: Saved = { ...DEFAULT, ...load('rythme', DEFAULT) };
    if (piano) s.input = 'mic';
    const ex = EXERCISES.find((e) => e.value === preset?.exercise);
    if (ex && preset) {
      s.exercise = ex.value;
      const max = ex.value === 'tempo' ? VARIANTS.length : RHYTHM_LEVELS.length;
      if (preset.level >= 0 && preset.level < max) {
        if (ex.value === 'tempo') s.variant = preset.level;
        else s.level = preset.level;
      }
    }
    if (preset?.confusions) s.focus = 'confusions';
    if (s.variant >= VARIANTS.length) s.variant = 0;
    return s;
  });
  const [phase, setPhase] = useState<'setup' | 'calibrate' | 'play'>('setup');
  const [afterCal, setAfterCal] = useState<'setup' | 'play'>('setup');
  useEffect(() => save('rythme', saved), [saved]);
  useEffect(() => () => stopPlayback(), []);
  useMicRelease();
  const set: SetSaved = (p) => setSaved((s) => ({ ...s, ...p }));

  if (phase === 'calibrate')
    return (
      <Calibrate
        input={saved.input}
        onDone={(ms) => {
          set({ offsets: { ...saved.offsets, [saved.input]: ms } });
          setPhase(afterCal);
        }}
        onCancel={() => setPhase('setup')}
      />
    );
  if (phase === 'play') {
    const back = () => setPhase('setup');
    if (saved.exercise === 'taper') return <TapRhythm saved={saved} set={set} onBack={back} />;
    if (saved.exercise === 'tempo') return <KeepTime saved={saved} set={set} onBack={back} />;
    if (saved.exercise === 'oreille') return <EarRhythm saved={saved} set={set} onBack={back} />;
    return <EarStyle saved={saved} set={set} onBack={back} />;
  }
  return (
    <Setup
      saved={saved}
      set={set}
      onStart={() => setPhase('play')}
      onCalibrate={(then) => {
        setAfterCal(then);
        setPhase('calibrate');
      }}
    />
  );
}

// ---------------------------------------------------------------- Réglages

function Setup({ saved, set, onStart, onCalibrate }: { saved: Saved; set: SetSaved; onStart: () => void; onCalibrate: (then: 'setup' | 'play') => void }) {
  const timed = saved.exercise === 'taper' || saved.exercise === 'tempo';
  const offset = saved.offsets[saved.input];
  const ex = EXERCISES.find((e) => e.value === saved.exercise)!;
  const earDomain: Domain | null = saved.exercise === 'style' ? 'style' : saved.exercise === 'oreille' ? 'rythme' : null;
  const pairs = earDomain ? confusions(earDomain) : [];
  const duel = saved.focus === 'confusions' && pairs.length > 0;
  const what = saved.exercise === 'style' ? 'styles' : 'rythmes';
  const start = async () => {
    audio();
    if (timed && saved.input === 'mic') await startMic({ echo: true });
    if (timed && offset === undefined) onCalibrate('play');
    else onStart();
  };
  return (
    <div class="screen">
      <TopBar title="Rythme" actions={timed && saved.input === 'mic' ? <MicPill echo /> : undefined} />
      <p class="intro">Le placement, le tempo et les styles. Au casque dans le métro, ou au piano avec le micro.</p>
      <Field label="Exercice">
        <Segmented cards cols={2} label="Exercice" value={saved.exercise} onChange={(exercise) => set({ exercise })} options={EXERCISES} />
      </Field>
      <ol class="howto">
        {ex.how.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ol>
      {saved.exercise === 'tempo' ? <LevelPicker exo="rythme-tempo" levels={VARIANTS.map((v) => ({ name: v.name, desc: v.hint }))} value={saved.variant} onChange={(variant) => set({ variant })} /> : null}
      {earDomain && pairs.length ? (
        <Field label="Questions">
          <Segmented
            label="Questions"
            value={duel ? 'confusions' : 'all'}
            onChange={(focus) => set({ focus })}
            options={[
              { value: 'all', label: saved.exercise === 'style' ? 'Tous les styles' : 'Tout le niveau', sub: `Ce que tu confonds revient plus souvent.` },
              { value: 'confusions', label: `Mes confusions (${pairs.length})`, sub: `Seulement les ${what} que tu confonds, à départager deux par deux.` }
            ]}
          />
        </Field>
      ) : null}
      {(saved.exercise === 'taper' || saved.exercise === 'oreille') && !duel ? (
        <LevelPicker exo={saved.exercise === 'taper' ? 'rythme-taper' : 'rythme-oreille'} levels={RHYTHM_LEVELS.map((l) => ({ name: l.label, desc: l.desc }))} value={saved.level} onChange={(level) => set({ level })} />
      ) : null}
      {timed ? (
        <Field label="Répondre">
          <Segmented
            label="Répondre"
            value={saved.input}
            onChange={(input) => set({ input })}
            options={[
              { value: 'tap', label: 'Sur l’écran', sub: 'Tape la grande zone avec un doigt, au casque de préférence.' },
              { value: 'mic', label: 'Au piano', sub: 'Joue une note ou un accord à chaque coup : le micro mesure. Mets un écouteur, sinon il entend le métronome.' }
            ]}
          />
        </Field>
      ) : null}
      {timed ? (
        <MoreOptions summary={(saved.exercise === 'tempo' ? `${saved.keepTempo} BPM · ` : '') + (offset === undefined ? 'réglage du décalage à faire' : 'décalage réglé')}>
          {saved.exercise === 'tempo' ? <TempoStepper value={saved.keepTempo} onChange={(keepTempo) => set({ keepTempo })} /> : null}
          <p class="muted small">
            {offset === undefined
              ? 'Chaque téléphone a un petit retard entre le son et l’écran. Un réglage de 10 secondes le mesure ; il se lance au premier exercice. '
              : `Décalage mesuré : ${offset} ms, corrigé automatiquement. `}
            <button class="linkbtn inline" onClick={() => onCalibrate('setup')}>
              {offset === undefined ? 'Le faire maintenant' : 'Refaire le réglage'}
            </button>
          </p>
        </MoreOptions>
      ) : null}
      <StartButton onClick={start} />
      {earDomain ? (
        pairs.length ? (
          <section>
            <h2 class="label">Tu confonds</h2>
            <div class="pairs">
              {pairs.slice(0, 6).map((p) => (
                <div key={p.a + p.b} class="pair">
                  <b>
                    {nameOf(earDomain, p.a)} ↔ {nameOf(earDomain, p.b)}
                  </b>
                  <span class="muted small">
                    {p.err} erreur{p.err > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
            <ConfirmButton label="Oublier ces confusions" confirm="Toucher encore pour confirmer" onConfirm={() => (clearConfusions(earDomain), set({ focus: 'all' }))} />
          </section>
        ) : (
          <p class="muted small">Quand tu confonds deux {what}, l’appli s’en souvient : ils reviennent plus souvent, et tu pourras t’entraîner sur eux seuls.</p>
        )
      ) : null}
    </div>
  );
}

const nameOf = (d: Domain, k: string) => (d === 'style' ? GROOVES[k as StyleId]?.name ?? k : RHYTHMS.find((r) => r.id === k)?.name ?? k);

function TempoStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div class="tempo-row">
      <span class="label">Tempo</span>
      <div class="stepper">
        <button aria-label="Plus lent" onClick={() => onChange(Math.max(40, value - 4))}>
          −
        </button>
        <span>
          {value} <small>BPM</small>
        </span>
        <button aria-label="Plus rapide" onClick={() => onChange(Math.min(260, value + 4))}>
          +
        </button>
      </div>
    </div>
  );
}

function TempoMini({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <span class="tempo-mini">
      <button class="icon-btn" aria-label="Plus lent" disabled={disabled} onClick={() => onChange(Math.max(40, value - 4))}>
        −
      </button>
      <button class="icon-btn" aria-label="Plus rapide" disabled={disabled} onClick={() => onChange(Math.min(260, value + 4))}>
        +
      </button>
    </span>
  );
}

/** Où on en est : Écouter → Taper → Résultat. */
function Steps({ steps, at }: { steps: string[]; at: number }) {
  return (
    <ol class="r-steps">
      {steps.map((s, i) => (
        <li key={s} class={i === at ? 'on' : i < at ? 'done' : ''}>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** La consigne du moment, en gros. */
function Say({ children, tone }: { children: ComponentChildren; tone?: 'ok' | 'bad' }) {
  return <div class={'r-say' + (tone ? ' ' + tone : '')}>{children}</div>;
}

/** Zone à taper (écran) ou rappel du micro. */
function TapPad({ input, active, count, onTap }: { input: Input; active: boolean; count: number; onTap: (e: PointerEvent) => void }) {
  const mic = useMicState();
  if (input === 'mic')
    return (
      <div class={'tap-pad mic' + (active ? ' live' : '')}>
        {mic === 'on' ? (
          <span>
            <i class="rec" /> {active ? `J’écoute ton piano… ${count ? `(${count} coups)` : ''}` : 'Micro prêt : tu joueras au piano'}
          </span>
        ) : (
          <button class="btn primary" onClick={() => startMic({ echo: true })}>
            Activer le micro
          </button>
        )}
      </div>
    );
  return (
    <button
      class={'tap-pad' + (active ? ' live' : '')}
      onPointerDown={(e) => {
        e.preventDefault();
        onTap(e);
      }}
    >
      <span key={count} class="tap-flash">
        {active ? 'Tape ici' : 'Zone où taper'}
      </span>
    </button>
  );
}

function BleedWarning() {
  return (
    <p class="verdict bad">
      Le micro a entendu des coups pendant le décompte : il capte sans doute le métronome du haut-parleur. Mets un écouteur (ou baisse le volume), et ne joue pas pendant le décompte.
    </p>
  );
}

// ---------------------------------------------------------------- Résultat en mots

function verdictOf(r: TimingResult, tol: number, what = 'coups'): { ok: boolean; title: string; tips: string[] } {
  const total = r.matches.length;
  const missed = r.matches.filter((m) => m.dev === null).length;
  const ok = r.good === total && r.extra <= 1;
  const title = ok ? `Bravo : les ${total} ${what} en place.` : `${r.good} ${what} sur ${total} en place.`;
  const tips: string[] = [];
  if (missed) tips.push(`${missed} oublié${missed > 1 ? 's' : ''}.`);
  if (r.extra > 1) tips.push(`${r.extra} coups en trop : tape seulement là où c’est demandé.`);
  if (r.mean < -tol / 2) tips.push('Tu tapes un peu tôt : attends le temps, ne te précipite pas.');
  else if (r.mean > tol / 2) tips.push('Tu tapes un peu tard : écoute le clic et anticipe légèrement.');
  if (r.spread > tol) tips.push('Les coups sont irréguliers : compte à voix basse « 1 et 2 et 3 et 4 et ».');
  return { ok, title, tips };
}

function Verdict({ r, tol, what, extra, devs }: { r: TimingResult; tol: number; what?: string; extra?: string; devs?: (number | null)[] }) {
  const v = verdictOf(r, tol, what);
  return (
    <div class="r-result">
      <p class={'verdict ' + (v.ok ? 'ok' : 'bad')}>{v.title}</p>
      {v.tips.map((t) => (
        <p key={t} class="small">
          {t}
        </p>
      ))}
      {extra ? <p class="small">{extra}</p> : null}
      <details class="help">
        <summary>Détail en millisecondes</summary>
        <p class="small">
          En moyenne {r.mean === 0 ? 'pile à l’heure' : r.mean < 0 ? `${-r.mean} ms en avance` : `${r.mean} ms en retard`}, régularité ± {r.spread} ms. « En place » = à moins de{' '}
          {Math.round(tol)} ms (un clin d’œil dure 100 ms).
        </p>
        {devs ? (
          <p class="r-devs">
            {devs.map((d, i) => (
              <span key={i} class={d === null ? 'miss' : Math.abs(d) <= tol ? 'ok' : d < 0 ? 'early' : 'late'}>
                {d === null ? '—' : d > 0 ? `+${d}` : d}
              </span>
            ))}
            <small> ms par coup (− : en avance)</small>
          </p>
        ) : null}
      </details>
    </div>
  );
}

// ---------------------------------------------------------------- Réglage du décalage

function Calibrate({ input, onDone, onCancel }: { input: Input; onDone: (ms: number) => void; onCancel: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'run' | 'fail' | 'bleed' | 'done'>('ready');
  const [ms, setMs] = useState(0);
  const clicks = useRef<number[]>([]);
  const hits = useHits(phase === 'run', input);
  const [clock, runClock] = useBeatClock();
  const timer = useRef(0);
  useEffect(() => () => (clearTimeout(timer.current), stopPlayback()), []);
  const spb = 60 / 72;
  const run = () => {
    audio();
    hits.reset();
    const t0 = now() + 0.3;
    // 4 clics de décompte, puis 8 clics à suivre.
    const all = Array.from({ length: 12 }, (_, i) => ({ t: t0 + i * spb, accent: i % 4 === 0 }));
    clicks.current = all.slice(4).map((c) => c.t);
    playClicks(all);
    runClock(t0 + 4 * spb, spb, 8);
    setPhase('run');
    timer.current = window.setTimeout(
      () => {
        if (input === 'mic' && countInHits(hits.hits.current, clicks.current[0], spb) >= 2) return setPhase('bleed');
        const r = calibrate(clicks.current, hits.hits.current);
        if (r === null) return setPhase('fail');
        setMs(Math.max(-150, Math.min(400, r)));
        setPhase('done');
      },
      (t0 - now() + 12 * spb + 0.4) * 1000
    );
  };
  const what = input === 'mic' ? 'joue une note au piano' : 'tape la zone';
  return (
    <div class="screen play-screen">
      <TopBar title="Réglage (10 secondes)" onBack={onCancel} />
      <p class="intro">
        Le téléphone a un petit retard entre le son et l’écran{input === 'mic' ? ' (et le micro)' : ''}. Pour le mesurer : après le décompte, {what} pile sur chacun des 8 clics.
      </p>
      {phase === 'run' ? (
        clock.count ? (
          <Say>
            <CountIn count={clock.count} />
            Écoute le décompte…
          </Say>
        ) : (
          <Say>
            {input === 'mic' ? 'Joue' : 'Tape'} sur chaque clic ! <span class="muted">Clic {Math.min(8, (clock.beat ?? 7) + 1)} / 8</span>
          </Say>
        )
      ) : phase === 'done' ? (
        <Say tone="ok">Réglé : {ms} ms de décalage, corrigé automatiquement.</Say>
      ) : phase === 'fail' ? (
        <Say tone="bad">Pas assez de coups réguliers. Recommence, bien sur les clics.</Say>
      ) : phase === 'bleed' ? (
        <BleedWarning />
      ) : (
        <Say>Prêt ? Lance les clics.</Say>
      )}
      <div class="thumb-zone">
        <TapPad input={input} active={phase === 'run'} count={hits.count} onTap={hits.tap} />
        {phase === 'done' ? (
          <StartButton label="Continuer" onClick={() => onDone(ms)} />
        ) : (
          <StartButton label={phase === 'run' ? 'En cours…' : phase === 'ready' ? 'Lancer les clics' : 'Recommencer'} disabled={phase === 'run'} onClick={run} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Lire et taper

/** Écarts regroupés par case du motif (moyenne sur les répétitions). */
function marksOf(p: RPattern, r: TimingResult, tol: number): { marks: Record<number, HitMark>; devs: (number | null)[] } {
  const n = p.hits.length;
  const marks: Record<number, HitMark> = {};
  const devs: (number | null)[] = [];
  p.hits.forEach((tick, i) => {
    const d = r.matches.filter((_, k) => k % n === i).map((m) => m.dev);
    const got = d.filter((x): x is number => x !== null);
    if (got.length < d.length / 2) {
      marks[tick] = 'miss';
      devs.push(null);
      return;
    }
    const mean = Math.round(got.reduce((s, x) => s + x, 0) / got.length);
    devs.push(mean);
    marks[tick] = Math.abs(mean) <= tol ? 'ok' : mean < 0 ? 'early' : 'late';
  });
  return { marks, devs };
}

function TapRhythm({ saved, set, onBack }: { saved: Saved; set: SetSaved; onBack: () => void }) {
  const level = saved.level;
  const pool = rhythmsOf(level);
  const choose = (prev?: string) =>
    weightedPick(
      pool.filter((p) => p.id !== prev || pool.length === 1),
      (p) => 1 + 3 * (1 - ((saved.patterns[p.id]?.c ?? 0) + 1) / ((saved.patterns[p.id]?.t ?? 0) + 2))
    );
  const [p, setP] = useState<RPattern>(() => choose());
  const tempo = saved.tempo[level] ?? LEVEL_TEMPO[level];
  const [phase, setPhase] = useState<'listen' | 'demo' | 'ready' | 'take' | 'done'>('listen');
  const [result, setResult] = useState<{ r: TimingResult; marks: Record<number, HitMark>; devs: (number | null)[]; bleed: boolean; ok: boolean } | null>(null);
  const timer = useRef(0);
  const hits = useHits(phase === 'take', saved.input);
  const tol = tolerance(tempo);
  const [cursor, follow, unfollow] = useCursor();
  const [clock, runClock, stopClock] = useBeatClock();
  useEffect(() => () => (clearTimeout(timer.current), stopPlayback()), []);
  const beats = p.bars * 4;

  const demo = () => {
    clearTimeout(timer.current);
    setResult(null);
    const t = playRhythm(p, tempo, { reps: 1, demo: true, feel: 'swing' });
    follow(t, p);
    runClock(t.start, 60 / tempo, beats);
    setPhase('demo');
    timer.current = window.setTimeout(() => setPhase('ready'), (t.end - now() + 0.2) * 1000);
  };
  const go = () => {
    clearTimeout(timer.current);
    unfollow();
    hits.reset();
    setResult(null);
    const t = playRhythm(p, tempo, { reps: 2, demo: false, feel: 'swing' });
    runClock(t.start, 60 / tempo, beats * 2);
    setPhase('take');
    timer.current = window.setTimeout(
      () => {
        const r = scoreTiming(t.targets, hits.hits.current, tol, saved.offsets[saved.input] ?? 0);
        const m = marksOf(p, r, tol);
        const ok = r.good === t.targets.length && r.extra <= 1;
        setResult({ r, ...m, ok, bleed: saved.input === 'mic' && countInHits(hits.hits.current, t.start, 60 / tempo) >= 2 });
        report({ type: 'answer', exo: 'rythme-taper', level, ok, ms: (t.end - t.start) * 1000 });
        setPhase('done');
        const it = saved.patterns[p.id] ?? { c: 0, t: 0 };
        set({ patterns: { ...saved.patterns, [p.id]: { c: it.c + (ok ? 1 : 0), t: it.t + 1 } } });
      },
      (t.end - now() + 0.35) * 1000
    );
  };
  const next = () => {
    if (result?.ok) set({ tempo: { ...saved.tempo, [level]: Math.min(240, tempo + 4) } });
    stopClock();
    setP(choose(p.id));
    setResult(null);
    setPhase('listen');
  };
  const busy = phase === 'demo' || phase === 'take';
  const step = phase === 'listen' || phase === 'demo' ? 0 : phase === 'done' ? 2 : 1;
  const beatInPattern = clock.beat === null ? null : clock.beat % beats;

  let say: ComponentChildren;
  if (clock.count && busy)
    say = (
      <Say>
        <CountIn count={clock.count} />
        {phase === 'take' ? 'Prépare-toi, ça part après le 4…' : 'Décompte…'}
      </Say>
    );
  else if (phase === 'listen') say = <Say>Écoute d’abord le rythme, en suivant les cases.</Say>;
  else if (phase === 'demo') say = <Say>Écoute… chaque coup s’allume dans la grille.</Say>;
  else if (phase === 'ready') say = <Say>À toi : tape les cases pleines, 2 fois de suite, sur la batterie.</Say>;
  else if (phase === 'take') say = <Say>Tape ! {clock.beat !== null && clock.beat >= beats ? '2e fois' : '1re fois'}</Say>;
  else say = null;

  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onBack}>
          Arrêter
        </button>
        <span class="play-meta">
          {levelShort(level)} · {tempo} BPM
        </span>
        <TempoMini value={tempo} onChange={(v) => set({ tempo: { ...saved.tempo, [level]: v } })} disabled={busy} />
      </header>
      <Steps steps={['Écouter', 'Taper 2 fois', 'Résultat']} at={step} />
      <section class="r-card">
        <div class="r-head">
          <b>{p.name}</b>
          <span class="muted small">{p.straight ? 'croches égales' : p.triplet ? 'triolets' : 'swing'}</span>
        </div>
        <RhythmGrid p={p} marks={result?.marks} active={cursor} beat={busy ? beatInPattern : null} />
        {result ? (
          <p class="r-legend">
            <i class="ok" /> en place <i class="early" /> trop tôt <i class="late" /> trop tard <i class="miss" /> oublié
          </p>
        ) : (
          <GridLegend />
        )}
        <p class="muted small">
          On compte : {countOf(p)}. {p.hint}
        </p>
      </section>
      {say}
      {result ? (
        <Verdict
          r={result.r}
          tol={tol}
          devs={result.devs}
          extra={result.ok ? `Réussi : au suivant, le tempo passe à ${Math.min(240, tempo + 4)} BPM.` : 'Réécoute si besoin, puis réessaie.'}
        />
      ) : null}
      {result?.bleed ? <BleedWarning /> : null}
      <div class="thumb-zone">
        <TapPad input={saved.input} active={phase === 'take'} count={hits.count} onTap={hits.tap} />
        <div class="row-actions">
          {phase === 'listen' || phase === 'demo' ? (
            <button class="btn primary" disabled={busy} onClick={demo}>
              <PlayIcon /> {phase === 'demo' ? 'Écoute…' : 'Écouter'}
            </button>
          ) : (
            <>
              <button class="btn" disabled={busy} onClick={demo}>
                <PlayIcon /> Réécouter
              </button>
              {phase === 'done' ? (
                <>
                  <button class="btn" onClick={go}>
                    Réessayer
                  </button>
                  <button class="btn primary" onClick={next}>
                    Suivant
                  </button>
                </>
              ) : (
                <button class="btn primary" disabled={busy} onClick={go}>
                  {phase === 'take' ? 'À toi…' : 'À toi'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Tenir le tempo

/** Une mesure : où sonne le clic, où taper, et le temps en cours. */
function BeatRow({ v, bar, beat }: { v: Variant; bar: number; beat: number | null }) {
  const heard = v.heard(bar);
  return (
    <div class="beatrow" role="img" aria-label="Où sonne le clic, où taper">
      <span class="br-head" />
      {[1, 2, 3, 4].map((n) => (
        <span key={n} class={'br-num' + (beat === n - 1 ? ' now' : '')}>
          {n}
        </span>
      ))}
      <span class="br-head">Clic</span>
      {[0, 1, 2, 3].map((b) => (
        <span key={b} class={'br-cell' + (beat === b ? ' now' : '')}>
          {heard && v.clicks.includes(b) ? <i class="br-click" /> : <i class="br-none" />}
        </span>
      ))}
      <span class="br-head">Toi</span>
      {[0, 1, 2, 3].map((b) => (
        <span key={b} class={'br-cell' + (beat === b ? ' now' : '')}>
          {v.taps.includes(b) ? <i class="br-tap" /> : <i class="br-none" />}
        </span>
      ))}
    </div>
  );
}

function KeepTime({ saved, set, onBack }: { saved: Saved; set: SetSaved; onBack: () => void }) {
  const v = VARIANTS[saved.variant] ?? VARIANTS[0];
  const tempo = saved.keepTempo;
  const [phase, setPhase] = useState<'ready' | 'take' | 'done'>('ready');
  const [result, setResult] = useState<{ r: TimingResult; drift: number; bleed: boolean } | null>(null);
  const hits = useHits(phase === 'take', saved.input);
  const [clock, runClock] = useBeatClock();
  const timer = useRef(0);
  const tol = tolerance(tempo);
  useEffect(() => () => (clearTimeout(timer.current), stopPlayback()), []);
  const go = () => {
    audio();
    hits.reset();
    setResult(null);
    const spb = 60 / tempo;
    const t0 = now() + 0.3;
    const clicks: { t: number; accent?: boolean; sound?: 'click' | 'hat' }[] = [];
    for (let i = 0; i < 4; i++) clicks.push({ t: t0 + i * spb, accent: i === 0 });
    const start = t0 + 4 * spb;
    const targets: number[] = [];
    for (let bar = 0; bar < BARS; bar++)
      for (let b = 0; b < 4; b++) {
        const t = start + (bar * 4 + b) * spb;
        if (v.heard(bar) && v.clicks.includes(b)) clicks.push({ t, accent: b === 0, sound: v.hat ? 'hat' : 'click' });
        if (v.taps.includes(b)) targets.push(t);
      }
    playClicks(clicks);
    runClock(start, spb, BARS * 4);
    setPhase('take');
    timer.current = window.setTimeout(
      () => {
        const r = scoreTiming(targets, hits.hits.current, tol, saved.offsets[saved.input] ?? 0);
        setResult({ r, drift: drift(r.matches, (spb * 4) / v.taps.length), bleed: saved.input === 'mic' && countInHits(hits.hits.current, start, spb) >= 2 });
        const ratio = r.matches.length ? r.good / r.matches.length : 0;
        report({ type: 'answer', exo: 'rythme-tempo', level: saved.variant, ok: ratio >= 0.9 && r.extra <= 2, ms: BARS * 4 * spb * 1000 });
        report({ type: 'tempo', level: saved.variant, ratio });
        setPhase('done');
      },
      (start - now() + BARS * 4 * spb + 0.4) * 1000
    );
  };
  const bar = clock.beat === null ? 0 : Math.floor(clock.beat / 4);
  const beat = clock.beat === null ? null : clock.beat % 4;
  let say: ComponentChildren;
  if (phase === 'take' && clock.count)
    say = (
      <Say>
        <CountIn count={clock.count} />
        Écoute le décompte, ça part après le 4…
      </Say>
    );
  else if (phase === 'take')
    say = (
      <Say>
        {v.heard(bar) ? 'Tape !' : 'Le clic se tait : continue seul !'} <span class="muted">Mesure {bar + 1} / {BARS}</span>
      </Say>
    );
  else if (phase === 'ready') say = <Say>{v.hint}</Say>;
  else say = null;
  const driftText = result
    ? Math.abs(result.drift) < 2
      ? 'Tempo stable du début à la fin.'
      : result.drift > 0
        ? `Tu accélères (environ +${result.drift} BPM sur la fin).`
        : `Tu ralentis (environ ${result.drift} BPM sur la fin).`
    : '';
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onBack}>
          Arrêter
        </button>
        <span class="play-meta">
          {levelShort(saved.variant)} · {tempo} BPM
        </span>
        <TempoMini value={tempo} onChange={(keepTempo) => set({ keepTempo })} disabled={phase === 'take'} />
      </header>
      <Steps steps={['Décompte', `Taper ${BARS} mesures`, 'Résultat']} at={phase === 'done' ? 2 : phase === 'take' && !clock.count ? 1 : 0} />
      <section class="r-card">
        <div class="r-head">
          <b>{v.name}</b>
        </div>
        <BeatRow v={v} bar={phase === 'take' ? bar : 0} beat={phase === 'take' ? beat : null} />
        <p class="muted small">● le clic sonne · ○ à toi de taper.</p>
      </section>
      {say}
      {result ? (
        <>
          <Verdict r={result.r} tol={tol} what="temps" extra={driftText} />
          <Timeline r={result.r} tol={tol} />
          {result.bleed ? <BleedWarning /> : null}
        </>
      ) : null}
      <div class="thumb-zone">
        <TapPad input={saved.input} active={phase === 'take'} count={hits.count} onTap={hits.tap} />
        <StartButton label={phase === 'take' ? 'En cours…' : phase === 'done' ? 'Recommencer' : 'Commencer'} disabled={phase === 'take'} onClick={go} />
      </div>
    </div>
  );
}

/** Écart de chaque coup, du début à la fin : on voit si on accélère ou si on ralentit. */
function Timeline({ r, tol }: { r: TimingResult; tol: number }) {
  const max = Math.max(tol * 2, ...r.matches.map((m) => Math.abs(m.dev ?? 0)));
  return (
    <div class="tl-wrap">
      <small>Chaque barre = un coup, du premier au dernier. ↑ trop tard</small>
      <div class="timeline" aria-label="Écart de chaque coup">
        {r.matches.map((m, i) => (
          <span key={i} class="tl-col">
            {m.dev === null ? (
              <i class="tl-miss" />
            ) : (
              <i
                class={'tl-bar ' + (Math.abs(m.dev) <= tol ? 'ok' : m.dev < 0 ? 'early' : 'late')}
                style={`height:${Math.max(2, (Math.abs(m.dev) / max) * 50)}%;${m.dev > 0 ? 'bottom:50%' : 'top:50%'}`}
              />
            )}
          </span>
        ))}
        <span class="tl-axis" />
      </div>
      <small>↓ trop tôt</small>
    </div>
  );
}

// ---------------------------------------------------------------- Reconnaître un rythme

function EarRhythm({ saved, set, onBack }: { saved: Saved; set: SetSaved; onBack: () => void }) {
  const level = saved.level;
  const tempo = saved.tempo[level] ?? LEVEL_TEMPO[level];
  const makeQ = () => {
    const pairs = confusions('rythme');
    if (saved.focus === 'confusions' && pairs.length) {
      const p = weightedPick(pairs, (x) => Math.min(4, x.score));
      const ids = shuffle([p.a, p.b]);
      const answer = rhythmById(ids[0]);
      const other = rhythmById(ids[1]);
      if (answer && other) return { answer, choices: shuffle([answer, other]), duel: true };
    }
    const pool = rhythmsOf(level);
    const answer = weightedPick(pool, (x) => confusionWeight(pairs, x.id) * (1 + 2 * (1 - ((saved.patterns['ear:' + x.id]?.c ?? 0) + 1) / ((saved.patterns['ear:' + x.id]?.t ?? 0) + 2))));
    const fits = (x: RPattern) => x.id !== answer.id && x.bars === answer.bars && !!x.triplet === !!answer.triplet;
    const rivals = rivalsOf(pairs, answer.id).map(rhythmById).filter((x): x is RPattern => !!x && fits(x));
    const same = shuffle(pool.filter((x) => fits(x) && !rivals.includes(x)));
    const others = shuffle(RHYTHMS.filter((x) => x.level !== level && fits(x) && !rivals.includes(x)));
    return { answer, choices: shuffle([answer, ...[...rivals.slice(0, 2), ...same, ...others].slice(0, 3)]), duel: false };
  };
  const [q, setQ] = useState(makeQ);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ c: 0, t: 0 });
  const [clock, runClock] = useBeatClock();
  const listen = (p: RPattern = q.answer) => {
    const t = playRhythm(p, tempo, { reps: 2, demo: true, feel: 'swing' });
    runClock(t.start, 60 / tempo, p.bars * 8);
  };
  useEffect(() => listen(), [q]);
  useEffect(() => () => stopPlayback(), []);
  const choose = (id: string) => {
    if (picked) return;
    setPicked(id);
    recordAnswer('rythme', q.answer.id, id, q.choices.map((c) => c.id));
    const ok = id === q.answer.id;
    setScore((s) => ({ c: s.c + (ok ? 1 : 0), t: s.t + 1 }));
    const it = saved.patterns['ear:' + q.answer.id] ?? { c: 0, t: 0 };
    set({ patterns: { ...saved.patterns, ['ear:' + q.answer.id]: { c: it.c + (ok ? 1 : 0), t: it.t + 1 } } });
  };
  const qStart = useRef(performance.now());
  const next = (guessed = false) => {
    if (picked) report({ type: 'answer', exo: 'rythme-oreille', level, ok: picked === q.answer.id && !guessed, ms: performance.now() - qStart.current, duel: q.duel });
    qStart.current = performance.now();
    setPicked(null);
    setQ(makeQ());
  };
  // « J'ai deviné » : la réponse juste compte comme une erreur, pour revenir.
  const guess = () => {
    setScore((s) => ({ ...s, c: s.c - 1 }));
    const it = saved.patterns['ear:' + q.answer.id];
    if (it) set({ patterns: { ...saved.patterns, ['ear:' + q.answer.id]: { c: Math.max(0, it.c - 1), t: it.t } } });
    next(true);
  };
  const ok = picked === q.answer.id;
  const playing = clock.count !== null || clock.beat !== null;
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onBack}>
          Arrêter
        </button>
        <span class="play-meta">
          {q.duel ? 'Mes confusions' : levelShort(level)} · {score.c}/{score.t}
        </span>
        <span />
      </header>
      {picked ? (
        <div class="fb">
          <p class={'verdict ' + (ok ? 'ok' : 'bad')}>
            {ok ? 'Juste : ' : 'Non, c’était : '}
            {q.answer.name}.
          </p>
          <p class="muted">
            On compte : {countOf(q.answer)}. {q.answer.hint}
          </p>
          {!ok || q.duel ? <RhythmCompare a={q.answer} b={q.choices.find((c) => c.id !== q.answer.id && (ok || c.id === picked))!} tempo={tempo} /> : null}
        </div>
      ) : clock.count ? (
        <Say>
          <CountIn count={clock.count} />
          Décompte…
        </Say>
      ) : (
        <Say>{playing ? 'Écoute… (2 fois)' : 'Quel rythme as-tu entendu ? Touche-le.'}</Say>
      )}
      {picked ? null : <GridLegend />}
      <div class="thumb-zone">
        <div class="r-choices">
          {q.choices.map((c) => {
            const state = picked ? (c.id === q.answer.id ? ' is-ok' : c.id === picked ? ' is-bad' : '') : '';
            return (
              <button key={c.id} class={'choice r-choice' + state} disabled={!!picked} onClick={() => choose(c.id)}>
                <RhythmGrid p={c} small />
              </button>
            );
          })}
        </div>
        {picked ? (
          <AnswerActions ok={ok} onNext={() => next()} onGuess={guess} />
        ) : (
          <button class="btn" disabled={playing} onClick={() => listen()}>
            <PlayIcon /> Réécouter
          </button>
        )}
      </div>
    </div>
  );
}

/** Réécouter côte à côte le bon rythme et celui qu'on a pris pour lui. */
function RhythmCompare({ a, b, tempo }: { a: RPattern; b?: RPattern; tempo: number }) {
  if (!b) return null;
  return (
    <div class="compare">
      <span class="label">Compare</span>
      <div class="row-actions">
        {[a, b].map((p) => (
          <button key={p.id} class="btn sm" onClick={() => playRhythm(p, tempo, { reps: 1, demo: true, feel: 'swing' })}>
            <PlayIcon /> {p.name}
          </button>
        ))}
      </div>
      <p class="small">
        {a.name} : {countOf(a)}. {b.name} : {countOf(b)}.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Reconnaître un style

function EarStyle({ saved, set, onBack }: { saved: Saved; set: SetSaved; onBack: () => void }) {
  const makeQ = () => {
    const pairs: Pair[] = confusions('style');
    if (saved.focus === 'confusions' && pairs.length) {
      const p = weightedPick(pairs, (x) => Math.min(4, x.score));
      const two = shuffle([p.a, p.b]) as StyleId[];
      return { answer: two[0], choices: shuffle(two), duel: true };
    }
    const answer = weightedPick(STYLE_ORDER, (id) => confusionWeight(pairs, id) * (1 + 3 * (1 - ((saved.styles[id]?.c ?? 0) + 1) / ((saved.styles[id]?.t ?? 0) + 2))));
    const rivals = rivalsOf(pairs, answer).filter((x): x is StyleId => STYLE_ORDER.includes(x as StyleId)).slice(0, 2);
    const rest = shuffle(STYLE_ORDER.filter((x) => x !== answer && !rivals.includes(x)));
    return { answer, choices: shuffle([answer, ...[...rivals, ...rest].slice(0, 3)]), duel: false };
  };
  const [q, setQ] = useState(makeQ);
  const [picked, setPicked] = useState<StyleId | null>(null);
  const [playing, setPlaying] = useState<StyleId | null>(null);
  const [score, setScore] = useState({ c: 0, t: 0 });
  const timer = useRef(0);
  const listen = (id: StyleId) => {
    clearTimeout(timer.current);
    const g = playGroove(id, 4);
    setPlaying(id);
    timer.current = window.setTimeout(() => setPlaying(null), g.duration * 1000 + 300);
  };
  useEffect(() => listen(q.answer), [q]);
  useEffect(() => () => (clearTimeout(timer.current), stopPlayback()), []);
  const choose = (id: StyleId) => {
    if (picked) return;
    setPicked(id);
    recordAnswer('style', q.answer, id, q.choices);
    const ok = id === q.answer;
    setScore((s) => ({ c: s.c + (ok ? 1 : 0), t: s.t + 1 }));
    const it = saved.styles[q.answer] ?? { c: 0, t: 0 };
    set({ styles: { ...saved.styles, [q.answer]: { c: it.c + (ok ? 1 : 0), t: it.t + 1 } } });
  };
  const qStart = useRef(performance.now());
  const next = (guessed = false) => {
    if (picked) report({ type: 'answer', exo: 'rythme-style', level: 0, ok: picked === q.answer && !guessed, ms: performance.now() - qStart.current, duel: q.duel });
    qStart.current = performance.now();
    setPicked(null);
    setQ(makeQ());
  };
  const guess = () => {
    setScore((s) => ({ ...s, c: s.c - 1 }));
    const it = saved.styles[q.answer];
    if (it) set({ styles: { ...saved.styles, [q.answer]: { c: Math.max(0, it.c - 1), t: it.t } } });
    next(true);
  };
  const g = GROOVES[q.answer];
  const ok = picked === q.answer;
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onBack}>
          Arrêter
        </button>
        <span class="play-meta">
          {q.duel ? 'Mes confusions · ' : ''}
          {score.c}/{score.t}
        </span>
        <span />
      </header>
      {picked ? (
        <div class="fb">
          <p class={'verdict ' + (ok ? 'ok' : 'bad')}>
            {ok ? 'Juste : ' : 'Non, c’était : '}
            {g.name}.
          </p>
          <p class="muted">{g.summary}</p>
          <ul class="cues">
            {g.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p class="small muted">Compare, en touchant un style :</p>
          <div class="chips text">
            {q.choices.map((id) => (
              <button key={id} class="chip" aria-pressed={playing === id} onClick={() => listen(id)}>
                {GROOVES[id].name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Say>{playing === q.answer ? 'Écoute la batterie, la basse et le piano…' : 'Quel style ? Touche ta réponse.'}</Say>
      )}
      <div class="thumb-zone">
        <div class="choices">
          {q.choices.map((id) => {
            const state = picked ? (id === q.answer ? ' is-ok' : id === picked ? ' is-bad' : '') : '';
            return (
              <button key={id} class={'choice text' + state} disabled={!!picked} onClick={() => choose(id)}>
                {GROOVES[id].name}
              </button>
            );
          })}
        </div>
        {picked ? (
          <AnswerActions ok={ok} onNext={() => next()} onGuess={guess} />
        ) : (
          <button class="btn" disabled={!!playing} onClick={() => listen(q.answer)}>
            <PlayIcon /> Réécouter
          </button>
        )}
      </div>
    </div>
  );
}
