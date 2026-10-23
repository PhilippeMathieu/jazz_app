// « Au piano » : comment jouer une phrase de la grille. La main droite enchaîne les accords sans sauter
// (renversements, notes communes), avec ou sans couleurs (7e) ; des astuces calculées sur la phrase.
import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chord, chordSymbol, rootPc } from '../../core/theory/chords';
import { mod, noteName, pcOf, spellWith } from '../../core/theory/notes';
import { Key, keyLabel } from '../../core/chart/model';
import { romanIn } from '../../core/analysis/analyze';
import { Phrase, simpleDegree } from '../../core/analysis/story';
import { ImprovPlan } from '../../core/analysis/improv';
import { Color, chain, moves, spellIn } from '../../core/analysis/rh';
import { audio, now, piano, playChord } from '../../core/audio/engine';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { PlayIcon } from '../../ui/icons';
import { Segmented } from '../../ui/Segmented';
import { load, save } from '../../core/storage';

const P = (s: string) => s.replace(/b/g, '♭').replace(/#/g, '♯');
/** Note à `letters` lettres et `semis` demi-tons au-dessus de la fondamentale de l'accord. */
const above = (c: Chord, letters: number, semis: number) => noteName(spellWith(c.root.letter + letters, pcOf(c.root) + semis));
const rootName = (c: Chord) => noteName(c.root);

/** Les accords d'une phrase, sans répéter un accord tenu sur plusieurs mesures. */
export function phraseChords(plan: ImprovPlan, phrase: Phrase): Chord[] {
  const out: Chord[] = [];
  for (const c of phrase.chords) {
    const ch = plan.flat[c.index].chord;
    const prev = out[out.length - 1];
    if (!prev || chordSymbol(prev) !== chordSymbol(ch)) out.push(ch);
  }
  return out;
}

/** Astuces pour jouer cette phrase : sus4 sur le V, l'« Amen » IV → I, la dominante avant le vi. */
export function phraseTips(chords: Chord[], degrees: string[], key: Key): string[] {
  const out: string[] = [];
  const at = (d: string) => degrees.findIndex((x, i) => x === d && i + 1 < degrees.length);
  const v = degrees.findIndex((d, i) => (d === 'V' || d === 'v') && /^(I|i)$/.test(degrees[i + 1] ?? ''));
  if (v >= 0) {
    const c = chords[v];
    out.push(`Avant ${chordSymbol(chords[v + 1])} : joue d’abord ${rootName(c)}sus4 (${above(c, 3, 5)} à la place de ${above(c, 2, 4)}), puis ${chordSymbol(c)} : la 4te descend sur la 3ce, l’arrivée sur le I s’entend mieux.`);
  }
  const iv = degrees.findIndex((d, i) => (d === 'IV' || d === 'iv') && /^(I|i)$/.test(degrees[i + 1] ?? ''));
  if (iv >= 0) {
    out.push(`${chordSymbol(chords[iv])} → ${chordSymbol(chords[iv + 1])} : la cadence de l’« Amen ». ${above(chords[iv], 4, 7)} reste, les autres notes descendent d’un petit pas.`);
  }
  const vi = key.mode === 'major' ? degrees.indexOf('vi') : -1;
  if (vi > 0) {
    const c = chords[vi];
    out.push(`Couleur en plus : glisse ${above(c, 4, 7)}7 juste avant ${chordSymbol(c)} (sa dominante, avec ${above(c, 6, 11)}, la note qui tire vers ${rootName(c)}).`);
  }
  if (at('I') >= 0 && key.mode === 'major') {
    const c = chords[at('I')];
    out.push(`Sur ${rootName(c)}, ajoute la 9e (${above(c, 1, 2)}) au-dessus de l’accord : ${rootName(c)}add9, plus ouvert, sans changer d’accord.`);
  }
  return out.slice(0, 3);
}

export function AuPiano({ plan, phrase }: { plan: ImprovPlan; phrase: Phrase }) {
  const [color, setColorState] = useState<Color>(() => load<{ color: Color }>('au-piano', { color: 'simple' }).color);
  const setColor = (c: Color) => (setColorState(c), save('au-piano', { color: c }));
  const chords = useMemo(() => phraseChords(plan, phrase), [plan, phrase]);
  const degrees = useMemo(() => chords.map((c) => simpleDegree(romanIn(c, phrase.key), c.quality)), [chords, phrase]);
  const voicings = useMemo(() => chain(chords, degrees, color), [chords, degrees, color]);
  const tips = useMemo(() => phraseTips(chords, degrees, phrase.key), [chords, degrees, phrase]);
  const [active, setActive] = useState(0);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const bassOf = (c: Chord) => 36 + mod(rootPc(c) - 36, 12);
  const sound = (i: number, t: number, len: number) => {
    const b = bassOf(chords[i]);
    piano(b, t, len * 0.95, 0.55);
    piano(b + 12, t, len * 0.95, 0.45);
    playChord(voicings[i], t + 0.01, len * 0.95, 0.5, 0.008);
  };
  const play = () => {
    clear();
    audio();
    const t0 = now() + 0.05;
    const gap = 1.25;
    chords.forEach((_, i) => {
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

  const v = voicings[Math.min(active, voicings.length - 1)] ?? [];
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  const ac = chords[Math.min(active, chords.length - 1)];
  for (const m of v) {
    marks[m] = 'hit';
    labels[m] = spellIn(ac, m);
  }
  return (
    <section class="au-piano">
      <div class="ls-demo-head">
        <button class="btn sm" onClick={play}>
          <PlayIcon /> Écouter
        </button>
        <Segmented
          label="Couleurs"
          value={color}
          onChange={(c: Color) => setColor(c)}
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'couleurs', label: 'Avec 7e' }
          ]}
        />
      </div>
      <p class="muted small">
        Main gauche : la fondamentale, en octave. Main droite : chaque accord renversé pour bouger le moins possible : les notes communes restent, les autres font un petit pas.
      </p>
      <div class="tip-flow">
        {chords.map((c, i) => {
          const mv = i + 1 < voicings.length ? moves(voicings[i], voicings[i + 1], c, chords[i + 1]) : null;
          return (
            <Fragment key={i}>
              <button class={'tip-chord' + (active === i ? ' on' : '')} onClick={() => playOne(i)}>
                <span class="sym">{chordSymbol(c)}</span>
                <span class="rn">{P(degrees[i])}</span>
                <span class="tip-line">
                  {[...voicings[i]].reverse().map((m) => (
                    <b key={m}>{spellIn(c, m)}</b>
                  ))}
                </span>
              </button>
              {mv ? (
                <span class="tip-move">
                  {mv.stay.length ? <span class="stay">{mv.stay.join(', ')} reste{mv.stay.length > 1 ? 'nt' : ''}</span> : null}
                  {mv.go.map((g) => (
                    <span key={g}>{g}</span>
                  ))}
                </span>
              ) : null}
            </Fragment>
          );
        })}
      </div>
      <Keyboard lo={53} hi={81} fit marks={marks} labels={labels} />
      {tips.length ? (
        <ul class="au-tips">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      <p class="muted small">En {keyLabel(phrase.key)}. Touche un accord pour l’entendre seul.</p>
    </section>
  );
}
