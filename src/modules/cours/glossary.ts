// Lexique : les mots du cours expliqués simplement. Dans une leçon, la première apparition de chaque mot
// est touchable et ouvre son explication (avec un exemple à écouter quand il aide).
import type { SeqVoicing } from '../../core/audio/play';

export interface Term {
  id: string;
  title: string;
  /** Formes du mot dans les textes (sans les bornes de mot, ajoutées au moment de chercher). */
  forms: string;
  text: string;
  /** Pourquoi c'est utile au piano. */
  why?: string;
  example?: { chords: string[]; romans?: string[]; label?: string; voicing?: SeqVoicing };
  /** Leçon où la notion est enseignée en détail. */
  lesson?: string;
}

export const TERMS: Term[] = [
  {
    id: 'tonalite',
    title: 'Tonalité',
    forms: 'tonalités?|centres? tonal(?:es?)?',
    text: 'La « maison » d’un morceau : une gamme, et l’accord de repos construit sur sa première note. En C majeur, tout tourne autour de C, avec les notes de la gamme de C (les touches blanches).',
    why: 'Connaître la tonalité, c’est savoir quels accords sont « chez eux » et lequel est le repos.',
    lesson: 'tonalite-3'
  },
  {
    id: 'tonique',
    title: 'Tonique',
    forms: 'toniques?',
    text: 'La première note de la gamme, et l’accord de repos qu’on construit dessus : le I. En C majeur, la tonique est C.',
    lesson: 'tonalite-3'
  },
  {
    id: 'degre',
    title: 'Degré (I, II, V…)',
    forms: 'degrés?|chiffres romains',
    text: 'La place d’une note ou d’un accord dans la gamme, en chiffres romains : I sur la 1re note, II sur la 2e… En C majeur, G est le V (5e note). Majuscule pour un accord majeur, « m » ou minuscule pour un mineur.',
    why: 'Les degrés ne dépendent pas de la tonalité : I – V – VI – IV sonne pareil en C ou en G. On apprend une fois, on joue partout.',
    lesson: 'tonalite-3'
  },
  {
    id: 'fondamentale',
    title: 'Fondamentale',
    forms: 'fondamentales?',
    text: 'La note qui donne son nom à l’accord : C dans C, Cm ou Cmaj7. On la joue souvent à la basse, à la main gauche.'
  },
  {
    id: 'tierce',
    title: 'Tierce (3ce)',
    forms: 'tierces?|3ces?',
    text: 'La note deux crans au-dessus de la fondamentale, dans la gamme : C → E. Elle décide si l’accord est **majeur** (E, 4 demi-tons) ou **mineur** (E♭, 3 demi-tons).',
    lesson: 'triades'
  },
  {
    id: 'quinte',
    title: 'Quinte (5te)',
    forms: 'quintes?|5tes?',
    text: 'La note 7 demi-tons au-dessus de la fondamentale : C → G. Elle remplit l’accord mais ne change pas sa couleur, sauf quand elle est baissée (ø7, °7).'
  },
  {
    id: 'septieme',
    title: 'Septième (7e)',
    forms: 'septièmes?|7es?',
    text: 'La note qu’on ajoute au-dessus d’un accord de 3 sons, en prenant encore une note de la gamme sur deux : C E G → **B**. Elle est soit un demi-ton sous l’octave (B : maj7), soit un ton sous l’octave (B♭ : 7, m7).',
    lesson: 'construire'
  },
  {
    id: 'ton',
    title: 'Ton, demi-ton',
    forms: 'demi-tons?',
    text: 'Le **demi-ton** est le plus petit pas du piano : d’une touche à sa voisine immédiate, blanche ou noire (E → F, C → C♯). Un **ton** = deux demi-tons (C → D).',
    lesson: 'intervalles'
  },
  {
    id: 'intervalle',
    title: 'Intervalle',
    forms: 'intervalles?',
    text: 'L’écart entre deux notes, compté en demi-tons. Son nom compte les notes : C → E, c’est C D E, 3 notes : une tierce.',
    lesson: 'intervalles'
  },
  {
    id: 'quarte',
    title: 'Quarte',
    forms: 'quartes?',
    text: 'L’écart de 5 demi-tons : C → F, D → G. « La basse monte de quarte » : D → G → C. Monter d’une quarte revient au même que descendre d’une quinte.',
    lesson: 'intervalles'
  },
  {
    id: 'renversement',
    title: 'Renversement',
    forms: 'renversements?|renversée?s?',
    text: 'Le même accord avec une autre note en bas : C E G, puis E G C, puis G C E. Ce sont toujours les notes de C.',
    why: 'En renversant, on passe d’un accord à l’autre sans sauter : la main bouge à peine.',
    example: { chords: ['C', 'F', 'G', 'C'], romans: ['I', 'IV', 'V', 'I'], label: 'C, F, G, C en renversements proches', voicing: 'triad' },
    lesson: 'triades'
  },
  {
    id: 'voicing',
    title: 'Voicing',
    forms: 'voicings?',
    text: 'La façon de disposer les notes d’un accord au piano : lesquelles on garde, dans quel ordre, à quelle hauteur. Un même Cmaj7 peut se jouer de dizaines de façons.',
    lesson: 'voicings'
  },
  {
    id: 'shell',
    title: 'Shell',
    forms: 'shells?',
    text: 'Mot anglais pour « coquille » : un accord de 4 sons réduit à **3 notes**, la fondamentale, la 3ce et la 7e. On enlève la 5te. Dm7 = D F C, G7 = G B F, Cmaj7 = C E B.',
    why: 'La 3ce dit majeur ou mineur, la 7e dit maj7, 7 ou m7 : tout l’essentiel est là. La 5te est la même dans maj7, m7 et 7, elle n’apprend rien à l’oreille. Avec 3 notes, la main gauche reste légère et laisse la place à la main droite.',
    example: { chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], label: 'En shells : fondamentale, 3ce, 7e', voicing: 'shell' },
    lesson: 'voicings'
  },
  {
    id: 'dominante',
    title: 'Dominante (V7)',
    forms: 'dominantes?',
    text: 'L’accord construit sur le V (5e degré), avec sa 7e : G7 en C majeur. C’est l’accord de **tension** : il contient la sensible (B) et le triton (B–F), qui veulent aller vers l’accord de repos, le I.',
    example: { chords: ['G7', 'Cmaj7'], romans: ['V7', 'IΔ7'], label: 'Tension → repos' },
    lesson: 'caracteres'
  },
  {
    id: 'sensible',
    title: 'Sensible',
    forms: 'sensibles?',
    text: 'La note juste sous la tonique, un demi-ton en dessous : B en C majeur, G♯ en A mineur. Elle « tire » vers la tonique. C’est la 3ce de la dominante (B dans G7).',
    lesson: 'tonalite'
  },
  {
    id: 'triton',
    title: 'Triton',
    forms: 'tritons?',
    text: 'L’écart de 3 tons (6 demi-tons) : B → F. Instable, il veut se resserrer : B monte sur C, F descend sur E. Dans G7, c’est l’écart entre la 3ce (B) et la 7e (F) : c’est lui qui donne envie d’aller au I.',
    lesson: 'intervalles'
  },
  {
    id: 'resolution',
    title: 'Résoudre, résolution',
    forms: 'résolutions?|résou(?:t|dre|ent|d)',
    text: 'Passer d’un accord de tension à un accord de repos : G7 → C. On dit que G7 « se résout » sur C.'
  },
  {
    id: 'cadence',
    title: 'Cadence',
    forms: 'cadences?',
    text: 'L’enchaînement qui termine une phrase, comme une ponctuation : V → I (point final), IV → I (l’« Amen » des chants d’église), ii–V–I (la cadence du jazz).'
  },
  {
    id: 'iiVI',
    title: 'ii–V–I',
    forms: 'ii\\s?[–-]\\s?V\\s?[–-]\\s?I|II\\s?[–-]\\s?V\\s?[–-]\\s?I|ii\\s?[–-]\\s?V',
    text: 'Trois accords qui vont au repos : IIm7 → V7 → IΔ7. En C : Dm7 → G7 → Cmaj7. La basse monte de quarte à chaque fois (D → G → C).',
    why: 'Il n’existe qu’une seule tonalité où ces trois accords sont ensemble : entendre Dm7 G7, c’est savoir que C arrive. C’est pour ça qu’un ii–V suffit à changer de tonalité (voir la leçon « Le ii–V–I majeur »).',
    example: { chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'] },
    lesson: 'iiVI'
  },
  {
    id: 'guide',
    title: 'Guide tones',
    forms: 'guide tones?',
    text: 'La 3ce et la 7e de chaque accord : les deux notes qui disent quel accord on joue. D’un accord au suivant, elles bougent d’un demi-ton ou restent en place.',
    example: { chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], voicing: 'shell' },
    lesson: 'guide-tones'
  },
  {
    id: 'armure',
    title: 'Armure',
    forms: 'armures?',
    text: 'Les dièses ou les bémols écrits au début de la portée. Ils valent pour tout le morceau et indiquent la tonalité (1 ♯ : G majeur ou E mineur).',
    lesson: 'armures'
  },
  {
    id: 'relatif',
    title: 'Relatif mineur',
    forms: 'relatifs?(?: mineurs?)?',
    text: 'Le mineur qui a la même armure (les mêmes notes) qu’un majeur : A mineur pour C majeur. On le trouve sur la 6e note de la gamme majeure, ou 1 ton ½ sous la tonique.',
    lesson: 'armures'
  },
  {
    id: 'naturel',
    title: 'Mineur naturel',
    forms: 'mineurs? naturels?',
    text: 'La gamme mineure telle quelle : les notes du majeur relatif, en partant de sa 6e note. A mineur naturel = A B C D E F G.',
    lesson: 'tonalite'
  },
  {
    id: 'harmonique',
    title: 'Mineur harmonique',
    forms: 'mineurs? harmoniques?|l’harmonique',
    text: 'Le mineur naturel avec la 7e note montée d’un demi-ton : A B C D E F **G♯**. Ce G♯ est la sensible ; il fait du V un vrai accord de dominante (E7 au lieu de Em7).',
    lesson: 'tonalite'
  },
  {
    id: 'melodique',
    title: 'Mineur mélodique',
    forms: 'mineurs? mélodiques?',
    text: 'Le mineur avec la 6e et la 7e notes montées : A B C D E **F♯ G♯**. En jazz, on y prend des couleurs : la 6te majeure de Am6, les gammes des accords altérés.',
    lesson: 'gammes'
  },
  {
    id: 'tension',
    title: 'Tensions : 9e, 11e, 13e',
    forms: '9es?|11es?|13es?|neuvièmes?|treizièmes?',
    text: 'Des notes ajoutées au-dessus de la 7e, en continuant une note de la gamme sur deux : la **9e** (la même note que la 2de : D sur C), la **11e** (= la 4te : F), la **13e** (= la 6te : A). Elles colorent l’accord sans changer son rôle. ♭9, ♯9, ♭13 : altérées, plus tendues, surtout sur les dominantes.',
    example: { chords: ['G13', 'Cmaj9'], romans: ['V13', 'IΔ9'], label: '9e et 13e' },
    lesson: 'tensions'
  },
  {
    id: 'maj7',
    title: 'maj7, Δ',
    forms: 'Δ7?',
    text: 'Accord majeur avec la 7e majeure (un demi-ton sous l’octave) : Cmaj7 = C E G B. **Δ** est une autre façon d’écrire maj7 : CΔ7 = Cmaj7.',
    lesson: 'construire'
  },
  {
    id: 'demidim',
    title: 'ø7 (demi-diminué)',
    forms: 'ø7|demi-diminués?',
    text: 'Un m7 avec la 5te baissée : Bø7 = B D F A (aussi écrit Bm7♭5). C’est l’accord du VII en majeur et du II en mineur.',
    lesson: 'construire'
  },
  {
    id: 'dim7',
    title: '°7 (diminué)',
    forms: '°7|diminués? 7',
    text: 'Trois tierces mineures empilées : B°7 = B D F A♭. Comme tout est à égale distance, il n’en existe que 3 différents. Il sert d’accord de passage.',
    lesson: 'construire'
  },
  {
    id: 'secondaire',
    title: 'Dominante secondaire',
    forms: 'dominantes? secondaires?',
    text: 'La dominante d’un autre accord que le I. En C, A7 est la dominante de Dm (A est le V de D) : elle apporte une note étrangère (C♯) qui pousse vers Dm.',
    example: { chords: ['Cmaj7', 'A7', 'Dm7', 'G7'], romans: ['IΔ7', 'V7/II', 'IIm7', 'V7'] },
    lesson: 'secondaires'
  },
  {
    id: 'subv',
    title: 'SubV (substitution tritonique)',
    forms: 'SubV|substitutions? tritoniques?',
    text: 'Remplacer un accord 7 par le 7 situé un triton plus loin : D♭7 au lieu de G7. Les deux ont la même 3ce et la même 7e (F et B), donc la même tension ; la basse descend par demi-tons (D → D♭ → C).',
    lesson: 'subv'
  },
  {
    id: 'backdoor',
    title: 'Backdoor',
    forms: 'backdoor',
    text: '« Porte de derrière » : arriver sur le I par le ♭VII7 (B♭7 → C), au lieu du V7. Un ton en dessous, une couleur plus douce, empruntée au mineur.',
    lesson: 'backdoor'
  },
  {
    id: 'turnaround',
    title: 'Turnaround',
    forms: 'turnarounds?',
    text: 'Les accords qui ramènent au début de la grille, souvent I – VI – II – V (Cmaj7 Am7 Dm7 G7).',
    lesson: 'turnarounds'
  },
  {
    id: 'emprunt',
    title: 'Emprunt',
    forms: 'emprunts?|empruntée?s?',
    text: 'Un accord pris au mineur de même tonique : en C majeur, Fm, B♭ ou A♭ viennent de C mineur. Couleur plus sombre.',
    lesson: 'backdoor'
  },
  {
    id: 'comping',
    title: 'Comping',
    forms: 'comping',
    text: 'Accompagner : jouer les accords en rythme sous la mélodie ou le soliste.',
    lesson: 'comping'
  },
  {
    id: 'rootless',
    title: 'Voicings A et B (sans fondamentale)',
    forms: 'sans fondamentale|voicings? [AB]\\b',
    text: 'Des voicings de main gauche sans la fondamentale (la contrebasse la joue) : 4 notes, 3ce, 5te, 7e, 9e. A : la 3ce en bas ; B : la 7e en bas.',
    lesson: 'voicings'
  }
];

