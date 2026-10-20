// Rythme : taper un rythme, garder le tempo, reconnaître un rythme ou un style.
import { useEffect, useRef, useState } from 'preact/hooks';
import { RHYTHMS, RHYTHM_LEVELS, RPattern, countOf, rhythmsOf } from '../../core/rhythm/patterns';
import { calibrate, countInHits, drift, scoreTiming, tendency, tolerance, TimingResult } from '../../core/rhythm/timing';
import { GROOVES, STYLE_ORDER, StyleId } from '../../core/rhythm/styles';
import { Take, playClicks, playGroove, playRhythm, stopPlayback } from '../../core/rhythm/play';
import { audio, now } from '../../core/audio/engine';
import { startMic, useMicRelease, useMicState } from '../../core/listen/mic';
import { load, save } from '../../core/storage';
import { pick, shuffle, weightedPick } from '../../core/random';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Field, LevelPicker, MoreOptions, StartButton, levelShort } from '../../ui/Setup';
import { MicPill } from '../../ui/MicPill';
import { RhythmGrid, HitMark, useCursor } from '../../ui/RhythmGrid';
import { AnswerActions } from '../../ui/AnswerActions';
import { PlayIcon } from '../../ui/icons';
import { Input, useHits } from './input';

type Exercise = 'taper' | 'tempo' | 'oreille' | 'style';
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
}
const DEFAULT: Saved = {
  exercise: 'taper',
  input: 'tap',
  level: 0,
  tempo: {},
  variant: 0,
  keepTempo: 90,
  offsets: {},
  patterns: {},
  styles: {}
};
const LEVEL_TEMPO = [80, 80, 90, 100, 70, 100];

const EXERCISES: { value: Exercise; label: string; sub: string }[] = [
  {
    value: 'taper',
    label: 'Taper un rythme',
    sub: 'Lire, puis jouer bien en place'
  },
  {
    value: 'tempo',
    label: 'Garder le tempo',
    sub: '2 et 4, clic qui disparaît'
  },
  {
    value: 'oreille',
    label: 'Quel rythme ?',
    sub: 'Le reconnaître à l’oreille'
  },
  { value: 'style', label: 'Quel style ?', sub: 'Swing, bossa, samba…' }
];

const VARIANTS = [
  {
    name: 'Clic sur les 4 temps, tape 2 et 4',
    clicks: [0, 1, 2, 3],
    taps: [1, 3],
    hint: 'Le charleston du batteur : en jazz, la pulsation s’appuie sur 2 et 4.'
  },
  {
    name: 'Clic sur 2 et 4, tape les 4 temps',
    clicks: [1, 3],
    taps: [0, 1, 2, 3],
    hint: 'Le métronome ne marque que 2 et 4 : à toi de sentir le 1 et le 3.'
  },
  {
    name: 'Clic une mesure sur deux',
    clicks: [0, 1, 2, 3],
    taps: [0, 1, 2, 3],
    silentBars: true,
    hint: 'Une mesure guidée, une mesure seul : garde le même tempo.'
  },
  {
    name: 'Deux mesures de clic, puis seul',
    clicks: [0, 1, 2, 3],
    taps: [0, 1, 2, 3],
    solo: true,
    hint: 'Le vrai test : 6 mesures sans aide.'
  }
];

