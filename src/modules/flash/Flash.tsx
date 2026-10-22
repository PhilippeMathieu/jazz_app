// Voicings (« flash ») : un accord s'affiche, tu le joues, l'appli écoute (ou révèle) puis passe au suivant.
import { useEffect, useRef, useState } from 'preact/hooks';
import { chordSymbol, degreeLabel, rootPc, spellInChord } from '../../core/theory/chords';
import { Note, mod, noteName, pcOf, spellWith } from '../../core/theory/notes';
import { audio, bass, now, playChord, silence } from '../../core/audio/engine';
import { TWO_HANDS, UPPER_STRUCTURES, VoicingType, bassRoot, lhVoicing, twoHands } from '../../core/audio/voicing';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { checkChord, LIMITS } from '../../core/listen/detect';
import { readChord, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { Keyboard } from '../../ui/Keyboard';
import { CloseIcon } from '../../ui/icons';
import { useWakeLock } from '../../ui/wakeLock';
import { fitSymbol } from '../../ui/fit';
import { notesMarks } from '../../ui/keyboardMarks';
import { ChordStats, FlashSettings, Item, ORDER_LABEL, Order, nextBatch, statKey } from './batch';

const VOICING_NAME: Record<VoicingType, string> = {
  triad: 'Débutant, 3 sons',
  shell: 'Shell',
  A: 'Type A',
  B: 'Type B',
  spread: 'Deux mains',
  quartal: 'Quartes',
  drop2: 'Drop 2',
  us: 'Upper structures'
};
const TYPES: VoicingType[] = ['triad', 'shell', 'A', 'B', 'spread', 'quartal', 'drop2', 'us'];
/** Le voicing d'un accord ; lh : nombre de notes à la main gauche (tout, pour les voicings d'une main). */
function shapeOf(it: Item, prev: number[] | null): { notes: number[]; lh: number } {
  if (TWO_HANDS.includes(it.type)) return twoHands(it.chord, it.type, prev, it.us);
  const notes = lhVoicing(it.chord, it.type, prev);
  return { notes, lh: notes.length };
}
/** La triade d'une upper structure, orthographiée comme une triade (C E G, pas C F♭ G). */
function usTriad(it: Item): Note[] {
  const u = UPPER_STRUCTURES[it.us!];
  const r = spellWith(it.chord.root.letter + u.letters, rootPc(it.chord) + u.semis);
  return [r, spellWith(r.letter + 2, pcOf(r) + 4), spellWith(r.letter + 4, pcOf(r) + 7)];
}
const usNames = (it: Item, ms: number[]) => {
  const t = usTriad(it);
  return ms.map((m) => noteName(t.find((n) => pcOf(n) === mod(m, 12)) ?? t[0])).join(' ');
};
const typeLine = (it: Item) =>
  it.us
    ? `Upper structure ${UPPER_STRUCTURES[it.us].name}`
    : it.type === 'triad'
      ? '3 sons'
      : it.type === 'shell'
        ? 'Shell'
        : it.type === 'A' || it.type === 'B'
          ? `Sans fondamentale, type ${it.type}`
          : VOICING_NAME[it.type];
const DEFAULT: FlashSettings = { exercise: 'flash', level: 1, type: 'shell', order: 'iiVI', delay: 4, sound: true };

interface Heard {
  kind: 'ok' | 'ko' | 'silence';
  ms: number;
  missing: number[];
  extra: number[];
  lowest: number | null;
}

/** Voicings, au réglage fixé par le parcours : temps libre (le micro valide, ou « Révéler »), voicing entendu après. */
export function FlashRun({ type, order, level = 1, onExit }: { type: VoicingType; order: Order; level?: number; onExit: () => void }) {
  useMicRelease();
  const [s] = useState<FlashSettings>({ ...DEFAULT, type, order, level, delay: 0, sound: true });
  return <Run s={s} onEnd={onExit} />;
}

function Run({ s, onEnd }: { s: FlashSettings; onEnd: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voicing, setVoicing] = useState<number[]>([]);
  const [lhCount, setLhCount] = useState(0);
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
    const sh = shapeOf(it, prev.current);
    const v = sh.notes;
    setIdx(k);
    setRevealed(false);
    setVoicing(v);
    setLhCount(sh.lh);
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
      // Au micro seulement : sans écoute, rien ne dit si l'accord était juste.
      report({ type: 'answer', exo: 'flash', level: Math.max(0, TYPES.indexOf(s.type)), ok: success, ms });
    } else setScore((x) => ({ ...x, total: x.total + 1 }));
    if (s.sound) {
      audio();
      silence();
      const t = now() + 0.03;
      if (it.type !== 'shell' && it.type !== 'spread') bass(bassRoot(it.chord, 36), t, 1.8, 0.8);
      playChord(v, t, 1.8, 0.6);
    }
    if (s.delay > 0 || success) timer.current = window.setTimeout(() => show(L, k + 1), success ? 2200 : Math.max(2500, s.delay * 600));
  };

  // Écoute : l'accord est validé dès que 2 des 3 dernières mesures correspondent.
  useMicLoop(listening && !revealed && !paused, () => {
    const c = cur.current;
    if (!c || performance.now() - shownAt.current < 400) return;
    const r = readChord()?.analysis;
    if (!r) {
      setLive((l) => (l.length ? [] : l));
      return;
    }
    const target = [...new Set(c.v.map((m) => mod(m, 12)))];
    // À deux mains, la quinte n'est pas exigée : le micro la confond avec l'harmonique 3 de la basse.
    const it = c.L[c.k];
    const ck = checkChord(r.chroma, target, TWO_HANDS.includes(it.type) ? [mod(rootPc(it.chord) + 7, 12)] : [], r.soft);
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
  const sym = item.label ?? chordSymbol(c);
  const km = notesMarks(c, voicing);
  const two = lhCount < voicing.length;
  const names = (ms: number[]) => ms.map((m) => spellInChord(c, m)).join(' ');
  const degs = (ms: number[]) => ms.map((m) => degreeLabel(c, m)).join(' ');
  // Clavier : de l'ut sous la note la plus grave à l'ut au-dessus de la plus aiguë.
  const kbLo = voicing.length ? 12 * Math.floor(Math.min(...voicing) / 12) : 48;
  const kbHi = voicing.length ? Math.max(kbLo + 24, 12 * Math.ceil((Math.max(...voicing) + 1) / 12)) : 72;
  const nextSym = upcoming ? upcoming.label ?? chordSymbol(upcoming.chord) : '';
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
          <span class="stand-bar">{typeLine(item)}</span>
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
              {two ? (
                <>
                  <span class="hand">
                    <small>MG</small> {names(voicing.slice(0, lhCount))} <span class="muted">= {degs(voicing.slice(0, lhCount))}</span>
                  </span>
                  <span class="hand">
                    <small>MD</small> {item.us ? usNames(item, voicing.slice(lhCount)) : names(voicing.slice(lhCount))} <span class="muted">= {degs(voicing.slice(lhCount))}</span>
                  </span>
                  {item.us ? (
                    <span class="stand-bass">
                      triade de {noteName(usTriad(item)[0])} : {UPPER_STRUCTURES[item.us].tensions}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {names(voicing)} <span class="muted">= {degs(voicing)}</span>
                </>
              )}
              {item.type === 'A' || item.type === 'B' || item.type === 'quartal' || item.type === 'drop2' || item.type === 'us' ? (
                <span class="stand-bass">basse (contrebasse{two ? '' : ' ou main gauche'}) : {spellInChord(c, rootPc(c))}</span>
              ) : null}
            </span>
          ) : (
            <span class="stand-info muted">{paused ? 'En pause' : 'Joue-le…'}</span>
          )}
        </div>
        <div class="stand-kb">
          <Keyboard lo={kbLo} hi={kbHi} marks={revealed ? km.marks : {}} labels={revealed ? km.labels : {}} fit big={kbHi - kbLo <= 24} />
        </div>
        {upcoming ? (
          <div class="stand-next">
            <span class="stand-bar">Ensuite</span>
            <span class="stand-sym2" style={`font-size:min(${fitSymbol(nextSym, 16, 70)}cqw, 10vh)`}>
              {nextSym}
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
