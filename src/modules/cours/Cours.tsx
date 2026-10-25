// Cours : liste des leçons et lecture d'une leçon (texte, exemples à écouter, quiz, exercice).
import { useEffect, useRef, useState } from 'preact/hooks';
import { JSX } from 'preact';
import { Chord, chordSymbol, degreeLabel, parseChord } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { SeqVoicing, playSequence, sequenceVoicings } from '../../core/audio/play';
import { report } from '../../core/events';
import { TopBar } from '../../ui/Screen';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { PlayIcon, StopIcon } from '../../ui/icons';
import { Block, lessonById } from './lessons';
import { TipCard } from './Tips';
import { ChainDemo, PairDemo } from './PairDemo';
import { RhythmGrid, useCursor } from '../../ui/RhythmGrid';
import { rhythmById } from '../../core/rhythm/patterns';
import { playGroove, playRhythm, stopPlayback } from '../../core/rhythm/play';
import { GROOVES, StyleId } from '../../core/rhythm/styles';
import { Drawer } from '../../ui/Drawer';
import { Term, splitTerms, termById } from './glossary';
import { STEPS } from '../../parcours/steps';

/** Mots du lexique déjà rendus touchables dans la leçon, et ce qu'on fait quand on en touche un. */
interface Terms {
  seen: Set<string>;
  open: (id: string) => void;
}

/** « **gras** » → <b> ; la première apparition d'un mot du lexique devient touchable. */
function rich(text: string, terms?: Terms) {
  return text.split('**').map((part, i) => {
    const content = terms
      ? splitTerms(part, terms.seen).map((x, j) =>
          'term' in x ? (
            <button key={j} class="term" onClick={() => terms.open(x.term.id)}>
              {x.text}
            </button>
          ) : (
            x.text
          )
        )
      : part;
    return i % 2 ? <b key={i}>{content}</b> : <span key={i}>{content}</span>;
  });
}

