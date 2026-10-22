// Astuces d'enchaînement : comment une note de la main droite passe d'un accord au suivant.
// Chaque astuce : la règle en mots, les accords avec la note jouée et son mouvement, un clavier, l'écoute.
import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { chordSymbol, degreeLabel } from '../../core/theory/chords';
import { keyLabel } from '../../core/chart/model';
import { isBlackKey } from '../../core/theory/notes';
import { audio, now, piano, playChord } from '../../core/audio/engine';
import { sequenceVoicings } from '../../core/audio/play';
import { TopBar } from '../../ui/Screen';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { PlayIcon } from '../../ui/icons';
import { TIPS, Tip, anotherKey, chordPcs, motion, realize, shortOf } from './tips';

/** Les astuces d'une étape (ou toutes). */
export function TipsView({ ids, where, onBack }: { ids?: string[]; where?: string; onBack: () => void }) {
  const tips = ids ? ids.map((id) => TIPS.find((t) => t.id === id)).filter((t): t is Tip => !!t) : TIPS;
  return (
    <div class="screen lesson">
      <TopBar title="Astuces d’enchaînement" onBack={onBack} />
      {where ? <p class="muted small">{where}</p> : null}
      <div class="ls-tip">
        <p class="ls-p">
          Pour passer d’un accord au suivant, une note de la main droite <b>reste</b> ou <b>glisse d’un demi-ton</b>. Écoute, puis joue : main gauche l’accord, main droite
          la note en jaune.
        </p>
      </div>
      {tips.map((t, i) => (
        <TipCard key={t.id} tip={t} n={i + 1} />
      ))}
      <p class="muted small">« Autre tonalité » : la même astuce marche partout. Ces astuces sont facultatives, elles ne comptent pas pour finir l’étape.</p>
    </div>
  );
}

function TipCard({ tip, n }: { tip: Tip; n: number }) {
  const [pc, setPc] = useState(0);
  const r = useMemo(() => realize(tip, pc), [tip, pc]);
  const voicings = useMemo(() => sequenceVoicings(r.chords, 'shell'), [r]);
  const [active, setActive] = useState(0);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);
  const gap = tip.gap ?? 1.3;

  /** Joue l'accord i (main gauche en shell) et sa ligne, à partir de t. */
  const sound = (i: number, t: number, len: number) => {
    playChord(voicings[i], t, len * 0.95, 0.42);
    const notes = r.line.filter((x) => x.chord === i);
    notes.forEach((x, j) => {
      if (tip.together) piano(x.midi, t, len * 0.9, 0.7);
      else piano(x.midi, t + (j * len) / notes.length, (len / notes.length) * 0.95, 0.75);
    });
  };
  const play = () => {
    clear();
    audio();
    const t0 = now() + 0.05;
    r.chords.forEach((_, i) => {
      sound(i, t0 + i * gap, gap);
      timers.current.push(window.setTimeout(() => setActive(i), 50 + i * gap * 1000));
    });
  };
  const playOne = (i: number) => {
    clear();
    audio();
    setActive(i);
    sound(i, now() + 0.05, 1.4);
  };

  // Clavier : la tessiture de la ligne ; en gris les notes de l'accord, en jaune la note jouée.
  const midis = r.line.map((x) => x.midi);
  let lo = Math.min(...midis) - 2;
  let hi = Math.max(...midis) + 2;
  // Au moins 15 touches blanches (deux octaves), pour voir l'accord autour de la note.
  const whites = () => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((m) => !isBlackKey(m)).length;
  for (let k = 0; whites() < 15; k++) k % 2 ? hi++ : lo--;
  while (isBlackKey(lo)) lo--;
  while (isBlackKey(hi)) hi++;
  const c = r.chords[active];
  const pcs = chordPcs(c);
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  for (let m = lo; m <= hi; m++)
    if (pcs.includes(m % 12)) {
      marks[m] = 'soft';
      labels[m] = shortOf(degreeLabel(c, m % 12));
    }
  const here = r.line.filter((x) => x.chord === active);
  for (const x of here) {
    marks[x.midi] = 'hit';
    labels[x.midi] = x.short || '•';
  }

  return (
    <article class="tip">
      <div class="tip-head">
        <span class="tip-n">{n}</span>
        <h2 class="tip-title">{tip.title}</h2>
      </div>
      <p class="ls-p">{tip.rule}</p>
      <div class="tip-ex">
        <div class="ls-demo-head">
          <button class="btn sm" onClick={play}>
            <PlayIcon /> Écouter
          </button>
          <span class="muted small">En {keyLabel(r.key)}</span>
          <button class="btn sm ghost" onClick={() => setPc(anotherKey(tip, pc))}>
            Autre tonalité
          </button>
        </div>
        <div class="tip-flow">
          {r.chords.map((ch, i) => {
            const notes = r.line.filter((x) => x.chord === i);
            const next = r.line.filter((x) => x.chord === i + 1);
            // Mouvement vers l'accord suivant : chaque voix si deux notes sonnent ensemble, sinon de la dernière à la première.
            const moves = !next.length
              ? []
              : tip.together && notes.length === next.length
                ? notes.map((x, j) => `${x.name} ${motion(x.midi, next[j].midi)}`)
                : [motion(notes[notes.length - 1].midi, next[0].midi)];
            return (
              <Fragment key={i}>
                <button class={'tip-chord' + (active === i ? ' on' : '')} onClick={() => playOne(i)}>
                  <span class="sym">{chordSymbol(ch)}</span>
                  <span class="rn">{r.romans[i]}</span>
                  <span class="tip-line">
                    {notes.map((x, j) => (
                      <b key={j}>
                        {x.name}
                        <small>{x.role}</small>
                      </b>
                    ))}
                  </span>
                </button>
                {moves.length ? (
                  <span class="tip-move" aria-label={moves.join(', ')}>
                    {moves.map((m, j) => (
                      <span key={j} class={m.endsWith('reste') ? 'stay' : ''}>
                        {m}
                      </span>
                    ))}
                  </span>
                ) : null}
              </Fragment>
            );
          })}
        </div>
        <Keyboard lo={lo} hi={hi} fit marks={marks} labels={labels} />
        <p class="muted small">
          {chordSymbol(c)} : en gris les notes de l’accord, en jaune {here.length > 1 ? 'les notes jouées' : 'la note jouée'} ({here.map((x) => `${x.name}, ${x.role}`).join(' ; ')}). Touche un accord
          pour l’entendre.
        </p>
      </div>
    </article>
  );
}
