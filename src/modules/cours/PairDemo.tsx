// Comparer les natures d'accord sur la même fondamentale : deux côte à côte (la note qui change), ou toute la chaîne.
import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { QUALITIES, chordOnPc, chordSymbol, degreeLabel } from '../../core/theory/chords';
import { pcOf } from '../../core/theory/notes';
import { audio, now, playChord, silence } from '../../core/audio/engine';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { PlayIcon } from '../../ui/icons';
import { changeText, changes, chordOf, pairCue } from '../oreille/pairs';

/** Fondamentales proposées (« Autre fondamentale ») : sans double altération sur les 5 natures. */
const ROOTS = [0, 7, 5, 2, 10, 9, 3, 4];

export function PairDemo({ a, b }: { a: string; b: string }) {
  const [ri, setRi] = useState(0);
  const [side, setSide] = useState<'a' | 'b'>('a');
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);
  const root = chordOnPc(ROOTS[ri], 'maj7').root;
  const base = 60 + pcOf(root);
  const notes = (q: string) => QUALITIES[q].iv.map((i) => base + i);
  const ca = chordOf(root, a);
  const cb = chordOf(root, b);
  const ch = changes(root, a, b);

  const sound = (q: string, t: number) => playChord([base - 12, ...notes(q)], t, 1.5, 0.6);
  const play = (s: 'a' | 'b') => {
    clear();
    audio();
    silence();
    setSide(s);
    sound(s === 'a' ? a : b, now() + 0.05);
  };
  const both = () => {
    clear();
    audio();
    silence();
    const t0 = now() + 0.05;
    setSide('a');
    sound(a, t0);
    sound(b, t0 + 1.7);
    timers.current.push(window.setTimeout(() => setSide('b'), 1750));
  };

  // Clavier : les notes communes en gris, la note qui change en jaune ; celle de l'autre accord en pointillés.
  const cur = side === 'a' ? ca : cb;
  const other = side === 'a' ? cb : ca;
  const mine = notes(cur.quality);
  const theirs = notes(other.quality);
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  for (const m of mine) {
    marks[m] = theirs.includes(m) ? 'soft' : 'hit';
    labels[m] = degreeLabel(cur, m % 12);
  }
  for (const m of theirs) if (!mine.includes(m)) marks[m] = 'miss';

  return (
    <div class="ls-demo pair-demo">
      <div class="pair-head">
        <b>
          {chordSymbol(ca)} ou {chordSymbol(cb)} ?
        </b>
        <button class="btn sm ghost" onClick={() => (clear(), setRi((i) => (i + 1) % ROOTS.length), setSide('a'))}>
          Autre fondamentale
        </button>
      </div>
      <p class="small">
        Ce qui change : {ch.map(changeText).join(' ; ')}.
      </p>
      <div class="row-actions pair-btns">
        <button class={'btn sm' + (side === 'a' ? ' on' : '')} onClick={() => play('a')}>
          <PlayIcon /> {chordSymbol(ca)}
        </button>
        <button class={'btn sm' + (side === 'b' ? ' on' : '')} onClick={() => play('b')}>
          <PlayIcon /> {chordSymbol(cb)}
        </button>
        <button class="btn sm" onClick={both}>
          <PlayIcon /> L’un puis l’autre
        </button>
      </div>
      <Keyboard lo={60} hi={83} fit marks={marks} labels={labels} />
      <p class="muted small">
        {chordSymbol(cur)} : en jaune {ch.length > 1 ? 'les notes qui changent' : 'la note qui change'}, en pointillés {ch.length > 1 ? 'celles' : 'celle'} de {chordSymbol(other)}.
      </p>
      <p class="small pair-cue">{pairCue(a, b)}</p>
    </div>
  );
}

/** La chaîne maj7 → 7 → m7 → ø7 → °7 : les 5 sur la même fondamentale, chacun avec la note qui a baissé. */
export function ChainDemo({ chain }: { chain: string[] }) {
  const [ri, setRi] = useState(0);
  const [at, setAt] = useState(0);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);
  const root = chordOnPc(ROOTS[ri], 'maj7').root;
  const base = 60 + pcOf(root);
  const notes = (q: string) => QUALITIES[q].iv.map((i) => base + i);
  const sound = (q: string, t: number, len = 1.3) => playChord([base - 12, ...notes(q)], t, len, 0.6);
  const one = (i: number) => {
    clear();
    audio();
    silence();
    setAt(i);
    sound(chain[i], now() + 0.05, 1.6);
  };
  const all = () => {
    clear();
    audio();
    silence();
    const t0 = now() + 0.05;
    chain.forEach((q, i) => {
      sound(q, t0 + i * 1.4);
      timers.current.push(window.setTimeout(() => setAt(i), 50 + i * 1400));
    });
  };

  const cur = chordOf(root, chain[at]);
  const mine = notes(chain[at]);
  const prev = at > 0 ? notes(chain[at - 1]) : mine;
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  for (const m of mine) {
    marks[m] = prev.includes(m) ? 'soft' : 'hit';
    labels[m] = degreeLabel(cur, m % 12);
  }
  for (const m of prev) if (!mine.includes(m)) marks[m] = 'miss';
  const step = at > 0 ? changes(root, chain[at - 1], chain[at]) : [];

  return (
    <div class="ls-demo chain-demo">
      <div class="pair-head">
        <b>Les {chain.length} ensemble</b>
        <button class="btn sm ghost" onClick={() => (clear(), setRi((i) => (i + 1) % ROOTS.length), setAt(0))}>
          Autre fondamentale
        </button>
      </div>
      <div class="chain">
        {chain.map((q, i) => {
          const c = i > 0 ? changes(root, chain[i - 1], q) : [];
          return (
            <Fragment key={q}>
              {i > 0 ? (
                <span class="chain-step">
                  {c.map((x) => x.role).join(' + ')} ↓
                </span>
              ) : null}
              <button class={'btn sm' + (at === i ? ' on' : '')} onClick={() => one(i)}>
                {chordSymbol(chordOf(root, q))}
              </button>
            </Fragment>
          );
        })}
      </div>
      <button class="btn sm" onClick={all}>
        <PlayIcon /> Les {chain.length} à la suite
      </button>
      <Keyboard lo={60} hi={83} fit marks={marks} labels={labels} />
      <p class="muted small">
        {chordSymbol(cur)}
        {step.length ? ` : par rapport à ${chordSymbol(chordOf(root, chain[at - 1]))}, ${step.map(changeText).join(' ; ')}. En jaune la note qui a baissé, en pointillés où elle était.` : ' : le point de départ. Touche le suivant pour baisser une note.'}
      </p>
    </div>
  );
}