/** L'explication d'un mot : définition, à quoi ça sert, un exemple à écouter, la leçon qui le détaille. */
export function TermCard({ term }: { term: Term }) {
  const step = term.lesson ? STEPS.findIndex((s) => s.lessons.includes(term.lesson!)) : -1;
  const lesson = term.lesson ? lessonById(term.lesson) : undefined;
  return (
    <div class="term-card">
      <h2 class="drawer-title">{term.title}</h2>
      <p class="ls-p">{rich(term.text)}</p>
      {term.why ? <p class="ls-p">{rich(term.why)}</p> : null}
      {term.example ? <ChordDemo chords={term.example.chords} romans={term.example.romans} label={term.example.label} voicing={term.example.voicing} gap={1.3} /> : null}
      {lesson && step >= 0 ? (
        <p class="muted small">
          Expliqué en détail : étape {step + 1}, « {lesson.title} ».
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Leçon

/** Une leçon. « J'ai compris » la compte comme lue (le parcours l'enregistre), puis onDone. */
export function LessonView({ id, where, onBack, onDone }: { id: string; where: string; onBack: () => void; onDone: () => void }) {
  const lesson = lessonById(id);
  const [term, setTerm] = useState<string | null>(null);
  if (!lesson) return null;
  const done = () => {
    report({ type: 'lesson', id: lesson.id });
    onDone();
  };
  // Chaque rendu repart de zéro : la première apparition de chaque mot, dans l'ordre de la leçon.
  const terms: Terms = { seen: new Set(), open: (tid) => setTerm(tid) };
  return (
    <div class="screen lesson">
      <TopBar title={lesson.title} onBack={onBack} />
      <p class="intro">
        {where} · {lesson.minutes} min · {lesson.sub}
      </p>
      <p class="muted small">
        Un mot <span class="term demo">souligné</span> ? Touche-le pour son explication. Tous les mots : <a href="#/lexique">le lexique</a>.
      </p>
      {lesson.blocks.map((b, i) => (
        <BlockView key={`${lesson.id}-${i}`} b={b} terms={terms} />
      ))}
      <button class="btn primary block" onClick={done}>
        J’ai compris
      </button>
      <Drawer open={term !== null} onClose={() => setTerm(null)} label="Explication">
        {term && termById(term) ? <TermCard term={termById(term)!} /> : null}
      </Drawer>
    </div>
  );
}

function BlockView({ b, terms }: { b: Block; terms?: Terms }): JSX.Element {
  switch (b.t) {
    case 'h':
      return <h2 class="ls-h">{b.text}</h2>;
    case 'p':
      return <p class="ls-p">{rich(b.text, terms)}</p>;
    case 'tip':
      return (
        <div class="ls-tip">
          <span class="label">À retenir</span>
          <p>{rich(b.text, terms)}</p>
        </div>
      );
    case 'table':
      return (
        <div class="ls-table">
          <table>
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{rich(c, terms)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'chords':
      return <ChordDemo chords={b.chords} romans={b.romans} label={b.label} voicing={b.voicing} gap={b.gap} />;
    case 'quiz':
      return <QuizBlock q={b.q} choices={b.choices} answer={b.answer} explain={b.explain} />;
    case 'rhythm':
      return <RhythmDemo id={b.id} label={b.label} compare={b.compare} tempo={b.tempo} />;
    case 'grooves':
      return <GroovesDemo styles={b.styles} label={b.label} />;
    case 'astuce':
      return <TipCard id={b.id} />;
    case 'pair':
      return <PairDemo a={b.a} b={b.b} />;
    case 'chain':
      return <ChainDemo chain={b.chain} />;
  }
}

/** Exemples : toucher un accord le joue et l'affiche ; « Écouter » joue la suite en la suivant au clavier. */
function ChordDemo({ chords, romans, label, voicing: asked, gap = 1.1 }: { chords: string[]; romans?: string[]; label?: string; voicing?: SeqVoicing; gap?: number }) {
  // Par défaut, l'accord tel qu'on l'apprend (1 3 5 7, fondamentale en bas) : pas de 9e ni de 13e non écrites.
  const voicing: SeqVoicing = asked ?? 'close';
  const parsed = chords.map((c) => parseChord(c)).filter((c): c is Chord => !!c);
  const voicings = sequenceVoicings(parsed, voicing);
  const [active, setActive] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const playAll = () => {
    clear();
    playSequence(parsed, { gap, voicing });
    parsed.forEach((_, i) => timers.current.push(window.setTimeout(() => setActive(i), 50 + i * gap * 1000)));
  };
  const playAt = (i: number) => {
    clear();
    setActive(i);
    // Le voicing affiché est celui de la suite : on le rejoue tel quel.
    playSequence([parsed[i]], { gap: 1.4, voicing: Array.isArray(voicing) ? voicing[i % voicing.length] : voicing });
  };

  const v = active !== null ? voicings[active] : null;
  const c = active !== null ? parsed[active] : null;
  const lo = v ? Math.min(12 * Math.floor(Math.min(...v) / 12), 48) : 48;
  const hi = Math.max(lo + 23, v ? 12 * Math.ceil((Math.max(...v) + 1) / 12) - 1 : 71);
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  if (v && c) for (const m of v) {
    marks[m] = 'hit';
    labels[m] = degreeLabel(c, mod(m, 12));
  }
  return (
    <div class="ls-demo">
      <div class="ls-demo-head">
        <span class="muted small">{label ?? 'Écoute, puis touche un accord'}</span>
        {parsed.length > 1 ? (
          <button class="btn sm" onClick={playAll}>
            <PlayIcon /> Écouter
          </button>
        ) : null}
      </div>
      <div class="ls-chips">
        {parsed.map((ch, i) => (
          <button key={i} class={'seqchord' + (active === i ? ' focus' : '')} onClick={() => playAt(i)}>
            <span class="sym">{chordSymbol(ch)}</span>
            {romans ? <span class="rn">{romans[i]}</span> : null}
          </button>
        ))}
      </div>
      {v ? <Keyboard lo={lo} hi={hi} fit marks={marks} labels={labels} /> : null}
    </div>
  );
}

/** Un rythme en cases ; « Écouter » le joue (décompte d'une mesure) en allumant chaque attaque. */
function RhythmDemo({ id, label, compare, tempo = 100 }: { id: string; label?: string; compare?: boolean; tempo?: number }) {
  const p = rhythmById(id)!;
  const [active, follow, unfollow] = useCursor();
  useEffect(() => () => stopPlayback(), []);
  const play = (feel: 'swing' | 'straight') => {
    unfollow();
    follow(playRhythm(p, tempo, { reps: 2, demo: true, feel }), p);
  };
  return (
    <div class="ls-demo">
      <div class="ls-demo-head">
        <span class="muted small">{label ?? p.name}</span>
        {compare ? (
          <span class="row-actions tight">
            <button class="btn sm" onClick={() => play('swing')}>
              <PlayIcon /> Swing
            </button>
            <button class="btn sm" onClick={() => play('straight')}>
              <PlayIcon /> Droit
            </button>
          </span>
        ) : (
          <button class="btn sm" onClick={() => play('swing')}>
            <PlayIcon /> Écouter
          </button>
        )}
      </div>
      <RhythmGrid p={p} active={active} />
    </div>
  );
}

/** Quelques mesures de chaque style, avec ce qu'il faut entendre. */
/** Quelques mesures de chaque style, avec ce qu'il faut entendre. */
function GroovesDemo({ styles, label }: { styles: StyleId[]; label?: string }) {
  const [playing, setPlaying] = useState<StyleId | null>(null);
  const timer = useRef(0);
  useEffect(() => () => (clearTimeout(timer.current), stopPlayback()), []);
  const toggle = (id: StyleId) => {
    clearTimeout(timer.current);
    if (playing === id) {
      stopPlayback();
      setPlaying(null);
      return;
    }
    const g = playGroove(id, 8);
    setPlaying(id);
    timer.current = window.setTimeout(() => setPlaying(null), g.duration * 1000 + 300);
  };
  return (
    <div class="ls-demo">
      {label ? <span class="muted small">{label}</span> : null}
      <div class="grooves">
        {styles.map((id) => {
          const g = GROOVES[id];
          const on = playing === id;
          return (
            <div key={id} class={'groove' + (on ? ' on' : '')}>
              <button class="groove-head" aria-pressed={on} onClick={() => toggle(id)}>
                {on ? <StopIcon /> : <PlayIcon />}
                <span class="row-main">
                  <span class="row-title">{g.name}</span>
                  <span class="row-sub">{g.summary}</span>
                </span>
              </button>
              {on ? (
                <ul class="cues">
                  {g.cues.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuizBlock({ q, choices, answer, explain }: { q: string; choices: string[]; answer: number; explain: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div class="ls-quiz">
      <span class="label">Quiz</span>
      <p class="ls-q">{q}</p>
      <div class="choices long">
        {choices.map((c, i) => {
          const state = picked === null ? '' : i === answer ? ' is-ok' : i === picked ? ' is-bad' : '';
          return (
            <button key={c} class={'choice' + state} disabled={picked !== null} onClick={() => setPicked(i)}>
              {c}
            </button>
          );
        })}
      </div>
      {picked !== null ? (
        <p class="small">
          <span class={'verdict ' + (picked === answer ? 'ok' : 'bad')}>{picked === answer ? 'Oui. ' : 'Non. '}</span>
          <span class="muted">{explain}</span>
        </p>
      ) : null}
    </div>
  );
}
