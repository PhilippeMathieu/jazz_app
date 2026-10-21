// Réharmoniser : SubV, dominantes secondaires et leur ii, diminués de passage, ii–V du SubV, ii–V chromatiques.
// Questions sans interface, testables.
import { Key, keyOnPc } from '../../core/chart/model';
import { Chord, QUALITIES, chordOnPc, chordSymbol, rootPc, spellInChord } from '../../core/theory/chords';
import { mod, pcOf, spellWith } from '../../core/theory/notes';
import { Rng, pick, shuffle, weightedPick } from '../../core/random';

export type RType = 'subv' | 'subvBack' | 'secdom' | 'relii' | 'dim' | 'iivSub' | 'iivChrom' | 'spot';
export const RTYPE_LABEL: Record<RType, string> = {
  subv: 'SubV',
  subvBack: 'SubV, à l’envers',
  secdom: 'Dominante secondaire',
  relii: 'ii de la dominante',
  dim: 'Diminué de passage',
  iivSub: 'ii–V du SubV',
  iivChrom: 'ii–V chromatique',
  spot: 'Reconnaître'
};
export const REHARM_LEVELS: { name: string; desc: string; types: RType[] }[] = [
  { name: 'SubV', desc: 'Le substitut tritonique : D♭7 à la place de G7', types: ['subv', 'subvBack'] },
  { name: 'Dominantes', desc: '+ dominantes secondaires (A7 vers Dm7) et leur ii (Em7–A7)', types: ['subv', 'secdom', 'relii'] },
  { name: 'Diminués', desc: '+ diminués de passage (C♯°7 entre C et Dm7)', types: ['secdom', 'relii', 'dim'] },
  { name: 'ii–V', desc: '+ ii–V du SubV (A♭m7–D♭7), ii–V chromatiques', types: ['subv', 'dim', 'iivSub', 'iivChrom'] },
  { name: 'Reconnaître', desc: 'Avant / après : quelle technique a servi ?', types: ['spot'] }
];
const SPOT_CHOICES = ['SubV', 'Dominante secondaire', 'Diminué de passage', 'ii–V du SubV', 'Backdoor'];

export interface RQuestion {
  type: RType;
  key: Key;
  before: Chord[];
  after: Chord[];
  /** Accords concernés (indices dans before), surlignés. */
  focus: number[];
  prompt: string;
  choices: string[];
  answer: string;
  explain: string;
}

/** Accord de nature q sur la classe de hauteur pc, écrit avec la lettre de son degré dans la tonalité. */
const deg = (key: Key, semis: number, letter: number, q: string): Chord => {
  const root = spellWith(key.tonic.letter + letter, pcOf(key.tonic) + semis);
  // La lettre du degré (D♭7 en C), sauf orthographe rare : E7 plutôt que F♭7 en E♭.
  return Math.abs(root.acc) <= 1 && !isOdd(root) ? { root, quality: q } : chordOnPc(mod(pcOf(key.tonic) + semis, 12), q);
};
/** Le ii d'une dominante, écrit à partir d'elle (A♭m7 pour D♭7, F♯m7 pour B7). */
const iiOf = (v: Chord): Chord => {
  const root = spellWith(v.root.letter + 4, rootPc(v) + 7);
  return Math.abs(root.acc) <= 1 && !isOdd(root) ? { root, quality: 'm7' } : chordOnPc(mod(rootPc(v) + 7, 12), 'm7');
};
/** Un ii–V dont la dominante est sur le degré `semis`. */
const iiV = (key: Key, semis: number, letter: number): [Chord, Chord] => {
  const v = deg(key, semis, letter, '7');
  return [iiOf(v), v];
};
/** E♯, B♯, C♭, F♭ : rares en jazz, sauf tonalités très altérées. */
const isOdd = (n: { letter: number; acc: number }) => (n.acc === 1 && (n.letter === 2 || n.letter === 6)) || (n.acc === -1 && (n.letter === 0 || n.letter === 3));
/** Accord sur une classe de hauteur, orthographe la plus simple. */
const on = (pc: number, q: string) => chordOnPc(mod(pc, 12), q);
const sym = chordSymbol;
/** Note haussée d'un demi-ton sur la même lettre (C → C♯) ; sans double dièse (F♯ → G). */
const raised = (letter: number, pc: number) => {
  const n = spellWith(letter, pc);
  return Math.abs(n.acc) <= 1 ? n : spellWith(letter + 1, pc);
};
const pair = (a: Chord, b: Chord) => `${sym(a)} ${sym(b)}`;
const COMMON = [0, 5, 7, 10, 2, 3, 9];

/** Les 3ce et 7e d'une dominante (son triton). */
const tritone = (c: Chord) => {
  const r = rootPc(c);
  return `${spellInChord(c, r + 4)}–${spellInChord(c, r + 10)}`;
};

function choices(answer: string, others: string[], rng: Rng): string[] {
  return shuffle([answer, ...[...new Set(others)].filter((x) => x !== answer).slice(0, 3)], rng);
}

