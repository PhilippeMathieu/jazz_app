// Comping : les voicings en rythme sur ii–V–I, avec contrebasse et batterie. Le micro mesure le placement de chaque
// attaque et vérifie l'accord joué.
import { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio, bass, drum, now, playChord } from '../../core/audio/engine';
import { keyLabel } from '../../core/chart/model';
import { keyFor } from '../../core/theory/progressions';
import { chordSymbol, rootPc, spellInChord } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { load, save } from '../../core/storage';
import { report } from '../../core/game';
import { listenOnsets, micSettings, readChord, useMicLoop, useMicState } from '../../core/listen/mic';
import { Ev, backingBar, schedule } from '../../core/rhythm/play';
import { countInHits, tendency, tolerance } from '../../core/rhythm/timing';
import { TPB } from '../../core/rhythm/patterns';
import { Keyboard } from '../../ui/Keyboard';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Field, LevelPicker, MoreOptions, StartButton, levelShort } from '../../ui/Setup';
import { MicPill } from '../../ui/MicPill';
import { PlayIcon } from '../../ui/icons';
import { notesMarks } from '../../ui/keyboardMarks';
import { useWakeLock } from '../../ui/wakeLock';
import { COMP_LEVELS, COMP_VOICING_LABEL, CompResult, CompRound, CompVoicing, Snapshot, evaluate, makeRound, tickBeat } from './comping';

interface Saved {
  level: number;
  voicing: CompVoicing;
  tempo: number;
  /** Contrebasse et batterie, ou charleston seul sur 2 et 4. */
  backing: 'band' | 'click';
  keys: 'cycle' | 'C';
  show: boolean;
}
const DEFAULT: Saved = { level: 0, voicing: 'AB', tempo: 100, backing: 'band', keys: 'cycle', show: true };
const TEMPOS = [80, 100, 120, 140, 160];
const CYCLE = Array.from({ length: 12 }, (_, i) => (i * 5) % 12);
const BAR = 4 * TPB;

/** Écran du comping : réglages, puis le jeu. header : le choix de l'exercice (Voicings / Comping). */
export function Comping({ header }: { header: ComponentChildren }) {
  const [s, setS] = useState<Saved>(() => load('comping', DEFAULT));
  const [running, setRunning] = useState(false);
  useEffect(() => save('comping', s), [s]);
  if (running) return <Run s={s} onEnd={() => setRunning(false)} />;
  return (
    <div class="screen">
      <TopBar title="Voicings" actions={<MicPill echo />} />
      <p class="intro">Joue les voicings en rythme sur ii–V–I, avec contrebasse et batterie. Le micro mesure le placement de chaque attaque et vérifie l’accord.</p>
      {header}
      <LevelPicker exo="comping" levels={COMP_LEVELS.map((l) => ({ name: l.name, desc: l.desc }))} value={s.level} onChange={(level) => setS({ ...s, level })} />
      <Field label="Voicings">
        <Segmented
          cards
          cols={3}
          label="Voicings"
          value={s.voicing}
          onChange={(voicing) => setS({ ...s, voicing })}
          options={(Object.keys(COMP_VOICING_LABEL) as CompVoicing[]).map((v) => ({ value: v, label: COMP_VOICING_LABEL[v].name, sub: COMP_VOICING_LABEL[v].sub }))}
        />
      </Field>
      <MoreOptions summary={`${s.tempo} à la noire · ${s.backing === 'band' ? 'basse et batterie' : 'charleston seul'} · ${s.keys === 'cycle' ? '12 tonalités' : 'C'}`}>
        <Field label="Tempo">
          <Segmented label="Tempo" value={s.tempo} onChange={(tempo) => setS({ ...s, tempo })} options={TEMPOS.map((t) => ({ value: t, label: String(t) }))} />
        </Field>
        <Field label="Accompagnement">
          <Segmented
            label="Accompagnement"
            value={s.backing}
            onChange={(backing) => setS({ ...s, backing })}
            options={[
              { value: 'band', label: 'Basse et batterie', sub: 'Au casque : sinon le micro les entend' },
              { value: 'click', label: 'Charleston seul', sub: 'Sur 2 et 4, plus discret' }
            ]}
          />
        </Field>
        <Field label="Tonalités">
          <Segmented
            label="Tonalités"
            value={s.keys}
            onChange={(keys) => setS({ ...s, keys })}
            options={[
              { value: 'cycle', label: 'Les 12, par quartes' },
              { value: 'C', label: 'C seulement' }
            ]}
          />
        </Field>
        <label class="toggle">
          <input type="checkbox" checked={s.show} onChange={() => setS({ ...s, show: !s.show })} />
          <span>Montrer les voicings (notes et clavier)</span>
        </label>
      </MoreOptions>
      <StartButton onClick={() => (audio(), setRunning(true))} />
      <p class="muted small">
        8 mesures : ii–V–I–I deux fois, une mesure de décompte avant. « Exemple » fait entendre le comping attendu. Le placement utilise le réglage du décalage fait dans Rythme.
      </p>
    </div>
  );
}

