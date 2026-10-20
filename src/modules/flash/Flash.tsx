// Voicings (« flash ») : un accord s'affiche, tu le joues, l'appli écoute (ou révèle) puis passe au suivant.
import { useEffect, useRef, useState } from 'preact/hooks';
import { chordSymbol, degreeLabel, rootPc, spellInChord } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { audio, bass, now, playChord, silence } from '../../core/audio/engine';
import { VOICING_LABEL, VoicingType, bassRoot, lhVoicing } from '../../core/audio/voicing';
import { load, save } from '../../core/storage';
import { checkChord, LIMITS } from '../../core/listen/detect';
import { micSettings, readChord, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { Keyboard } from '../../ui/Keyboard';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Field, LevelPicker, MoreOptions, StartButton } from '../../ui/Setup';
import { MicPill } from '../../ui/MicPill';
import { CloseIcon } from '../../ui/icons';
import { useWakeLock } from '../../ui/wakeLock';
import { fitSymbol } from '../../ui/fit';
import { notesMarks } from '../../ui/keyboardMarks';
import { ChordStats, FlashSettings, Item, ORDER_LABEL, Order, nextBatch, statKey } from './batch';
import { LEVEL_LABELS } from '../oreille/data';

const VOICING_NAME: Record<VoicingType, string> = { triad: 'Débutant, 3 sons', shell: 'Shell', A: 'Type A', B: 'Type B' };
const TYPES: VoicingType[] = ['triad', 'shell', 'A', 'B'];
const DEFAULT: FlashSettings = { level: 1, type: 'shell', order: 'iiVI', delay: 4, sound: true };
const DELAYS = [2, 4, 6, 10, 0];

interface Heard {
  kind: 'ok' | 'ko' | 'silence';
  ms: number;
  missing: number[];
  extra: number[];
  lowest: number | null;
}

export function Flash() {
  const [s, setS] = useState<FlashSettings>(() => load('flash', DEFAULT));
  const [running, setRunning] = useState(false);
  useEffect(() => save('flash', s), [s]);
  useMicRelease();
  if (running) return <Run s={s} onEnd={() => setRunning(false)} />;
  return (
    <div class="screen">
      <TopBar title="Voicings" actions={<MicPill />} />
      <p class="intro">Un accord s’affiche : joue-le à la main gauche. Avec le micro, l’appli valide et passe au suivant.</p>
      <LevelPicker
        levels={TYPES.map((t) => ({ name: VOICING_NAME[t], desc: VOICING_LABEL[t] }))}
        value={TYPES.indexOf(s.type)}
        onChange={(i) => setS({ ...s, type: TYPES[i] })}
      />
      <MoreOptions summary={`${ORDER_LABEL[s.order]} · ${s.delay ? `${s.delay} s` : 'temps libre'}${s.sound ? '' : ' · sans son'}`}>
        <Field label="Enchaînement">
          <Segmented
            cards
            cols={2}
            label="Enchaînement"
            value={s.order}
            onChange={(order) => setS({ ...s, order })}
            options={(Object.keys(ORDER_LABEL) as Order[]).map((o) => ({ value: o, label: ORDER_LABEL[o] }))}
          />
        </Field>
        {(s.order === 'random' || s.order === 'cycle') && s.type !== 'triad' ? (
          <Field label="Types d’accords">
            <Segmented
              label="Types d’accords"
              value={Math.max(1, s.level)}
              onChange={(level) => setS({ ...s, level })}
              options={LEVEL_LABELS.build.slice(1).map((t, i) => ({ value: i + 1, label: String(i + 1), sub: t }))}
            />
          </Field>
        ) : null}
        <Field label="Temps pour jouer">
          <Segmented label="Temps pour jouer" value={s.delay} onChange={(delay) => setS({ ...s, delay })} options={DELAYS.map((d) => ({ value: d, label: d ? `${d} s` : 'Libre' }))} />
        </Field>
        <label class="toggle">
          <input type="checkbox" checked={s.sound} onChange={() => setS({ ...s, sound: !s.sound })} />
          <span>Faire entendre le voicing après chaque accord</span>
        </label>
      </MoreOptions>
      <StartButton onClick={() => setRunning(true)} />
      <p class="muted small">
        {s.type === 'triad'
          ? 'Joue-les dans le renversement que tu veux ; l’appli montre le plus proche du précédent.'
          : s.type === 'shell'
            ? 'Fondamentale à la basse, puis 3ce et 7e. Sous la, la 3ce passe au-dessus de la 7e (1-7-10).'
            : 'Sans fondamentale : la basse joue la fondamentale. A et B alternent pour que les voix bougent peu.'}{' '}
        Les accords ratés ou lents reviennent plus souvent.
      </p>
    </div>
  );
}