export function makeReharm(level: number, tally: Record<string, { c: number; t: number }> = {}, rng: Rng = Math.random, forced?: RType): RQuestion {
  const lv = REHARM_LEVELS[level] ?? REHARM_LEVELS[0];
  const type =
    forced ?? weightedPick(lv.types, (t) => 1 + 2 * (1 - ((tally[t]?.c ?? 0) + 1) / ((tally[t]?.t ?? 0) + 2)), rng);
  const key = keyOnPc(level <= 1 ? pick(COMMON, rng) : Math.floor(rng() * 12), 'major');
  const t = pcOf(key.tonic);
  const I = deg(key, 0, 0, 'maj7');
  const ii = deg(key, 2, 1, 'm7');
  const iii = deg(key, 4, 2, 'm7');
  const IV = deg(key, 5, 3, 'maj7');
  const V = deg(key, 7, 4, '7');
  const vi = deg(key, 9, 5, 'm7');
  const subV = deg(key, 1, 1, '7');

  switch (type) {
    case 'subv': {
      return {
        type,
        key,
        before: [ii, V, I],
        after: [ii, subV, I],
        focus: [1],
        prompt: `Remplace ${sym(V)} par son substitut tritonique (SubV).`,
        answer: sym(subV),
        choices: choices(sym(subV), [sym(deg(key, 10, 6, '7')), sym(deg(key, 8, 5, '7')), sym(deg(key, 2, 1, '7'))], rng),
        explain: `${sym(V)} et ${sym(subV)} ont le même triton (${tritone(V)}) : on peut les échanger. Sa fondamentale est à un triton de ${sym(V).replace('7', '')}, et la basse descend par demi-tons : ${sym(ii).replace('m7', '')} → ${sym(subV).replace('7', '')} → ${sym(I).replace('maj7', '')}.`
      };
    }
    case 'subvBack': {
      return {
        type,
        key,
        before: [ii, subV, I],
        after: [ii, V, I],
        focus: [1],
        prompt: `${pair(ii, subV)} ${sym(I)} : ${sym(subV)} remplace quel accord ?`,
        answer: sym(V),
        choices: choices(sym(V), [sym(deg(key, 8, 5, '7')), sym(deg(key, 2, 1, '7')), sym(deg(key, 3, 2, '7'))], rng),
        explain: `${sym(subV)} est le SubV de ${sym(V)} : leurs fondamentales sont à un triton, et ils partagent le triton ${tritone(V)}. Les deux mènent à ${sym(I)}.`
      };
    }
    case 'secdom': {
      // Grille I – vi – ii – V : la dominante qui mène à l'un des trois accords suivants.
      const grid = [I, vi, ii, V];
      const k = 1 + Math.floor(rng() * 3);
      const target = grid[k];
      const tr = rootPc(target);
      const dom = { root: spellWith(target.root.letter + 4, tr + 7), quality: '7' };
      const after = grid.map((c, i) => (i === k - 1 && i > 0 ? dom : c));
      if (k === 1) after.splice(1, 0, dom);
      return {
        type,
        key,
        before: grid,
        after,
        focus: [k],
        prompt: `Quelle dominante secondaire mène à ${sym(target)} ?`,
        answer: sym(dom),
        choices: choices(sym(dom), [sym(on(tr + 5, '7')), sym(on(tr + 2, '7')), sym(on(tr - 2, '7')), sym(on(tr + 9, '7'))], rng),
        explain: `${sym(dom)} est la dominante de ${sym(target)} (une quinte au-dessus) : sa tierce ${spellInChord(dom, tr + 11)} monte d’un demi-ton sur ${spellInChord(target, tr)}. On la met à la place de l’accord d’avant.`
      };
    }
    case 'relii': {
      const target = pick([ii, iii, vi, IV], rng);
      const tr = rootPc(target);
      const dom = { root: spellWith(target.root.letter + 4, tr + 7), quality: '7' };
      const rel = { root: spellWith(dom.root.letter + 4, tr + 14), quality: 'm7' };
      return {
        type,
        key,
        before: [I, dom, target],
        after: [I, rel, dom, target],
        focus: [1],
        prompt: `${sym(dom)} mène à ${sym(target)}. Quel ii placer avant ${sym(dom)} (ii–V vers ${sym(target)}) ?`,
        answer: sym(rel),
        choices: choices(sym(rel), [sym(on(tr + 2, 'm7')), sym(on(tr + 5, 'm7')), sym(on(tr + 10, 'm7')), sym(on(tr + 9, 'm7'))], rng),
        explain: `Le ii d’une dominante est le m7 une quinte au-dessus de sa fondamentale : ${sym(rel)}–${sym(dom)}, comme Dm7–G7 vers C. Sur une cible mineure, on l’écrit souvent ø7 (${sym({ ...rel, quality: 'm7b5' })}).`
      };
    }
    case 'dim': {
      const pairs: [Chord, Chord][] = [
        [I, ii],
        [ii, iii],
        [IV, deg(key, 7, 4, '7')]
      ];
      const [x, y] = pick(pairs, rng);
      const xr = rootPc(x);
      const d = { root: raised(x.root.letter, xr + 1), quality: 'dim7' };
      const yr = rootPc(y);
      const dom = { root: spellWith(y.root.letter + 4, yr + 7), quality: '7' };
      return {
        type,
        key,
        before: [x, y],
        after: [x, d, y],
        focus: [0, 1],
        prompt: `Quel diminué de passage entre ${sym(x)} et ${sym(y)} ?`,
        answer: sym(d),
        // Trois diminués d'une autre famille (les diminués se répètent tous les 3 demi-tons).
        choices: choices(sym(d), [sym({ root: raised(y.root.letter, yr + 1), quality: 'dim7' }), sym(on(xr - 1, 'dim7')), sym(on(yr + 4, 'dim7'))], rng),
        explain: `${sym(d)} monte d’un demi-ton vers ${sym(y)} : c’est ${sym(dom)}♭9 sans fondamentale (${QUALITIES.dim7.iv.map((iv) => spellInChord(d, xr + 1 + iv)).join(' ')}), la dominante de ${sym(y)}. La basse monte par demi-tons.`
      };
    }
    case 'iivSub': {
      const relSub = iiOf(subV);
      return {
        type,
        key,
        before: [ii, V, I],
        after: [relSub, subV, I],
        focus: [0, 1],
        prompt: `Remplace ${pair(ii, V)} par le ii–V du SubV.`,
        answer: pair(relSub, subV),
        choices: choices(pair(relSub, subV), [pair(...iiV(key, 8, 5)), pair(...iiV(key, 2, 1)), pair(...iiV(key, 6, 4))], rng),
        explain: `${sym(subV)} remplace ${sym(V)} ; son ii, ${sym(relSub)}, remplace ${sym(ii)}. Toute la cadence est déplacée d’un triton, puis se résout par demi-ton sur ${sym(I)} (la fin de « Satin Doll »).`
      };
    }
    case 'iivChrom': {
      const up = iiV(key, 8, 5);
      return {
        type,
        key,
        before: [ii, V, I],
        after: [...up, ii, V, I],
        focus: [0],
        prompt: `Avant ${pair(ii, V)}, quel ii–V un demi-ton au-dessus ?`,
        answer: pair(up[0], up[1]),
        choices: choices(pair(up[0], up[1]), [pair(...iiV(key, 6, 4)), pair(...iiV(key, 1, 1)), pair(...iiV(key, 9, 5))], rng),
        explain: `${pair(up[0], up[1])} glisse d’un demi-ton sur ${pair(ii, V)} : deux ii–V qui descendent par demi-tons, un classique du bebop (« Satin Doll » : Am7–D7, puis A♭m7–D♭7).`
      };
    }
    case 'spot':
    default: {
      const grid = [I, vi, ii, V];
      const tech = pick(SPOT_CHOICES, rng);
      let after: Chord[];
      let focus: number[];
      let explain: string;
      if (tech === 'SubV') {
        after = [I, vi, ii, subV];
        focus = [3];
        explain = `${sym(subV)} remplace ${sym(V)} : même triton (${tritone(V)}), basse qui descend par demi-tons vers ${sym(I)}.`;
      } else if (tech === 'Dominante secondaire') {
        const dom = { ...vi, quality: '7' };
        after = [I, dom, ii, V];
        focus = [1];
        explain = `${sym(dom)} remplace ${sym(vi)} : c’est la dominante de ${sym(ii)} (V7/II).`;
      } else if (tech === 'Diminué de passage') {
        const d = { root: raised(I.root.letter, t + 1), quality: 'dim7' };
        after = [I, d, ii, V];
        focus = [1];
        explain = `${sym(d)} remplace ${sym(vi)} : un diminué qui monte d’un demi-ton vers ${sym(ii)}.`;
      } else if (tech === 'ii–V du SubV') {
        const relSub = iiOf(subV);
        after = [I, vi, relSub, subV];
        focus = [2, 3];
        explain = `${pair(relSub, subV)} remplace ${pair(ii, V)} : le ii–V un triton plus loin.`;
      } else {
        const ivm = deg(key, 5, 3, 'm7');
        const bVII = deg(key, 10, 6, '7');
        after = [I, vi, ivm, bVII];
        focus = [2, 3];
        explain = `${pair(ivm, bVII)} remplace ${pair(ii, V)} : la cadence « backdoor », empruntée au mineur, arrive sur ${sym(I)} par un ton en dessous.`;
      }
      return {
        type: 'spot',
        key,
        before: grid,
        after,
        focus,
        prompt: 'Avant, après : quelle technique a servi ?',
        answer: tech,
        choices: shuffle([...SPOT_CHOICES], rng),
        explain
      };
    }
  }
}
