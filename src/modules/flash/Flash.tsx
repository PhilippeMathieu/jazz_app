// Flash voicings : l'appli affiche un accord, tu le joues sur ton piano, puis elle révèle le voicing.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chord, QUALITIES, chordOnPc, chordSymbol, degreeLabel, rootPc, spellInChord } from '../../core/theory/chords';
import { mod, pcOf, spellWith } from '../../core/theory/notes';
import { keyOnPc, keyLabel } from '../../core/chart/model';
import { audio, bass, chord as playChord, now, silence } from '../../core/audio/engine';
import { VOICING_LABEL, VoicingType, bassRoot, lhVoicing } from '../../core/audio/voicing';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';
import { load, save } from '../../core/storage';
import { useWakeLock } from '../../ui/wakeLock';
import { QUALITY_LEVELS } from '../oreille/data';
import { checkChord, LIMITS } from '../../core/listen/detect';
import { micSettings, readChord, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { MicToggle } from '../micro/Micro';

type Order = 'random' | 'cycle' | 'iiVI' | 'iiVim';
const ORDER_LABEL: Record<Order, string> = {
  random: 'Au hasard',
  cycle: 'Cycle de quartes',
  iiVI: 'ii–V–I majeurs',
  iiVim: 'ii–V–i mineurs'
};
const LEVEL_LABEL = ['maj7 · m7 · 7', '+ ø7 · °7', '+ 6 · m6 · sus4 · m(maj7)', '9 · ♭9 · ♯9 · 13'];
const DELAYS = [2, 4, 6, 10, 0];

interface Settings {
  level: number;
  type: VoicingType;
  order: Order;
  delay: number;
  sound: boolean;
}
const DEFAULT: Settings = { level: 1, type: 'shell', order: 'iiVI', delay: 4, sound: true };

interface Item {
  chord: Chord;
  type: VoicingType;
  context?: string;
}

/** Ce que le micro a entendu pour l'accord en cours. */
interface Heard {
  kind: 'ok' | 'ko' | 'silence';
  ms: number;
  missing: number[];
  extra: number[];
  /** Classe de hauteur de la note la plus grave entendue. */
  lowest: number | null;
}

const other = (t: VoicingType): VoicingType => (t === 'A' ? 'B' : t === 'B' ? 'A' : 'shell');
const rnd = (n: number) => Math.floor(Math.random() * n);

/** Fabrique le lot suivant d'accords à jouer. */
function nextBatch(s: Settings, step: number): Item[] {
  const pool = QUALITY_LEVELS[s.level - 1];
  if (s.order === 'iiVI' || s.order === 'iiVim') {
    const minor = s.order === 'iiVim';
    const key = keyOnPc(rnd(12), minor ? 'minor' : 'major');
    const t = key.tonic;
    const tp = pcOf(t);
    const ctx = `${minor ? 'ii–V–i' : 'ii–V–I'} en ${keyLabel(key)}`;
    return [
      { chord: { root: spellWith(t.letter + 1, tp + 2), quality: minor ? 'm7b5' : 'm7' }, type: s.type, context: `${ctx} · II` },
      { chord: { root: spellWith(t.letter + 4, tp + 7), quality: minor ? '7b9' : '7' }, type: other(s.type), context: `${ctx} · V` },
      { chord: { root: t, quality: minor ? 'm6' : 'maj7' }, type: s.type, context: `${ctx} · I` }
    ];
  }
  if (s.order === 'cycle') {
    const q = pool[step % pool.length];
    return Array.from({ length: 12 }, (_, i) => ({
      chord: chordOnPc(mod(i * 5, 12), q),
      type: i % 2 === 0 ? s.type : other(s.type),
      context: `Cycle de quartes · ${QUALITIES[q].name} · ${i + 1}/12`
    }));
  }
  return Array.from({ length: 8 }, () => ({ chord: chordOnPc(rnd(12), pool[rnd(pool.length)]), type: s.type }));
}

export function Flash() {
  const [s, setS] = useState<Settings>(() => load('flash', DEFAULT));
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [count, setCount] = useState(0);
  const step = useRef(0);
  const timer = useRef<number | null>(null);
  const prevVoicing = useRef<number[] | null>(null);
  const [voicing, setVoicing] = useState<number[]>([]);
  const mic = useMicState();
  const listening = mic === 'on';
  const [heard, setHeard] = useState<Heard | null>(null);
  const [live, setLive] = useState<number[]>([]);
  const [score, setScore] = useState({ ok: 0, total: 0, ms: 0 });
  const shownAt = useRef(0);
  const history = useRef<boolean[]>([]);
  const best = useRef<{ missing: number[]; extra: number[]; score: number; lowest: number | null } | null>(null);
  const cur = useRef<{ L: Item[]; k: number; v: number[] } | null>(null);
  const gate = useRef(micSettings().gate);
  useEffect(() => save('flash', s), [s]);
  useWakeLock(running);
  useMicRelease();
  useEffect(() => () => clear(), []);

  // Écoute : l'accord est validé dès que 2 des 3 dernières mesures correspondent.
  useMicLoop(running && listening && !revealed && !paused, () => {
    const c = cur.current;
    if (!c || performance.now() - shownAt.current < 400) return;
    const r = readChord();
    if (!r || r.level < gate.current) {
      setLive([]);
      return;
    }
    const target = [...new Set(c.v.map((m) => mod(m, 12)))];
    const ck = checkChord(r.chroma, target);
    setLive([...Array(12).keys()].filter((p) => r.chroma[p] >= LIMITS.present));
    history.current = [...history.current, ck.ok].slice(-3);
    if (!best.current || ck.score > best.current.score) best.current = { ...ck, lowest: r.lowest !== null ? mod(r.lowest, 12) : null };
    if (history.current.filter(Boolean).length >= 2) {
      best.current = { ...ck, lowest: r.lowest !== null ? mod(r.lowest, 12) : null };
      reveal(c.L, c.k, c.v, true);
    }
  }, 120);

  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  const item = items[idx];
  const upcoming = items[idx + 1];

  const show = (list: Item[], i: number) => {
    clear();
    let L = list;
    let k = i;
    if (k >= L.length) {
      step.current++;
      L = nextBatch(s, step.current);
      k = 0;
      setItems(L);
    }
    setIdx(k);
    setRevealed(false);
    const it = L[k];
    const v = lhVoicing(it.chord, it.type, it.type === 'shell' ? prevVoicing.current : null);
    setVoicing(v);
    cur.current = { L, k, v };
    shownAt.current = performance.now();
    history.current = [];
    best.current = null;
    setHeard(null);
    setLive([]);
    if (s.delay > 0) timer.current = window.setTimeout(() => reveal(L, k, v), s.delay * 1000);
  };

  const reveal = (L: Item[], k: number, v: number[], success = false) => {
    clear();
    setRevealed(true);
    setCount((c) => c + 1);
    prevVoicing.current = v;
    const it = L[k];
    if (listening) {
      const ms = performance.now() - shownAt.current;
      const b = best.current;
      const h: Heard = success
        ? { kind: 'ok', ms, missing: [], extra: [], lowest: b?.lowest ?? null }
        : b
          ? { kind: 'ko', ms, missing: b.missing, extra: b.extra, lowest: b.lowest }
          : { kind: 'silence', ms, missing: [], extra: [], lowest: null };
      setHeard(h);
      setScore((sc) => ({ ok: sc.ok + (success ? 1 : 0), total: sc.total + 1, ms: sc.ms + (success ? ms : 0) }));
    }
    if (s.sound) {
      audio();
      silence();
      const t = now() + 0.03;
      if (it.type !== 'shell') bass(bassRoot(it.chord, 36), t, 1.8, 0.8);
      playChord(v, t, 1.8, 0.6);
    }
    if (s.delay > 0 || (listening && success)) timer.current = window.setTimeout(() => show(L, k + 1), success ? 2200 : Math.max(2500, s.delay * 600));
  };

  const start = () => {
    audio();
    step.current = 0;
    prevVoicing.current = null;
    const L = nextBatch(s, 0);
    setItems(L);
    setCount(0);
    setScore({ ok: 0, total: 0, ms: 0 });
    gate.current = micSettings().gate;
    setRunning(true);
    setPaused(false);
    show(L, 0);
  };

  const tap = () => {
    if (!item) return;
    if (!revealed) reveal(items, idx, voicing);
    else show(items, idx + 1);
  };
  const togglePause = () => {
    if (paused) {
      setPaused(false);
      show(items, revealed ? idx + 1 : idx);
    } else {
      clear();
      setPaused(true);
    }
  };

  // ------------------------------------------------------------ Réglages
  if (!running || !item) {
    return (
      <div class="screen">
        <div class="topbar">
          <button class="back" aria-label="Retour" onClick={() => go('/')}><BackIcon /></button>
          <h1>Flash voicings</h1>
        </div>
        <p class="muted small" style="margin:0">
          Pose le téléphone sur le pupitre. Un accord s'affiche, tu le joues à la main gauche, puis l'appli montre et fait entendre le bon
          voicing, et passe au suivant. Pas besoin de toucher l'écran.
        </p>
        <h2 class="list-title">Voicing</h2>
        <div class="optlist">
          {(Object.keys(VOICING_LABEL) as VoicingType[]).map((t) => (
            <button key={t} class="lv" aria-pressed={s.type === t} onClick={() => setS({ ...s, type: t })}>
              <b>{t === 'shell' ? 'Shell' : `Type ${t}`}</b>
              <span>{VOICING_LABEL[t]}</span>
            </button>
          ))}
        </div>
        <h2 class="list-title">Enchaînement</h2>
        <div class="optlist two">
          {(Object.keys(ORDER_LABEL) as Order[]).map((o) => (
            <button key={o} class="lv" aria-pressed={s.order === o} onClick={() => setS({ ...s, order: o })}>
              <b>{ORDER_LABEL[o]}</b>
            </button>
          ))}
        </div>
        {s.order === 'random' || s.order === 'cycle' ? (
          <>
            <h2 class="list-title">Accords</h2>
            <div class="levels">
              {LEVEL_LABEL.map((t, i) => (
                <button key={i} class="lv" aria-pressed={s.level === i + 1} onClick={() => setS({ ...s, level: i + 1 })}>
                  <b>N{i + 1}</b>
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <h2 class="list-title">Temps pour jouer</h2>
        <div class="seg wide" role="group" aria-label="Temps pour jouer">
          {DELAYS.map((d) => (
            <button key={d} aria-pressed={s.delay === d} onClick={() => setS({ ...s, delay: d })}>
              {d ? `${d} s` : 'Au toucher'}
            </button>
          ))}
        </div>
        <label class="check">
          <input id="flash-sound" type="checkbox" checked={s.sound} onChange={(e) => setS({ ...s, sound: (e.target as HTMLInputElement).checked })} />
          <span>Faire entendre le voicing à la révélation</span>
        </label>
        <p class="muted small" style="margin:0">
          {s.type === 'shell'
            ? 'Shell : la fondamentale à la basse, puis la 3ce et la 7e. La base de tout accompagnement.'
            : 'Sans fondamentale : la basse (ou le bassiste) joue la fondamentale. En ii–V–I et en cycle, A et B alternent pour que les voix bougent peu.'}
        </p>
        <h2 class="list-title">Écoute</h2>
        <p class="muted small" style="margin:0">
          Avec le micro, l'appli vérifie ton accord et passe au suivant dès qu'il est juste. Le temps choisi devient le temps maximum.{' '}
          <a href="#/micro" style="text-decoration:underline">Tester le micro</a>
        </p>
        <MicToggle />
        <button class="next" onClick={start}>Commencer</button>
      </div>
    );
  }

  // ------------------------------------------------------------ Exercice
  const c = item.chord;
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  if (revealed) {
    voicing.forEach((m) => {
      marks[m] = 'hit';
      labels[m] = spellInChord(c, m);
    });

  }
  const sym = chordSymbol(c);
  const size = Math.min(34, 150 / Math.max(3, [...sym].length)).toFixed(1);
  return (
    <div class="stand flash" onClick={(e) => (e.target as HTMLElement).closest('button') ? null : tap()}>
      <div class="stand-top">
        <span class="eyebrow">
          {item.context ?? ORDER_LABEL[s.order]} · {listening ? `${score.ok}/${score.total} justes` : `${count} joués`}
        </span>
        <button class="btn" onClick={() => { clear(); silence(); setRunning(false); }}>Terminer</button>
      </div>
      <div class="stand-main">
        <div class="stand-now">
          <span class="stand-bar">{item.type === 'shell' ? 'Shell' : `Sans fondamentale, type ${item.type}`}</span>
          <span class="stand-sym" style={`font-size:${size}cqw`}>{sym}</span>
          {!revealed && s.delay > 0 && !paused ? (
            <div class="countdown"><span key={`${idx}-${count}-${items.length}`} style={`animation-duration:${s.delay}s`} /></div>
          ) : null}
          {revealed && heard ? <HeardLine heard={heard} chord={c} voicing={voicing} /> : null}
          {!revealed && listening && !paused ? (
            <span class="listen-line">
              <i class="rec" /> {live.length ? live.map((p) => spellInChord(c, p)).join(' ') : 'J’écoute…'}
            </span>
          ) : null}
          {revealed ? (
            <span class="stand-info">
              {voicing.map((m) => spellInChord(c, m)).join(' ')} <span class="muted">= {voicing.map((m) => degreeLabel(c, m)).join(' ')}</span>
              {item.type !== 'shell' ? <span class="muted small"> · basse : {spellInChord(c, rootPc(c))}</span> : null}
            </span>
          ) : (
            <span class="stand-info muted">{paused ? 'En pause' : listening || s.delay ? 'Joue-le…' : 'Joue-le, puis touche l’écran'}</span>
          )}
        </div>
        <div class="stand-kb">
          {revealed ? (
            <Keyboard lo={item.type === 'shell' ? 40 : 48} hi={item.type === 'shell' ? 64 : 72} marks={marks} labels={labels} fit />
          ) : (
            <div class="placeholder">Le voicing apparaît ici.</div>
          )}
        </div>
        {upcoming ? (
          <div class="stand-next">
            <span class="eyebrow">Ensuite</span>
            <span class="stand-info2">{chordSymbol(upcoming.chord)}</span>
          </div>
        ) : null}
      </div>
      <div class="stand-controls">
        <button class="btn" onClick={togglePause}>{paused ? 'Reprendre' : 'Pause'}</button>
        <button class="next" onClick={tap}>{revealed ? 'Suivant' : 'Révéler'}</button>
      </div>
    </div>
  );
}

function HeardLine({ heard, chord: c, voicing }: { heard: Heard; chord: Chord; voicing: number[] }) {
  const sec = (heard.ms / 1000).toFixed(1).replace('.', ',');
  const low = mod(voicing[0], 12);
  if (heard.kind === 'ok') {
    return (
      <span class="verdict ok">
        Juste, en {sec} s.
        {heard.lowest !== null && heard.lowest !== low ? (
          <span class="muted small"> Disposition différente : en bas {spellInChord(c, heard.lowest)} au lieu de {spellInChord(c, low)}.</span>
        ) : null}
      </span>
    );
  }
  if (heard.kind === 'silence') return <span class="verdict bad">Rien entendu. Joue plus fort ou rapproche le téléphone.</span>;
  return (
    <span class="verdict bad">
      Pas encore.
      {heard.missing.length ? ` Manque : ${heard.missing.map((p) => spellInChord(c, p)).join(' ')}.` : ''}
      {heard.extra.length ? ` En trop : ${heard.extra.map((p) => spellInChord(c, p)).join(' ')}.` : ''}
    </span>
  );
}