type Phase = 'ready' | 'count' | 'play' | 'result';

function Run({ s, onEnd }: { s: Saved; onEnd: () => void }) {
  const [k, setK] = useState(0);
  const tonicOf = (i: number) => (s.keys === 'C' ? 0 : CYCLE[i % 12]);
  const [round, setRound] = useState<CompRound>(() => makeRound(s.level, s.voicing, tonicOf(0)));
  const [phase, setPhase] = useState<Phase>('ready');
  const [pos, setPos] = useState(-1);
  const [result, setResult] = useState<CompResult | null>(null);
  const [echo, setEcho] = useState(false);
  const [demo, setDemo] = useState(false);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const mic = useMicState();
  const listening = mic === 'on';
  const stopRef = useRef<(() => void) | null>(null);
  const timers = useRef<number[]>([]);
  const onsets = useRef<number[]>([]);
  const snaps = useRef<Snapshot[]>([]);
  const unlisten = useRef<(() => void) | null>(null);
  const gate = useRef(micSettings().gate);
  useWakeLock(true);
  const key = keyFor('iiVI', tonicOf(k));
  const spb = 60 / s.tempo;
  const tol = tolerance(s.tempo);
  const offset = load<{ offsets: Record<string, number> }>('rythme', { offsets: {} }).offsets.mic ?? 0;

  const stopAll = () => {
    stopRef.current?.();
    stopRef.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    unlisten.current?.();
    unlisten.current = null;
  };
  useEffect(() => () => stopAll(), []);

  /** Décompte, puis les 8 mesures. demo : le piano joue le comping attendu (rien n'est mesuré). */
  const go = (demo: boolean) => {
    stopAll();
    audio();
    setDemo(demo);
    setResult(null);
    setEcho(false);
    const t0 = now() + 0.25;
    const start = t0 + 4 * spb;
    const evs: Ev[] = [];
    for (let b = 0; b < 4; b++) evs.push({ t: t0 + b * spb, run: (x) => drum('pedal', x, b === 0 ? 0.4 : 0.3) });
    for (let bar = 0; bar < round.bars; bar++) {
      const tb = start + bar * 4 * spb;
      if (s.backing === 'band') {
        backingBar(evs, tb, spb, 'swing', s.tempo);
        const r = rootPc(round.chords[bar]);
        const root = 36 + mod(r - 36, 12) - (mod(r - 36, 12) > 7 ? 12 : 0);
        evs.push({ t: tb, run: (x) => bass(root, x, 1.8 * spb, 0.8) });
        evs.push({ t: tb + 2 * spb, run: (x) => bass(root + 7, x, 1.8 * spb, 0.7) });
      } else for (const b of [1, 3]) evs.push({ t: tb + b * spb, run: (x) => drum('pedal', x, 0.3) });
    }
    const targets = round.hits.map((h) => start + tickBeat(h.tick, s.tempo) * spb);
    if (demo)
      round.hits.forEach((h, i) => {
        const next = i + 1 < targets.length ? targets[i + 1] : targets[i] + 2 * spb;
        evs.push({ t: targets[i], run: (x) => playChord(round.voicings[h.chord], x, Math.min(1.6 * spb, next - targets[i] - 0.05), 0.5) });
      });
    stopRef.current = schedule(evs);
    const end = start + round.bars * 4 * spb;
    // Curseur : une croche à la fois.
    const eighth = spb / 2;
    for (let e = 0; e < round.bars * 8; e++) timers.current.push(window.setTimeout(() => setPos(e), (start + e * eighth - now()) * 1000));
    timers.current.push(window.setTimeout(() => setPhase('play'), (start - now()) * 1000));
    setPhase('count');
    setPos(-1);
    if (!demo && listening) {
      onsets.current = [];
      snaps.current = [];
      gate.current = micSettings().gate;
      unlisten.current = listenOnsets((t) => onsets.current.push(t));
    }
    timers.current.push(
      window.setTimeout(() => {
        setPos(-1);
        unlisten.current?.();
        unlisten.current = null;
        if (demo || !listening) {
          setPhase('ready');
          return;
        }
        const res = evaluate(round, targets, onsets.current, snaps.current, tol, offset, s.backing === 'band');
        setEcho(countInHits(onsets.current, start, spb) >= 2);
        setResult(res);
        setPhase('result');
        setScore((x) => ({ ok: x.ok + res.bothOk, total: x.total + res.hits.length }));
        const ms = ((end - start) * 1000) / res.hits.length;
        res.hits.forEach((h) => report({ type: 'answer', exo: 'comping', level: s.level, ok: h.dev !== null && Math.abs(h.dev) <= tol && !!h.chordOk, ms }));
      }, (end - now() + 0.7) * 1000)
    );
  };

  // Chromas relevés pendant le jeu (l'accord de chaque attaque est jugé après coup).
  useMicLoop(
    listening && (phase === 'count' || phase === 'play'),
    () => {
      const r = readChord(gate.current);
      if (r?.analysis) snaps.current.push({ t: now(), chroma: r.analysis.chroma, soft: r.analysis.soft });
    },
    60
  );

  const nextKey = () => {
    const nk = k + 1;
    setK(nk);
    setRound(makeRound(s.level, s.voicing, tonicOf(nk)));
    setResult(null);
    setPhase('ready');
  };

  const curBar = pos >= 0 ? Math.floor(pos / 8) : phase === 'count' ? 0 : -1;
  // Le voicing à jouer : celui de la dernière attaque passée (une anticipation montre déjà l'accord suivant).
  const lastHit = pos >= 0 ? [...round.hits].reverse().find((h) => h.tick <= pos * 6) : undefined;
  const shownChord = lastHit ? lastHit.chord : curBar >= 0 ? curBar : 0;
  const v = round.voicings[shownChord];
  const km = notesMarks(round.chords[shownChord], v);
  const hitClass = (i: number) => {
    if (!result) return 'on';
    const h = result.hits[i];
    const timeOk = h.dev !== null && Math.abs(h.dev) <= tol;
    if (h.dev === null && h.chordOk === null) return 'on none';
    return 'on ' + (timeOk && h.chordOk ? 'ok' : !timeOk && h.chordOk !== false ? 'late' : 'bad');
  };
  const problems = result
    ? round.hits
        .map((h, i) => ({ h, r: result.hits[i] }))
        .filter(({ r }) => r.chordOk === false)
        .slice(0, 4)
        .map(({ h, r }) => {
          const c = round.chords[h.chord];
          return `Mes. ${h.bar + 1}, ${chordSymbol(c)} : ${r.missing.length ? 'manque ' + r.missing.map((p) => spellInChord(c, p)).join(' ') : ''}${r.missing.length && r.extra.length ? ', ' : ''}${r.extra.length ? 'en trop ' + r.extra.map((p) => spellInChord(c, p)).join(' ') : ''}`;
        })
    : [];

  return (
    <div class="screen play-screen comp-run">
      <header class="topbar">
        <button
          class="btn ghost sm"
          onClick={() => {
            stopAll();
            onEnd();
          }}
        >
          Arrêter
        </button>
        <span class="play-meta">
          Comping · {levelShort(s.level)}
          {score.total ? ` · ${score.ok}/${score.total}` : ''}
        </span>
        <MicPill echo />
      </header>
      <p class="full-ref">
        ii–V–I en <b>{keyLabel(key)}</b>
        {s.keys === 'cycle' ? <span class="muted small"> · {(k % 12) + 1}/12</span> : null}
      </p>
      <div class="comp-grid">
        {round.chords.map((c, bar) => (
          <div key={bar} class={'comp-bar' + (bar === curBar ? ' cur' : '')}>
            <b>{chordSymbol(c)}</b>
            {s.show ? <small>{round.voicings[bar].map((m) => spellInChord(c, m)).join(' ')}</small> : null}
            <span class="comp-cells">
              {Array.from({ length: 8 }, (_, e) => {
                const tick = bar * BAR + e * 6;
                const i = round.hits.findIndex((h) => h.tick === tick);
                return <i key={e} class={(i >= 0 ? hitClass(i) + (round.hits[i].chord !== bar ? ' ant' : '') : '') + (pos === bar * 8 + e ? ' now' : '') + (e % 2 ? '' : ' beat')} />;
              })}
            </span>
          </div>
        ))}
      </div>
      {round.hits.some((h) => h.chord !== h.bar) ? <p class="muted small">Case cerclée : l’accord de la mesure suivante, joué une croche en avance.</p> : null}
      {s.show && phase !== 'result' ? <Keyboard lo={36} hi={84} marks={km.marks} labels={km.labels} center={v} /> : null}
      {phase === 'count' ? (
        <p class="phase-line">{demo ? 'Exemple : écoute le comping attendu.' : 'Décompte : 1, 2, 3, 4…'}</p>
      ) : phase === 'play' ? (
        <p class="phase-line">{demo ? 'Exemple : écoute le comping attendu.' : listening ? 'Joue ! Le micro écoute.' : 'Joue ! (micro coupé : rien n’est mesuré)'}</p>
      ) : null}
      {result ? (
        <div class="fb">
          <p class={'verdict ' + (result.bothOk >= result.hits.length * 0.9 ? 'ok' : 'bad')}>
            {result.bothOk}/{result.hits.length} attaques justes et en place.
          </p>
          <p class="muted">
            Placement : {result.timeOk}/{result.hits.length} à ± {Math.round(tol)} ms, {tendency(result.mean, tol)}. Accords : {result.chordOk}/{result.hits.length} justes.
          </p>
          {problems.map((t) => (
            <p key={t} class="muted small">
              {t}
            </p>
          ))}
          {echo ? <p class="banner warn">Le micro a entendu des attaques pendant le décompte : il capte sans doute l’accompagnement. Mets un écouteur, ou choisis « Charleston seul ».</p> : null}
          <p class="muted small">Vert : juste et en place. Orange : accord juste, placement à revoir. Rouge : accord faux. Gris : rien entendu.</p>
        </div>
      ) : null}
      <div class="thumb-zone">
        {phase === 'ready' || phase === 'result' ? (
          <div class="row-actions">
            <button class="btn" onClick={() => go(true)}>
              <PlayIcon /> Exemple
            </button>
            {phase === 'result' ? (
              <>
                <button class="btn" onClick={() => go(false)}>
                  Encore
                </button>
                <button class="btn primary grow" onClick={nextKey}>
                  {s.keys === 'C' ? 'Nouvelle grille' : 'Tonalité suivante'}
                </button>
              </>
            ) : (
              <button class="btn primary grow" onClick={() => go(false)}>
                Jouer
              </button>
            )}
          </div>
        ) : (
          <div class="row-actions">
            <button
              class="btn grow"
              onClick={() => {
                stopAll();
                setPos(-1);
                setPhase('ready');
              }}
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