const L = '[\\p{L}\\d]';
/** Expression de recherche d'un mot : ses formes, isolées (pas au milieu d'un autre mot ou d'un symbole). */
export const termRegex = (t: Term) => new RegExp(`(^|[^\\p{L}\\d])(${t.forms})(?!${L})`, 'iu');
const REGEX = new Map(TERMS.map((t) => [t.id, termRegex(t)]));
export const termById = (id: string) => TERMS.find((t) => t.id === id);

/** Les morceaux d'un texte : du texte, ou un mot du lexique (une seule fois par leçon : `seen`). */
export function splitTerms(text: string, seen: Set<string>): ({ text: string } | { term: Term; text: string })[] {
  const out: ({ text: string } | { term: Term; text: string })[] = [];
  let rest = text;
  for (;;) {
    let best: { term: Term; at: number; len: number } | null = null;
    for (const t of TERMS) {
      if (seen.has(t.id)) continue;
      const m = REGEX.get(t.id)!.exec(rest);
      if (!m) continue;
      const at = m.index + m[1].length;
      if (!best || at < best.at || (at === best.at && m[2].length > best.len)) best = { term: t, at, len: m[2].length };
    }
    if (!best) break;
    if (best.at) out.push({ text: rest.slice(0, best.at) });
    out.push({ term: best.term, text: rest.slice(best.at, best.at + best.len) });
    seen.add(best.term.id);
    rest = rest.slice(best.at + best.len);
  }
  if (rest) out.push({ text: rest });
  return out;
}
