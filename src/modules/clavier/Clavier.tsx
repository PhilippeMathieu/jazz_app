// Clavier complet : nommer ce qu'on joue (au toucher ou au piano, au micro), ou voir n'importe quel accord.
import { useRef, useState } from 'preact/hooks';
import { Chord, QUALITIES, chordOnPc, chordSymbol, degreeLabel, rootPc, spellInChord } from '../../core/theory/chords';
import { mod, plainName } from '../../core/theory/notes';
import { identify, intervalName } from '../../core/theory/identify';
import { VoicingType, lhVoicing } from '../../core/audio/voicing';
import { audio, now, piano, playChord } from '../../core/audio/engine';
import { ListenButtons, useListen, withActive } from '../../ui/Listen';
import { LIMITS } from '../../core/listen/detect';
import { micSettings, readChord, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { load, save } from '../../core/storage';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { MicPill } from '../../ui/MicPill';

type Tab = 'nommer' | 'voir';
const LO = 36; // C2
const HI = 96; // C7
const KEY_W = 34;

export function Clavier() {
  const [tab, setTab] = useState<Tab>(() => load('clavier', { tab: 'nommer' as Tab }).tab);
  const choose = (t: Tab) => {
    setTab(t);
    save('clavier', { tab: t });
  };
  useMicRelease();
  return (
    <div class="screen">
      <TopBar title="Clavier" actions={tab === 'nommer' ? <MicPill /> : undefined} />
      <Segmented
        label="Mode"
        value={tab}
        onChange={choose}
        options={[
          { value: 'nommer', label: 'Nommer ce que je joue' },
          { value: 'voir', label: 'Voir un accord' }
        ]}
      />
      {tab === 'nommer' ? <NameIt /> : <ShowChord />}
    </div>
  );
}

function playNotes(notes: number[]) {
  audio();
  playChord(notes, now() + 0.03, 1.6, 0.55);
}

// ---------------------------------------------------------------- Nommer

function NameIt() {
  const l = useListen();
  const [sel, setSel] = useState<number[]>([]);
  const [heard, setHeard] = useState<number[]>([]);
  const mic = useMicState();
  const listening = mic === 'on';

  // Au piano : les notes entendues remplacent la sélection, empilées au-dessus de la plus grave.
  // On garde le maximum des ~0,6 dernières secondes : une note plus faible du voicing n'est pas perdue.
  const recent = useRef<{ chroma: Float32Array; lowest: number }[]>([]);
  useMicLoop(
    listening,
    () => {
      const r = readChord(micSettings().gate)?.analysis;
      if (!r || r.lowest === null) {
        recent.current = [];
        setHeard((h) => (h.length ? [] : h));
        return;
      }
      recent.current = [...recent.current, { chroma: r.chroma, lowest: r.lowest }].slice(-4);
      const low = Math.min(...recent.current.map((x) => x.lowest));
      const pcs = [...Array(12).keys()].filter((p) => Math.max(...recent.current.map((x) => x.chroma[p])) >= LIMITS.present);
      const notes = [...new Set([low, ...pcs.map((p) => low + mod(p - low, 12))])].sort((a, b) => a - b);
      setHeard((h) => (h.join() === notes.join() ? h : notes));
    },
    150
  );

  const notes = listening && heard.length ? heard : sel;
  const readings = identify(notes);
  const best = readings[0];
  const tap = (m: number) => {
    audio();
    if (sel.includes(m)) setSel(sel.filter((x) => x !== m));
    else {
      piano(m, now() + 0.01, 1.2, 0.55);
      setSel([...sel, m].sort((a, b) => a - b));
    }
  };

  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  for (const m of notes) {
    marks[m] = listening && heard.length ? 'hit' : 'sel';
    labels[m] = best ? spellInChord(best.chord, m) : plainName(m);
  }

  let title = '—';
  let sub = listening ? 'Joue un accord sur ton piano.' : 'Touche des notes sur le clavier : l’appli nomme l’accord.';
  if (best) {
    title = best.symbol;
    sub = [QUALITIES[best.chord.quality].name, best.detail].filter(Boolean).join(' · ');
  } else if (notes.length === 2) {
    title = notes.map(plainName).join(' – ');
    sub = intervalName(notes[0], notes[1]);
  } else if (notes.length === 1) {
    title = plainName(notes[0]);
    sub = 'Une note. Ajoutes-en deux autres pour former un accord.';
  } else if (notes.length >= 3) {
    title = '?';
    sub = 'Pas d’accord usuel avec ces notes.';
  }

  return (
    <>
      <section class="cl-card">
        <span class="cl-sym">{title}</span>
        <span class="cl-sub">{sub}</span>
        {best ? (
          <p class="chord-keys-line">
            {notes.map((m) => (
              <span key={m}>
                <b>{spellInChord(best.chord, m)}</b>
                <small>{degreeLabel(best.chord, mod(m, 12))}</small>
              </span>
            ))}
          </p>
        ) : null}
        {readings.length > 1 ? (
          <p class="cl-alt">
            Aussi :{' '}
            {readings
              .slice(1, 4)
              .map((r) => r.symbol + (r.detail ? ` (${r.detail})` : ''))
              .join(' · ')}
          </p>
        ) : null}
      </section>
      <Keyboard lo={LO} hi={HI} keyWidth={KEY_W} marks={withActive(marks, l.active)} labels={labels} onKey={tap} center={notes.length ? notes : [60, 72]} />
      <div class="row-actions">
        <button class="btn" disabled={!notes.length} onClick={() => setSel([])}>
          Effacer
        </button>
        <ListenButtons notes={notes} l={l} />
      </div>
      <p class="muted small">Le clavier défile. Avec le micro, joue sur ton piano : les notes entendues s’affichent et l’accord est nommé.</p>
    </>
  );
}

// ---------------------------------------------------------------- Voir un accord

const ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const GROUPS: { title: string; qs: string[] }[] = [
  { title: '3 sons', qs: ['maj', 'min', 'dim', 'aug', 'sus4'] },
  { title: '4 sons', qs: ['maj7', 'm7', '7', 'm7b5', 'dim7', '6', 'm6', 'mM7', '7sus4'] },
  { title: 'Enrichis', qs: ['maj9', 'm9', '9', '7b9', '7#9', '13', '7alt'] }
];
type Shape = 'fond' | 'inv1' | 'inv2' | 'inv3' | VoicingType;
const SHAPE_LABEL: Record<Shape, string> = {
  fond: 'État fondamental',
  inv1: '1er renversement',
  inv2: '2e renversement',
  inv3: '3e renversement',
  triad: '3 sons',
  shell: 'Shell',
  A: 'Sans fond. A',
  B: 'Sans fond. B'
};
const qLabel = (q: string) => (q === 'maj' ? 'majeur' : q === 'min' ? 'm' : QUALITIES[q].sym);

function shapesFor(q: string): Shape[] {
  const n = QUALITIES[q].iv.filter((i) => i < 12).length;
  const base: Shape[] = ['fond', 'inv1', 'inv2'];
  if (n >= 4) base.push('inv3');
  if (n >= 4 && QUALITIES[q].iv.some((i) => i === 10 || i === 11 || i === 9)) base.push('shell', 'A', 'B');
  return base;
}

function notesOf(c: Chord, shape: Shape): number[] {
  if (shape === 'shell' || shape === 'A' || shape === 'B') return lhVoicing(c, shape);
  const r = rootPc(c);
  const iv = QUALITIES[c.quality].iv;
  const base = 48 + r; // fondamentale entre C3 et B3
  const tones = iv.filter((i) => i < 12).map((i) => base + i);
  const ext = iv.filter((i) => i >= 12).map((i) => base + i);
  const k = shape === 'inv1' ? 1 : shape === 'inv2' ? 2 : shape === 'inv3' ? 3 : 0;
  const inverted = [...tones.slice(k), ...tones.slice(0, k).map((m) => m + 12)];
  return [...inverted, ...ext.map((m) => (m <= Math.max(...inverted) ? m + 12 : m))].sort((a, b) => a - b);
}

function ShowChord() {
  const l = useListen();
  const saved = load('clavier-voir', { root: 0, q: 'maj7', shape: 'fond' as Shape });
  const [root, setRoot] = useState(saved.root);
  const [q, setQ] = useState(saved.q in QUALITIES ? saved.q : 'maj7');
  const [shape, setShape] = useState<Shape>(saved.shape);
  const shapes = shapesFor(q);
  const sh = shapes.includes(shape) ? shape : 'fond';
  const c = chordOnPc(root, q);
  const notes = notesOf(c, sh);
  const update = (r: number, qq: string, s: Shape) => {
    setRoot(r);
    setQ(qq);
    setShape(s);
    save('clavier-voir', { root: r, q: qq, shape: s });
    const cc = chordOnPc(r, qq);
    playNotes(notesOf(cc, shapesFor(qq).includes(s) ? s : 'fond'));
  };
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  for (const m of notes) {
    marks[m] = 'hit';
    labels[m] = spellInChord(c, m);
  }
  const iv = QUALITIES[q].iv;
  return (
    <>
      <section class="cl-card">
        <div class="cl-head">
          <span class="cl-sym">{chordSymbol(c)}</span>
          <ListenButtons small notes={notes} l={l} />
        </div>
        <span class="cl-sub">
          {QUALITIES[q].name} · {SHAPE_LABEL[sh].toLowerCase()}
        </span>
        <p class="chord-keys-line">
          {notes.map((m) => (
            <span key={m}>
              <b>{spellInChord(c, m)}</b>
              <small>{degreeLabel(c, mod(m, 12))}</small>
            </span>
          ))}
        </p>
        <p class="cl-alt">
          Formule : <span class="mono">{iv.map((i) => degreeLabel(c, mod(rootPc(c) + i, 12))).join(' ')}</span> · {iv.map((i) => spellInChord(c, rootPc(c) + i)).join(' ')}
        </p>
      </section>
      <Keyboard lo={LO} hi={HI} keyWidth={KEY_W} marks={withActive(marks, l.active)} labels={labels} center={notes} />

      <h2 class="label">Fondamentale</h2>
      <div class="chips roots">
        {ROOTS.map((n, pc) => (
          <button key={n} class="chip" aria-pressed={pc === root} onClick={() => update(pc, q, sh)}>
            {n}
          </button>
        ))}
      </div>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <h2 class="label">{g.title}</h2>
          <div class="chips">
            {g.qs.map((x) => (
              <button key={x} class="chip" aria-pressed={x === q} onClick={() => update(root, x, sh)}>
                {qLabel(x)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <h2 class="label">Disposition</h2>
      <div class="chips">
        {shapes.map((s) => (
          <button key={s} class="chip" aria-pressed={s === sh} onClick={() => update(root, q, s)}>
            {SHAPE_LABEL[s]}
          </button>
        ))}
      </div>
    </>
  );
}
