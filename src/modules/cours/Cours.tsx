// Cours : liste des leçons et lecture d'une leçon (texte, exemples à écouter, quiz, exercice).
import { useEffect, useRef, useState } from 'preact/hooks';
import { JSX } from 'preact';
import { Chord, chordSymbol, degreeLabel, parseChord } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { SeqVoicing, playSequence, sequenceVoicings } from '../../core/audio/play';
import { load, save } from '../../core/storage';
import { TopBar } from '../../ui/Screen';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { ChevronIcon, PlayIcon } from '../../ui/icons';
import { go } from '../../ui/router';
import { Block, LESSONS, Lesson, PARTS, lessonById } from './lessons';

interface Progress {
  read: string[];
}
export const coursProgress = () => load<Progress>('cours', { read: [] });
export const nextLesson = (p: Progress) => LESSONS.find((l) => !p.read.includes(l.id));

/** « **gras** » → <b>. */
function rich(text: string) {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

// ---------------------------------------------------------------- Liste

export function CoursList() {
  const p = coursProgress();
  const next = nextLesson(p);
  return (
    <div class="screen">
      <TopBar title="Cours" back="/" />
      <p class="intro">
        {LESSONS.length} leçons de 3 à 5 minutes, chacune avec des exemples à écouter, un mini-quiz et un exercice pour pratiquer. {p.read.length}/{LESSONS.length} lues.
      </p>
      {next ? (
        <a class="resume" href={`#/cours/${next.id}`}>
          <span class="row-main">
            <span class="label">{p.read.length ? 'Leçon suivante' : 'Commencer'}</span>
            <span class="row-title">{next.title}</span>
          </span>
          <ChevronIcon />
        </a>
      ) : null}
      {PARTS.map((part) => (
        <section key={part.title}>
          <h2 class="label">{part.title}</h2>
          <div class="list">
            {part.lessons.map((l) => (
              <a key={l.id} class="row" href={`#/cours/${l.id}`}>
                <span class="row-main">
                  <span class="row-title">{l.title}</span>
                  <span class="row-sub">{l.sub}</span>
                </span>
                {p.read.includes(l.id) ? <span class="tag done">Lu</span> : <span class="tag">{l.minutes} min</span>}
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Leçon

export function LessonView({ id }: { id: string }) {
  const lesson = lessonById(id);
  if (!lesson) return <CoursList />;
  const idx = LESSONS.indexOf(lesson);
  const next = LESSONS[idx + 1] as Lesson | undefined;
  const done = () => {
    const p = coursProgress();
    if (!p.read.includes(lesson.id)) save('cours', { read: [...p.read, lesson.id] });
    go(next ? `/cours/${next.id}` : '/cours');
  };
  return (
    <div class="screen lesson">
      <TopBar title={lesson.title} back="/cours" />
      <p class="intro">
        Leçon {idx + 1}/{LESSONS.length} · {lesson.minutes} min · {lesson.sub}
      </p>
      {lesson.blocks.map((b, i) => (
        <BlockView key={`${lesson.id}-${i}`} b={b} />
      ))}
      <button class="btn primary block" onClick={done}>
        {next ? `J’ai compris · leçon suivante` : 'J’ai compris · retour aux cours'}
      </button>
      {next ? <p class="muted small">Ensuite : {next.title}.</p> : null}
    </div>
  );
}

function BlockView({ b }: { b: Block }): JSX.Element {
  switch (b.t) {
    case 'h':
      return <h2 class="ls-h">{b.text}</h2>;
    case 'p':
      return <p class="ls-p">{rich(b.text)}</p>;
    case 'tip':
      return (
        <div class="ls-tip">
          <span class="label">À retenir</span>
          <p>{rich(b.text)}</p>
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
                    <td key={j}>{c}</td>
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
    case 'go':
      return (
        <section>
          <h2 class="label">Pour pratiquer</h2>
          <div class="list">
            {b.links.map((l) => (
              <a key={l.href + l.label} class="row" href={l.href}>
                <span class="row-main">
                  <span class="row-title">{l.label}</span>
                </span>
                <ChevronIcon />
              </a>
            ))}
          </div>
        </section>
      );
  }
}

/** Exemples : toucher un accord le joue et l'affiche ; « Écouter » joue la suite en la suivant au clavier. */
function ChordDemo({ chords, romans, label, voicing, gap = 1.1 }: { chords: string[]; romans?: string[]; label?: string; voicing?: SeqVoicing; gap?: number }) {
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