/** piano : arrivée depuis « Au piano », on écoute le micro. */
export function Rythme({ piano }: { piano?: boolean }) {
  const [saved, setSaved] = useState<Saved>(() => {
    const s = { ...DEFAULT, ...load('rythme', DEFAULT) };
    return piano
      ? {
          ...s,
          input: 'mic',
          exercise: s.exercise === 'oreille' || s.exercise === 'style' ? 'taper' : s.exercise
        }
      : s;
  });
  const [phase, setPhase] = useState<'setup' | 'calibrate' | 'play'>('setup');
  useEffect(() => save('rythme', saved), [saved]);
  useEffect(() => () => stopPlayback(), []);
  useMicRelease();
  const set = (p: Partial<Saved>) => setSaved((s) => ({ ...s, ...p }));

  if (phase === 'calibrate')
    return (
      <Calibrate
        input={saved.input}
        onDone={(ms) => {
          if (ms !== null) set({ offsets: { ...saved.offsets, [saved.input]: ms } });
          setPhase(ms !== null ? 'setup' : 'calibrate');
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
  return <Setup saved={saved} set={set} onStart={() => setPhase('play')} onCalibrate={() => setPhase('calibrate')} />;
}

// ---------------------------------------------------------------- Réglages

function Setup({ saved, set, onStart, onCalibrate }: { saved: Saved; set: (p: Partial<Saved>) => void; onStart: () => void; onCalibrate: () => void }) {
  const timed = saved.exercise === 'taper' || saved.exercise === 'tempo';
  const offset = saved.offsets[saved.input];
  const start = async () => {
    audio();
    if (timed && saved.input === 'mic') await startMic({ echo: true });
    if (timed && offset === undefined) onCalibrate();
    else onStart();
  };
  return (
    <div class="screen">
      <TopBar title="Rythme" actions={timed && saved.input === 'mic' ? <MicPill echo /> : undefined} />
      <p class="intro">Le placement, le tempo et les styles. Au casque dans le métro, ou au piano avec le micro.</p>
      <Field label="Exercice">
        <Segmented cards cols={2} label="Exercice" value={saved.exercise} onChange={(exercise) => set({ exercise })} options={EXERCISES} />
      </Field>
      {saved.exercise === 'taper' || saved.exercise === 'oreille' ? (
        <LevelPicker levels={RHYTHM_LEVELS.map((l) => ({ name: l.label, desc: l.desc }))} value={saved.level} onChange={(level) => set({ level })} />
      ) : null}
      {saved.exercise === 'tempo' ? <LevelPicker levels={VARIANTS.map((v) => ({ name: v.name, desc: v.hint }))} value={saved.variant} onChange={(variant) => set({ variant })} /> : null}
      {saved.exercise === 'style' ? (
        <p class="muted small">
          Quatre mesures d’un style, à reconnaître parmi : {STYLE_ORDER.map((id) => GROOVES[id].name).join(', ')}. Les indices pour les entendre sont donnés après chaque réponse.
        </p>
      ) : null}
      {timed ? (
        <Field label="Répondre">
          <Segmented
            label="Répondre"
            value={saved.input}
            onChange={(input) => set({ input })}
            options={[
              { value: 'tap', label: 'Sur l’écran', sub: 'Tape l’écran avec un doigt, au casque de préférence.' },
              { value: 'mic', label: 'Au piano', sub: 'Une note ou un accord par attaque : le micro mesure le placement. Avec un écouteur, il n’entend pas le métronome.' }
            ]}
          />
        </Field>
      ) : null}
      {timed ? (
        <MoreOptions summary={(saved.exercise === 'tempo' ? `${saved.keepTempo} BPM · ` : '') + (offset === undefined ? 'calibration à faire' : `décalage corrigé : ${offset} ms`)}>
          {saved.exercise === 'tempo' ? <TempoStepper value={saved.keepTempo} onChange={(keepTempo) => set({ keepTempo })} /> : null}
          <p class="muted small">
            {offset === undefined
              ? 'La calibration (10 secondes) corrige le décalage du téléphone ; elle se lance au premier exercice. '
              : `Décalage mesuré : ${offset} ms, corrigé automatiquement. `}
            <button class="linkbtn inline" onClick={onCalibrate}>
              {offset === undefined ? 'Calibrer maintenant' : 'Recalibrer'}
            </button>
          </p>
        </MoreOptions>
      ) : null}
      <StartButton onClick={start} />
    </div>
  );
}

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

/** Zone à taper (écran) ou rappel du micro. */
function TapPad({ input, active, count, onTap }: { input: Input; active: boolean; count: number; onTap: (e: PointerEvent) => void }) {
  const mic = useMicState();
  if (input === 'mic')
    return (
      <div class={'tap-pad mic' + (active ? ' live' : '')}>
        {mic === 'on' ? (
          <span>
            <i class="rec" /> {active ? `J’écoute ton piano… ${count ? `(${count})` : ''}` : 'Micro prêt'}
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
        {active ? 'Tape ici' : 'Zone de frappe'}
      </span>
    </button>
  );
}

function BleedWarning() {
  return (
    <p class="verdict bad">
      Le micro a entendu des attaques pendant le décompte : il capte sans doute le métronome du haut-parleur. Mets un écouteur (ou baisse le volume), et ne joue pas pendant le
      décompte.
    </p>
  );
}

// ---------------------------------------------------------------- Calibration

function Calibrate({ input, onDone, onCancel }: { input: Input; onDone: (ms: number | null) => void; onCancel: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'run' | 'fail' | 'bleed'>('ready');
  const clicks = useRef<number[]>([]);
  const hits = useHits(phase === 'run', input);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = () => {
    audio();
    hits.reset();
    const spb = 60 / 72;
    const t0 = now() + 0.3;
    // 4 clics de décompte, puis 8 clics à suivre.
    const all = Array.from({ length: 12 }, (_, i) => ({
      t: t0 + i * spb,
      accent: i % 4 === 0
    }));
    clicks.current = all.slice(4).map((c) => c.t);
    playClicks(all);
    setPhase('run');
    timer.current = window.setTimeout(
      () => {
        if (input === 'mic' && countInHits(hits.hits.current, clicks.current[0], spb) >= 2) return setPhase('bleed');
        const ms = calibrate(clicks.current, hits.hits.current);
        if (ms === null) setPhase('fail');
        else onDone(Math.max(-150, Math.min(400, ms)));
      },
      (t0 - now() + 12 * spb + 0.4) * 1000
    );
  };
  return (
    <div class="screen play-screen">
      <TopBar title="Calibration" onBack={onCancel} />
      <p class="intro">
        Après 4 clics de décompte, {input === 'mic' ? 'joue une note au piano' : 'tape l’écran'} exactement sur chacun des 8 clics suivants. L’appli mesure le décalage du téléphone
        {input === 'mic' ? ' et du micro' : ' (écran, son)'} et le corrige ensuite.
      </p>
      {phase === 'fail' ? <p class="verdict bad">Pas assez d’attaques régulières. Recommence, bien sur les clics.</p> : null}
      {phase === 'bleed' ? <BleedWarning /> : null}
      <div class="thumb-zone">
        <TapPad input={input} active={phase === 'run'} count={hits.count} onTap={hits.tap} />
        <button class="btn primary block" disabled={phase === 'run'} onClick={run}>
          {phase === 'run' ? 'En cours…' : phase === 'ready' ? 'Lancer les clics' : 'Recommencer'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Taper un rythme

const sameText = (a: string, b: string) => a.replace(/[«»\s]/g, '').toLowerCase() === b.replace(/[«»\s]/g, '').toLowerCase();

/** Écarts regroupés par attaque du motif (moyenne sur les répétitions). */
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

function TapRhythm({ saved, set, onBack }: { saved: Saved; set: (p: Partial<Saved>) => void; onBack: () => void }) {
  const level = saved.level;
  const pool = rhythmsOf(level);
  const choose = (prev?: string) =>
    weightedPick(
      pool.filter((p) => p.id !== prev || pool.length === 1),
      (p) => 1 + 3 * (1 - ((saved.patterns[p.id]?.c ?? 0) + 1) / ((saved.patterns[p.id]?.t ?? 0) + 2))
    );
  const [p, setP] = useState<RPattern>(() => choose());
  const tempo = saved.tempo[level] ?? LEVEL_TEMPO[level];
  const [phase, setPhase] = useState<'ready' | 'demo' | 'take' | 'done'>('ready');
  const [result, setResult] = useState<{
    r: TimingResult;
    marks: Record<number, HitMark>;
    devs: (number | null)[];
    bleed: boolean;
  } | null>(null);
  const take = useRef<Take | null>(null);
  const timer = useRef(0);
  const hits = useHits(phase === 'take', saved.input);
  const tol = tolerance(tempo);
  const [cursor, follow, unfollow] = useCursor();
  useEffect(() => () => (clearTimeout(timer.current), stopPlayback()), []);

  const demo = () => {
    clearTimeout(timer.current);
    setResult(null);
    const t = playRhythm(p, tempo, { reps: 1, demo: true, feel: 'swing' });
    follow(t, p);
    setPhase('demo');
    timer.current = window.setTimeout(() => setPhase('ready'), (t.end - now() + 0.2) * 1000);
  };
  const go = () => {
    clearTimeout(timer.current);
    unfollow();
    hits.reset();
    setResult(null);
    const t = playRhythm(p, tempo, { reps: 2, demo: false, feel: 'swing' });
    take.current = t;
    setPhase('take');
    timer.current = window.setTimeout(
      () => {
        const r = scoreTiming(t.targets, hits.hits.current, tol, saved.offsets[saved.input] ?? 0);
        const m = marksOf(p, r, tol);
        const bleed = saved.input === 'mic' && countInHits(hits.hits.current, t.start, 60 / tempo) >= 2;
        setResult({ r, ...m, bleed });
        setPhase('done');
        const ok = r.good === t.targets.length && r.extra <= 1;
        const it = saved.patterns[p.id] ?? { c: 0, t: 0 };
        set({
          patterns: {
            ...saved.patterns,
            [p.id]: { c: it.c + (ok ? 1 : 0), t: it.t + 1 }
          }
        });
      },
      (t.end - now() + 0.35) * 1000
    );
  };
  const next = () => {
    const allGood = result && result.r.good === result.r.matches.length && result.r.extra <= 1;
    if (allGood) set({ tempo: { ...saved.tempo, [level]: Math.min(240, tempo + 4) } });
    setP(choose(p.id));
    setResult(null);
    setPhase('ready');
  };
  const busy = phase === 'demo' || phase === 'take';
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
      <section class="r-card">
        <div class="r-head">
          <b>{p.name}</b>
          <span class="muted small">{p.straight ? 'croches droites' : p.triplet ? 'triolets' : 'swing'}</span>
        </div>
        <RhythmGrid p={p} marks={result?.marks} active={cursor} />
        {result ? (
          <p class="r-legend">
            <i class="ok" /> en place <i class="early" /> en avance <i class="late" /> en retard <i class="miss" /> manqué
          </p>
        ) : null}
        <p class="muted small">
          {sameText(p.name, countOf(p)) ? '' : `${countOf(p)}. `}
          {p.hint}
        </p>
        {result ? <ResultLine r={result.r} tol={tol} total={result.r.matches.length} devs={result.devs} /> : null}
        {result?.bleed ? <BleedWarning /> : null}
      </section>
      <div class="thumb-zone">
        <TapPad input={saved.input} active={phase === 'take'} count={hits.count} onTap={hits.tap} />
        <div class="row-actions">
          <button class="btn" disabled={busy} onClick={demo}>
            <PlayIcon /> Écouter
          </button>
          {phase === 'done' ? (
            <>
              <button class="btn" onClick={go}>
                Recommencer
              </button>
              <button class="btn primary" onClick={next}>
                Suivant
              </button>
            </>
          ) : (
            <button class="btn primary" disabled={busy} onClick={go}>
              {phase === 'take' ? 'À toi…' : 'À toi (2 fois)'}
            </button>
          )}
        </div>
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

function ResultLine({ r, tol, total, devs }: { r: TimingResult; tol: number; total: number; devs?: (number | null)[] }) {
  const missed = r.matches.filter((m) => m.dev === null).length;
  return (
    <div class="r-result">
      <p class={'verdict ' + (r.good === total && r.extra <= 1 ? 'ok' : 'bad')}>
        {r.good}/{total} en place
        {missed ? ` · ${missed} manqué${missed > 1 ? 's' : ''}` : ''}
        {r.extra ? ` · ${r.extra} en trop` : ''}
      </p>
      <p class="small">
        Tu es {tendency(r.mean, tol)}, régularité ± {r.spread} ms (« en place » : à {Math.round(tol)} ms près).
      </p>
      {devs ? (
        <p class="r-devs">
          {devs.map((d, i) => (
            <span key={i} class={d === null ? 'miss' : Math.abs(d) <= tol ? 'ok' : d < 0 ? 'early' : 'late'}>
              {d === null ? '—' : d > 0 ? `+${d}` : d}
            </span>
          ))}
          <small> ms par attaque (− : en avance)</small>
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Garder le tempo

function KeepTime({ saved, set, onBack }: { saved: Saved; set: (p: Partial<Saved>) => void; onBack: () => void }) {
  const v = VARIANTS[saved.variant];
  const tempo = saved.keepTempo;
  const [phase, setPhase] = useState<'ready' | 'take' | 'done'>('ready');
  const [result, setResult] = useState<{
    r: TimingResult;
    drift: number;
    bleed: boolean;
  } | null>(null);
  const hits = useHits(phase === 'take', saved.input);
  const timer = useRef(0);
  const tol = tolerance(tempo);
  useEffect(() => () => (clearTimeout(timer.current), stopPlayback()), []);
  const BARS = 8;
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
    for (let bar = 0; bar < BARS; bar++) {
      const heard = v.solo ? bar < 2 : v.silentBars ? bar % 2 === 0 : true;
      for (let b = 0; b < 4; b++) {
        const t = start + (bar * 4 + b) * spb;
        if (heard && v.clicks.includes(b))
          clicks.push({
            t,
            accent: b === 0,
            sound: saved.variant === 1 ? 'hat' : 'click'
          });
        if (v.taps.includes(b)) targets.push(t);
      }
    }
    playClicks(clicks);
    setPhase('take');
    timer.current = window.setTimeout(
      () => {
        const r = scoreTiming(targets, hits.hits.current, tol, saved.offsets[saved.input] ?? 0);
        setResult({
          r,
          drift: drift(r.matches, (spb * 4) / v.taps.length),
          bleed: saved.input === 'mic' && countInHits(hits.hits.current, start, spb) >= 2
        });
        setPhase('done');
      },
      (start - now() + BARS * 4 * spb + 0.4) * 1000
    );
  };
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
      <section class="r-card">
        <div class="r-head">
          <b>{v.name}</b>
        </div>
        <p class="muted small">
          {v.hint} 1 mesure de décompte, puis {BARS} mesures.
        </p>
        {result ? (
          <>
            <ResultLine r={result.r} tol={tol} total={result.r.matches.length} />
            <p class="small">
              {Math.abs(result.drift) < 2
                ? 'Tempo stable du début à la fin.'
                : result.drift > 0
                  ? `Tu accélères (environ +${result.drift} BPM).`
                  : `Tu ralentis (environ ${result.drift} BPM).`}
            </p>
            <Timeline r={result.r} tol={tol} />
            {result.bleed ? <BleedWarning /> : null}
          </>
        ) : null}
      </section>
      <div class="thumb-zone">
        <TapPad input={saved.input} active={phase === 'take'} count={hits.count} onTap={hits.tap} />
        <button class="btn primary block" disabled={phase === 'take'} onClick={go}>
          {phase === 'take' ? 'En cours…' : phase === 'done' ? 'Recommencer' : 'Commencer'}
        </button>
      </div>
    </div>
  );
}

/** Écart de chaque attaque, du début à la fin : on voit si on accélère ou si on ralentit. */
function Timeline({ r, tol }: { r: TimingResult; tol: number }) {
  const max = Math.max(tol * 2, ...r.matches.map((m) => Math.abs(m.dev ?? 0)));
  return (
    <div class="tl-wrap">
      <small>↑ en retard</small>
      <div class="timeline" aria-label="Écart de chaque attaque">
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
      <small>↓ en avance</small>
    </div>
  );
}

// ---------------------------------------------------------------- Quel rythme ?

function EarRhythm({ saved, set, onBack }: { saved: Saved; set: (p: Partial<Saved>) => void; onBack: () => void }) {
  const level = saved.level;
  const tempo = saved.tempo[level] ?? LEVEL_TEMPO[level];
  const makeQ = () => {
    const pool = rhythmsOf(level);
    const answer = pick(pool);
    const same = shuffle(pool.filter((x) => x.id !== answer.id && x.bars === answer.bars));
    const others = shuffle(RHYTHMS.filter((x) => x.level !== level && x.bars === answer.bars && !!x.triplet === !!answer.triplet));
    return {
      answer,
      choices: shuffle([answer, ...[...same, ...others].slice(0, 3)])
    };
  };
  const [q, setQ] = useState(makeQ);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ c: 0, t: 0 });
  useEffect(() => {
    playRhythm(q.answer, tempo, { reps: 2, demo: true, feel: 'swing' });
  }, [q]);
  useEffect(() => () => stopPlayback(), []);
  const choose = (id: string) => {
    if (picked) return;
    setPicked(id);
    const ok = id === q.answer.id;
    setScore((s) => ({ c: s.c + (ok ? 1 : 0), t: s.t + 1 }));
    const it = saved.patterns['ear:' + q.answer.id] ?? { c: 0, t: 0 };
    set({
      patterns: {
        ...saved.patterns,
        ['ear:' + q.answer.id]: { c: it.c + (ok ? 1 : 0), t: it.t + 1 }
      }
    });
  };
  const next = () => {
    setPicked(null);
    setQ(makeQ());
  };
  // « J'ai deviné » : la réponse juste compte comme une erreur, pour revenir.
  const guess = () => {
    setScore((s) => ({ ...s, c: s.c - 1 }));
    const it = saved.patterns['ear:' + q.answer.id];
    if (it)
      set({
        patterns: {
          ...saved.patterns,
          ['ear:' + q.answer.id]: { c: Math.max(0, it.c - 1), t: it.t }
        }
      });
    next();
  };
  const ok = picked === q.answer.id;
  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onBack}>
          Arrêter
        </button>
        <span class="play-meta">
          {levelShort(level)} · {score.c}/{score.t}
        </span>
        <button class="icon-btn" aria-label="Réécouter" onClick={() => playRhythm(q.answer, tempo, { reps: 2, demo: true, feel: 'swing' })}>
          <PlayIcon />
        </button>
      </header>
      <h2 class="prompt">Quel rythme as-tu entendu ?</h2>
      {picked ? (
        <div class="fb">
          <p class={'verdict ' + (ok ? 'ok' : 'bad')}>
            {ok ? 'Juste : ' : 'Non, c’était : '}
            {q.answer.name}.
          </p>
          <p class="muted">
            {countOf(q.answer)}. {q.answer.hint}
          </p>
        </div>
      ) : null}
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
          <AnswerActions ok={ok} onNext={next} onGuess={guess} />
        ) : (
          <p class="muted small">Chaque case est une croche (ou un triolet) ; les cases pleines sont les attaques.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Quel style ?

function EarStyle({ saved, set, onBack }: { saved: Saved; set: (p: Partial<Saved>) => void; onBack: () => void }) {
  const makeQ = () => {
    const answer = weightedPick(STYLE_ORDER, (id) => 1 + 3 * (1 - ((saved.styles[id]?.c ?? 0) + 1) / ((saved.styles[id]?.t ?? 0) + 2)));
    return {
      answer,
      choices: shuffle([answer, ...shuffle(STYLE_ORDER.filter((x) => x !== answer)).slice(0, 3)])
    };
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
    const ok = id === q.answer;
    setScore((s) => ({ c: s.c + (ok ? 1 : 0), t: s.t + 1 }));
    const it = saved.styles[q.answer] ?? { c: 0, t: 0 };
    set({
      styles: {
        ...saved.styles,
        [q.answer]: { c: it.c + (ok ? 1 : 0), t: it.t + 1 }
      }
    });
  };
  const next = () => {
    setPicked(null);
    setQ(makeQ());
  };
  const guess = () => {
    setScore((s) => ({ ...s, c: s.c - 1 }));
    const it = saved.styles[q.answer];
    if (it)
      set({
        styles: {
          ...saved.styles,
          [q.answer]: { c: Math.max(0, it.c - 1), t: it.t }
        }
      });
    next();
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
          {score.c}/{score.t}
        </span>
        <button class="icon-btn" aria-label="Réécouter" onClick={() => listen(q.answer)}>
          <PlayIcon />
        </button>
      </header>
      <h2 class="prompt">Quel style ?</h2>
      {picked ? null : <p class="muted small">{playing === q.answer ? 'Écoute la batterie, la basse et le placement du piano…' : 'Touche ▶ pour réécouter.'}</p>}
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
          <p class="small muted">Compare :</p>
          <div class="chips text">
            {q.choices.map((id) => (
              <button key={id} class="chip" aria-pressed={playing === id} onClick={() => listen(id)}>
                {GROOVES[id].name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
        {picked ? <AnswerActions ok={ok} onNext={next} onGuess={guess} /> : null}
      </div>
    </div>
  );
}
