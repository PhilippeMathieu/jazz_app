// Morceaux › Mémoire : les accords se cachent peu à peu ; retrouver chacun (4 choix), ou jouer la grille de mémoire.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Chord, chordOnPc, chordSymbol, rootPc } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import { ImprovPlan } from '../../core/analysis/improv';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { Rng, seeded, shuffle } from '../../core/random';
import { Segmented } from '../../ui/Segmented';

export const MEM_LEVELS = [
  { label: '1/4', desc: 'Un accord sur quatre caché' },
  { label: '1/2', desc: 'La moitié des accords cachés' },
  { label: '3/4', desc: 'Tout caché sauf le début de chaque ligne' },
  { label: 'Tout', desc: 'Toute la grille cachée' }
];

/** Accords cachés : au hasard (reproductible), en proportion du niveau. firsts : premiers accords de chaque ligne. */
export function maskFor(n: number, level: number, firsts: number[], rng: Rng): Set<number> {
  if (level >= 3) return new Set(Array.from({ length: n }, (_, i) => i));
  if (level === 2) return new Set(Array.from({ length: n }, (_, i) => i).filter((i) => !firsts.includes(i)));
  const share = level === 0 ? 0.25 : 0.5;
  const k = Math.max(1, Math.round(n * share));
  return new Set(shuffle(Array.from({ length: n }, (_, i) => i), rng).slice(0, k));
}

/** 4 choix : le bon accord, la même fondamentale avec une autre nature, et des accords voisins de la grille. */
export function memChoices(chords: Chord[], i: number, rng: Rng): string[] {
  const c = chords[i];
  const truth = chordSymbol(c);
  const r = rootPc(c);
  const others = new Set<string>();
  const alt: Record<string, string> = { maj7: 'm7', m7: '7', '7': 'm7', m7b5: 'm7', dim7: '7', '6': 'm6', m6: '7', '7b9': 'm7b5', maj: 'min', min: 'maj' };
  others.add(chordSymbol(chordOnPc(r, alt[c.quality] ?? 'maj7')));
  // Les accords voisins dans la grille (souvent confondus : on se souvient de la suite, pas de l'ordre).
  for (const d of [1, -1, 2, -2, 3]) {
    const x = chords[i + d];
    if (x) others.add(chordSymbol(x));
  }
  others.add(chordSymbol(chordOnPc(mod(r + 5, 12), c.quality)));
  others.add(chordSymbol(chordOnPc(mod(r + 7, 12), c.quality)));
  others.delete(truth);
  return shuffle([truth, ...shuffle([...others], rng).slice(0, 3)], rng);
}

interface Best {
  /** Meilleur score (0..1) par niveau. */
  best: number[];
}

/** initialLevel : niveau imposé (par le parcours), sinon le dernier choisi pour ce morceau. */
export function useMemoire(chartId: string, plan: ImprovPlan, firsts: number[], active: boolean, initialLevel?: number) {
  const n = plan.flat.length;
  const store = `memoire:${chartId}`;
  const [level, setLevelState] = useState(() => initialLevel ?? load<{ level: number }>(`${store}:lv`, { level: 0 }).level);
  const [seed, setSeed] = useState(1);
  const [answers, setAnswers] = useState<Map<number, boolean>>(new Map());
  const [current, setCurrent] = useState<number | null>(null);
  const [best, setBest] = useState<Best>(() => load<Best>(store, { best: [] }));
  const masked = useMemo(() => maskFor(n, level, firsts, seeded(seed * 7919 + level)), [n, level, seed, firsts.join()]);
  const order = [...masked].sort((a, b) => a - b);
  const nextOpen = (from: number, ans = answers) => order.find((i) => i >= from && !ans.has(i)) ?? order.find((i) => !ans.has(i)) ?? null;
  const chords = plan.flat.map((f) => f.chord);
  const choices = useMemo(() => (current !== null ? memChoices(chords, current, seeded(seed * 31 + current)) : []), [current, seed, plan]);
  const done = order.length > 0 && order.every((i) => answers.has(i));
  const okCount = [...answers.values()].filter(Boolean).length;

  useEffect(() => {
    if (active && current === null && !done) setCurrent(nextOpen(0));
  }, [active, masked]);

  const restart = (lv = level) => {
    setAnswers(new Map());
    setSeed((x) => x + 1);
    setCurrent(null);
    if (lv !== level) {
      setLevelState(lv);
      save(`${store}:lv`, { level: lv });
    }
  };
  const answer = (sym: string) => {
    if (current === null) return;
    const ok = sym === chordSymbol(chords[current]);
    const next = new Map(answers).set(current, ok);
    setAnswers(next);
    report({ type: 'answer', exo: 'memoire', level, ok, ms: 4000 });
    const nx = nextOpen(current + 1, next);
    setCurrent(nx);
    if (nx === null) {
      const okN = [...next.values()].filter(Boolean).length;
      report({ type: 'memoire', chart: chartId, level, ok: okN, total: order.length });
      const score = okN / order.length;
      if (score > (best.best[level] ?? 0)) {
        const b = { best: Object.assign([...best.best], { [level]: score }) };
        setBest(b);
        save(store, b);
      }
    }
  };
  const pick = (i: number) => {
    if (masked.has(i) && !answers.has(i)) setCurrent(i);
  };
  /** Ce qu'affiche une case : « ? » si cachée, la couleur si on a répondu. */
  const decor = (i: number): { sym?: string; cls: string } => {
    if (!masked.has(i)) return { cls: '' };
    if (!answers.has(i)) return { sym: '?', cls: ' masked' + (i === current ? ' asked' : '') };
    return { cls: answers.get(i) ? ' mem-ok' : ' mem-bad' };
  };
  return { level, restart, masked, current, choices, answer, pick, decor, done, okCount, total: order.length, answered: answers.size, best: best.best };
}

export type Memoire = ReturnType<typeof useMemoire>;

export function MemoirePanel({ m, plan }: { m: Memoire; plan: ImprovPlan }) {
  const bar = m.current !== null ? plan.flat[m.current].bar + 1 : null;
  return (
    <section class="mem-panel">
      <Segmented label="Accords cachés" value={m.level} onChange={(lv) => m.restart(lv)} options={MEM_LEVELS.map((l, i) => ({ value: i, label: l.label }))} />
      <p class="muted small">
        {MEM_LEVELS[m.level].desc}. {m.best[m.level] ? `Ton meilleur score à ce niveau : ${Math.round(m.best[m.level] * 100)} %.` : ''} Tu peux aussi lancer la lecture et jouer la grille de mémoire.
      </p>
      {m.done ? (
        <div class="fb">
          <p class={'verdict ' + (m.okCount === m.total ? 'ok' : 'bad')}>
            {m.okCount}/{m.total} retrouvés{m.okCount === m.total ? ' : la grille est sue à ce niveau.' : '.'}
          </p>
          <div class="row-actions">
            <button class="btn" onClick={() => m.restart()}>
              Recommencer
            </button>
            {m.level < MEM_LEVELS.length - 1 ? (
              <button class="btn primary grow" onClick={() => m.restart(m.level + 1)}>
                Cacher plus
              </button>
            ) : null}
          </div>
        </div>
      ) : m.current !== null ? (
        <>
          <p class="prompt-sm">
            Mesure {bar} : quel accord ? <span class="muted small">({m.answered}/{m.total})</span>
          </p>
          <div class="choices">
            {m.choices.map((c) => (
              <button key={c} class="choice" onClick={() => m.answer(c)}>
                <span>{c}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