function Run({ s, onEnd }: { s: FlashSettings; onEnd: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voicing, setVoicing] = useState<number[]>([]);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [live, setLive] = useState<number[]>([]);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const mic = useMicState();
  const listening = mic === 'on';
  const stats = useRef<ChordStats>(load('flash-stats', { chords: {} as ChordStats }).chords);
  const step = useRef(0);
  const timer = useRef<number | null>(null);
  const prev = useRef<number[] | null>(null);
  const shownAt = useRef(0);
  const history = useRef<boolean[]>([]);
  const best = useRef<{ missing: number[]; extra: number[]; score: number; lowest: number | null } | null>(null);
  const cur = useRef<{ L: Item[]; k: number; v: number[] } | null>(null);
  const gate = useRef(micSettings().gate);
  useWakeLock(true);

  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    const L = nextBatch(s, 0, stats.current);
    setItems(L);
    show(L, 0);
    return () => {
      clear();
      silence();
    };
  }, []);

  const show = (list: Item[], i: number) => {
    clear();
    let L = list;
    let k = i;
    if (k >= L.length) {
      step.current++;
      L = nextBatch(s, step.current, stats.current);
      k = 0;
      setItems(L);
    }
    const it = L[k];
    const v = lhVoicing(it.chord, it.type, prev.current);
    setIdx(k);
    setRevealed(false);
    setVoicing(v);
    setHeard(null);
    setLive([]);
    cur.current = { L, k, v };
    shownAt.current = performance.now();
    history.current = [];
    best.current = null;
    if (s.delay > 0) timer.current = window.setTimeout(() => reveal(L, k, v, false), s.delay * 1000);
  };

  const reveal = (L: Item[], k: number, v: number[], success: boolean) => {
    clear();
    setRevealed(true);
    prev.current = v;
    const it = L[k];
    const ms = performance.now() - shownAt.current;
    if (listening) {
      const b = best.current;
      setHeard(
        success
          ? { kind: 'ok', ms, missing: [], extra: [], lowest: b?.lowest ?? null }
          : b
            ? { kind: 'ko', ms, missing: b.missing, extra: b.extra, lowest: b.lowest }
            : { kind: 'silence', ms, missing: [], extra: [], lowest: null }
      );
      setScore((x) => ({ ok: x.ok + (success ? 1 : 0), total: x.total + 1 }));
      // Statistiques par accord (pour faire revenir les points faibles)
      const key = statKey(it);
      const st = stats.current[key] ?? { c: 0, t: 0, ms: 0 };
      stats.current = { ...stats.current, [key]: { c: st.c + (success ? 1 : 0), t: st.t + 1, ms: st.ms + (success ? ms : 0) } };
      save('flash-stats', { chords: stats.current });
    } else setScore((x) => ({ ...x, total: x.total + 1 }));
    if (s.sound) {
      audio();
      silence();
      const t = now() + 0.03;
      if (it.type !== 'shell') bass(bassRoot(it.chord, 36), t, 1.8, 0.8);
      playChord(v, t, 1.8, 0.6);
    }
    if (s.delay > 0 || success) timer.current = window.setTimeout(() => show(L, k + 1), success ? 2200 : Math.max(2500, s.delay * 600));
  };

  // Écoute : l'accord est validé dès que 2 des 3 dernières mesures correspondent.
  useMicLoop(listening && !revealed && !paused, () => {
    const c = cur.current;
    if (!c || performance.now() - shownAt.current < 400) return;
    const r = readChord(gate.current)?.analysis;
    if (!r) {
      setLive((l) => (l.length ? [] : l));
      return;
    }
    const target = [...new Set(c.v.map((m) => mod(m, 12)))];
    const ck = checkChord(r.chroma, target);
    const now12 = [...Array(12).keys()].filter((p) => r.chroma[p] >= LIMITS.present);
    setLive((l) => (l.join() === now12.join() ? l : now12));
    const lowest = r.lowest !== null ? mod(r.lowest, 12) : null;
    history.current = [...history.current, ck.ok].slice(-3);
    if (!best.current || ck.score > best.current.score) best.current = { ...ck, lowest };
    if (history.current.filter(Boolean).length >= 2) {
      best.current = { ...ck, lowest };
      reveal(c.L, c.k, c.v, true);
    }
  }, 120);

  const item = items[idx];
  if (!item) return null;
  const upcoming = items[idx + 1];
  const tap = () => {
    if (paused || !cur.current) return;
    if (!revealed) reveal(cur.current.L, cur.current.k, cur.current.v, false);
    else show(cur.current.L, cur.current.k + 1);
  };
  const togglePause = () => {
    if (!cur.current) return;
    if (paused) {
      setPaused(false);
      show(cur.current.L, revealed ? cur.current.k + 1 : cur.current.k);
    } else {
      clear();
      setPaused(true);
    }
  };

  const c = item.chord;
  const sym = chordSymbol(c);
  const km = notesMarks(c, voicing);
  return (
    <div class="stand flash">
      <div class="stand-top">
        <span class="stand-bar">
          {item.context ?? ORDER_LABEL[s.order]} · {listening ? `${score.ok}/${score.total} justes` : `${score.total} joués`}
        </span>
        <button
          class="icon-btn"
          aria-label="Terminer"
          onClick={() => {
            clear();
            silence();
            onEnd();
          }}
        >
          <CloseIcon />
        </button>
      </div>
      <div class="stand-main">
        <div class="stand-now">
          <span class="stand-bar">{item.type === 'triad' ? '3 sons' : item.type === 'shell' ? 'Shell' : `Sans fondamentale, type ${item.type}`}</span>
          <span class="stand-sym" style={`font-size:min(${fitSymbol(sym, 34, 150)}cqw, 26vh)`}>
            {sym}
          </span>
          {!revealed && s.delay > 0 && !paused ? (
            <div class="countdown">
              <span key={`${idx}-${score.total}-${step.current}`} style={`animation-duration:${s.delay}s`} />
            </div>
          ) : null}
          {revealed && heard ? <HeardLine heard={heard} item={item} voicing={voicing} /> : null}
          {!revealed && listening && !paused ? (
            <span class="listen-line">
              <i class="rec" /> {live.length ? live.map((p) => spellInChord(c, p)).join(' ') : 'J’écoute…'}
            </span>
          ) : null}
          {revealed ? (
            <span class="stand-info">
              {voicing.map((m) => spellInChord(c, m)).join(' ')} <span class="muted">= {voicing.map((m) => degreeLabel(c, m)).join(' ')}</span>
              {item.type === 'A' || item.type === 'B' ? <span class="stand-bass">basse (main gauche ou contrebasse) : {spellInChord(c, rootPc(c))}</span> : null}
            </span>
          ) : (
            <span class="stand-info muted">{paused ? 'En pause' : 'Joue-le…'}</span>
          )}
        </div>
        <div class="stand-kb">
          <Keyboard lo={item.type === 'shell' ? 40 : 48} hi={item.type === 'shell' ? 64 : 72} marks={revealed ? km.marks : {}} labels={revealed ? km.labels : {}} fit big />
        </div>
        {upcoming ? (
          <div class="stand-next">
            <span class="stand-bar">Ensuite</span>
            <span class="stand-sym2" style={`font-size:min(${fitSymbol(chordSymbol(upcoming.chord), 16, 70)}cqw, 10vh)`}>
              {chordSymbol(upcoming.chord)}
            </span>
          </div>
        ) : null}
      </div>
      <div class="stand-controls">
        <button class="btn" onClick={togglePause}>
          {paused ? 'Reprendre' : 'Pause'}
        </button>
        <button class="btn primary grow" onClick={tap} disabled={paused}>
          {revealed ? 'Suivant' : 'Révéler'}
        </button>
      </div>
    </div>
  );
}

function HeardLine({ heard, item, voicing }: { heard: Heard; item: Item; voicing: number[] }) {
  const c = item.chord;
  const sec = (heard.ms / 1000).toFixed(1).replace('.', ',');
  const low = mod(voicing[0], 12);
  if (heard.kind === 'ok')
    return (
      <span class="verdict ok">
        Juste, en {sec} s.
        {heard.lowest !== null && heard.lowest !== low ? (
          <span class="muted"> Disposition différente : en bas {spellInChord(c, heard.lowest)} au lieu de {spellInChord(c, low)}.</span>
        ) : null}
      </span>
    );
  if (heard.kind === 'silence') return <span class="verdict bad">Rien entendu. Joue plus fort ou rapproche le téléphone.</span>;
  return (
    <span class="verdict bad">
      Pas encore.
      {heard.missing.length ? ` Manque : ${heard.missing.map((p) => spellInChord(c, p)).join(' ')}.` : ''}
      {heard.extra.length ? ` En trop : ${heard.extra.map((p) => spellInChord(c, p)).join(' ')}.` : ''}
    </span>
  );
}
