// Cours : contenu des leçons (texte court, exemples à écouter, mini-quiz, lien vers l'exercice).
import { SeqVoicing } from '../../core/audio/play';
import { GROOVES, StyleId } from '../../core/rhythm/styles';

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  /** Exemples à écouter : toucher un accord le joue et l'affiche au clavier. */
  | { t: 'chords'; chords: string[]; romans?: string[]; label?: string; voicing?: SeqVoicing; gap?: number }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'tip'; text: string }
  | { t: 'quiz'; q: string; choices: string[]; answer: number; explain: string }
  | { t: 'go'; links: { href: string; label: string }[] }
  /** Un rythme en cases, à écouter (compare : en swing puis en croches droites). */
  | { t: 'rhythm'; id: string; label?: string; compare?: boolean; tempo?: number }
  /** Des styles à écouter, avec leurs indices. */
  | { t: 'grooves'; styles: StyleId[]; label?: string };

const tempoOf = (id: StyleId) => `${GROOVES[id].tempo[0]}–${GROOVES[id].tempo[1]}`;

export interface Lesson {
  id: string;
  title: string;
  sub: string;
  minutes: number;
  blocks: Block[];
}
export interface Part {
  title: string;
  lessons: Lesson[];
}

export const PARTS: Part[] = [
  {
    title: 'Débuter',
    lessons: [
      {
        id: 'triades',
        title: 'Les accords de 3 sons',
        sub: 'Majeur, mineur : la base de tout',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'Un accord de base empile **deux tierces** sur une note, la fondamentale : on obtient la fondamentale, la **tierce** et la **quinte** (1, 3, 5). C’est un accord de 3 sons, ou triade.'
          },
          {
            t: 'p',
            text: 'Il existe deux tierces : **majeure** (2 tons, C → E) et **mineure** (1 ton ½, C → E♭). Leur ordre donne le type d’accord.'
          },
          {
            t: 'table',
            head: ['Accord', 'Tierces', 'Sur C', 'Symbole'],
            rows: [
              ['Majeur', 'majeure + mineure', 'C E G', 'C'],
              ['Mineur', 'mineure + majeure', 'C E♭ G', 'Cm'],
              ['Diminué', 'mineure + mineure', 'C E♭ G♭', 'C°'],
              ['Augmenté', 'majeure + majeure', 'C E G♯', 'C+']
            ]
          },
          { t: 'chords', label: 'Touche un accord pour l’entendre et le voir', chords: ['C', 'Cm', 'Cdim', 'Caug'], gap: 1.3 },
          {
            t: 'p',
            text: '**Majeur** : clair, stable. **Mineur** : plus sombre, plus doux. Entre C et Cm, une seule note change : la tierce, E → E♭.'
          },
          { t: 'h', text: 'Les renversements' },
          {
            t: 'p',
            text: 'Les mêmes notes dans un autre ordre restent le même accord : C E G (état fondamental), E G C (1er renversement), G C E (2e). On choisit le renversement le plus proche de l’accord précédent : la main bouge à peine.'
          },
          { t: 'chords', label: 'C, F, G, C en renversements proches', chords: ['C', 'F', 'G', 'C'], romans: ['I', 'IV', 'V', 'I'], voicing: 'triad', gap: 1.2 },
          { t: 'tip', text: 'Majeur : **tierce majeure en bas**. Mineur : **tierce mineure en bas**. La quinte est la même (juste) dans les deux.' },
          {
            t: 'quiz',
            q: 'Quelles notes forment Am ?',
            choices: ['A C♯ E', 'A C E', 'A C E♭', 'A D E'],
            answer: 1,
            explain: 'A → C : tierce mineure, C → E : tierce majeure. A C E.'
          },
          {
            t: 'quiz',
            q: 'D F♯ A, c’est…',
            choices: ['D majeur', 'D mineur', 'D diminué', 'F♯ mineur'],
            answer: 0,
            explain: 'D → F♯ : tierce majeure en bas, puis tierce mineure : D majeur.'
          },
          {
            t: 'go',
            links: [
              { href: '#/oreille', label: 'Oreille › Accords, niveau 1 : majeur ou mineur ?' },
              { href: '#/flash', label: 'Voicings, niveau 1 : accords de 3 sons' }
            ]
          }
        ]
      },
      {
        id: 'tonalite-3',
        title: 'Les accords de la gamme',
        sub: 'C Dm Em F G Am B°',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'Construis un accord de 3 sons sur chaque note de la gamme de C majeur, avec seulement les notes de la gamme (les touches blanches) :'
          },
          { t: 'chords', chords: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'], romans: ['I', 'IIm', 'IIIm', 'IV', 'V', 'VIm', 'VII°'], gap: 0.9 },
          {
            t: 'p',
            text: '**3 majeurs** (I, IV, V), **3 mineurs** (II, III, VI), **1 diminué** (VII). C’est la même chose dans toutes les tonalités : en G majeur, G Am Bm C D Em F♯°.'
          },
          {
            t: 'p',
            text: 'On numérote les degrés en chiffres romains : I pour la tonique, V pour la dominante. Le chiffre dit **où** est l’accord dans la tonalité, le « m » dit qu’il est mineur.'
          },
          { t: 'tip', text: '**Majeur, mineur, mineur, majeur, majeur, mineur, diminué** : à savoir par cœur, dans l’ordre.' },
          {
            t: 'quiz',
            q: 'En F majeur, l’accord construit sur D est…',
            choices: ['D', 'Dm', 'D°', 'D7'],
            answer: 1,
            explain: 'D est le VI de F : VIm, Dm (D F A).'
          },
          {
            t: 'quiz',
            q: 'En G majeur, les trois accords majeurs sont…',
            choices: ['G, C, D', 'G, Am, D', 'G, C, Em', 'C, D, F'],
            answer: 0,
            explain: 'I, IV, V : G, C, D.'
          },
          { t: 'go', links: [{ href: '#/tonalite', label: 'Accords, niveau 1' }] }
        ]
      },
      {
        id: 'premiers',
        title: 'Premiers enchaînements',
        sub: 'I–IV–V, I–VI–IV–V, II–V–I',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'Trois accords suffisent pour des milliers de morceaux : **I, IV et V** (C, F, G en C). Le V appelle le retour au I.'
          },
          { t: 'chords', chords: ['C', 'F', 'G', 'C'], romans: ['I', 'IV', 'V', 'I'], voicing: 'triad', gap: 1.1 },
          {
            t: 'p',
            text: 'Ajoute le VIm (Am, le relatif mineur) : **I – VI – IV – V**, la boucle des années 50, ou **I – V – VI – IV**, la boucle pop.'
          },
          { t: 'chords', label: 'I – VI – IV – V', chords: ['C', 'Am', 'F', 'G'], romans: ['I', 'VIm', 'IV', 'V'], voicing: 'triad', gap: 1 },
          { t: 'chords', label: 'I – V – VI – IV', chords: ['C', 'G', 'Am', 'F'], romans: ['I', 'V', 'VIm', 'IV'], voicing: 'triad', gap: 1 },
          { t: 'h', text: 'Vers le jazz : II – V – I' },
          {
            t: 'p',
            text: 'Le jazz préfère **II – V – I** : Dm G C. La basse monte d’une quarte à chaque accord. Avec des 7es, c’est Dm7 G7 Cmaj7 : la suite des leçons.'
          },
          { t: 'chords', label: 'En 3 sons, puis avec les 7es', chords: ['Dm', 'G', 'C', 'Dm7', 'G7', 'Cmaj7'], romans: ['IIm', 'V', 'I', 'IIm7', 'V7', 'IΔ7'], gap: 1.1 },
          { t: 'tip', text: 'Écoute la basse : si elle **monte d’une quarte** d’accord en accord (D → G → C), c’est un II – V – I.' },
          {
            t: 'quiz',
            q: 'I – IV – V en F :',
            choices: ['F C G', 'F B♭ C', 'F G A', 'F A♭ C'],
            answer: 1,
            explain: 'IV = B♭, V = C dans F majeur.'
          },
          {
            t: 'quiz',
            q: 'II – V – I en G :',
            choices: ['Dm G C', 'Em A D', 'Am D G', 'Am C G'],
            answer: 2,
            explain: 'II = A (mineur), V = D, I = G.'
          },
          {
            t: 'go',
            links: [
              { href: '#/express', label: 'Enchaînements, niveau 1' },
              { href: '#/grille/debutant-1645', label: 'Morceaux : I – VI – IV – V' },
              { href: '#/grille/cycle-tri', label: 'Morceaux : II – V – I en 3 sons, 12 tonalités' }
            ]
          }
        ]
      }
    ]
  },
  {
    title: 'Les accords',
    lessons: [
      {
        id: 'construire',
        title: 'Construire un accord',
        sub: 'Tierces empilées : maj7, m7, 7, ø7, °7',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'Un accord de jazz empile des **tierces** sur une fondamentale : 1, 3, 5, 7. Il existe deux tierces : **majeure** (4 demi-tons, C → E) et **mineure** (3 demi-tons, C → E♭). L’ordre des tierces donne le type d’accord.'
          },
          {
            t: 'table',
            head: ['Accord', 'Degrés', 'Tierces', 'Sur C'],
            rows: [
              ['maj7 (Δ7)', '1 3 5 7', 'M m M', 'C E G B'],
              ['m7 (–7)', '1 ♭3 5 ♭7', 'm M m', 'C E♭ G B♭'],
              ['7', '1 3 5 ♭7', 'M m m', 'C E G B♭'],
              ['ø7 (m7♭5)', '1 ♭3 ♭5 ♭7', 'm m M', 'C E♭ G♭ B♭'],
              ['°7', '1 ♭3 ♭5 𝄫7', 'm m m', 'C E♭ G♭ B𝄫']
            ]
          },
          { t: 'chords', label: 'Touche un accord pour l’entendre et le voir', chords: ['Cmaj7', 'Cm7', 'C7', 'Cm7b5', 'Cdim7'] },
          {
            t: 'p',
            text: 'D’un accord à l’autre, une seule note bouge souvent : Cmaj7 → C7, la 7e descend d’un demi-ton ; C7 → Cm7, c’est la 3ce.'
          },
          {
            t: 'tip',
            text: 'La **3ce** dit majeur ou mineur, la **7e** dit maj7 ou 7. Ces deux notes, les **guide tones**, suffisent à reconnaître l’accord.'
          },
          {
            t: 'quiz',
            q: 'Quelles notes forment Fm7 ?',
            choices: ['F A C E♭', 'F A♭ C E♭', 'F A♭ C E', 'F A♭ B E♭'],
            answer: 1,
            explain: 'm7 = 1 ♭3 5 ♭7 : F, A♭, C, E♭.'
          },
          {
            t: 'quiz',
            q: '1 ♭3 ♭5 ♭7, c’est…',
            choices: ['°7', 'm7', 'ø7', '7♭5'],
            answer: 2,
            explain: 'Demi-diminué (m7♭5) : quinte diminuée, mais 7e mineure. Le °7 a une 7e diminuée (𝄫7).'
          },
          { t: 'go', links: [{ href: '#/oreille', label: 'Oreille › Construire : touche les notes d’un accord' }] }
        ]
      },
      {
        id: 'caracteres',
        title: 'Le caractère de chaque accord',
        sub: 'Repos, mouvement, tension',
        minutes: 4,
        blocks: [
          { t: 'h', text: 'maj7 : le repos' },
          {
            t: 'p',
            text: 'Stable et lumineux : c’est le I et le IV du majeur. La 7e majeure frotte doucement contre l’octave. Sur un thème, on le remplace souvent par **6** (C6) pour éviter le frottement avec la mélodie.'
          },
          { t: 'h', text: 'm7 : le mouvement' },
          {
            t: 'p',
            text: 'Doux, sans urgence. Le plus souvent un **II** qui prépare un V (Dm7 → G7), mais aussi III et VI. En jazz modal, un m7 peut tenir 8 mesures (So What).'
          },
          { t: 'h', text: '7 : la tension' },
          {
            t: 'p',
            text: 'Entre la 3ce et la 7e d’un accord 7, il y a un **triton** (3 tons) : B–F dans G7. Il veut se résoudre par demi-ton : B monte sur C, F descend sur E. C’est le moteur de toute l’harmonie tonale.'
          },
          { t: 'chords', label: 'Tension → repos', chords: ['G7', 'Cmaj7'], romans: ['V7', 'IΔ7'], gap: 1.6 },
          { t: 'h', text: 'ø7 et °7 : l’instabilité' },
          {
            t: 'p',
            text: '**ø7** est le II du mineur (Dø7 → G7 → Cm). **°7** empile trois tierces mineures : il est symétrique, ses renversements sont identiques, donc il n’existe que **3** accords °7 différents. Il sert d’accord de passage (Cmaj7 C♯°7 Dm7) ou de dominante sans fondamentale : B°7 = G7♭9 sans le G.'
          },
          { t: 'chords', label: 'Accord de passage', chords: ['Cmaj7', 'C#dim7', 'Dm7', 'G7'], romans: ['IΔ7', '♯I°7', 'IIm7', 'V7'] },
          { t: 'tip', text: 'Repos : maj7, 6, m6. Mouvement : m7. Tension : 7, ø7, °7.' },
          {
            t: 'quiz',
            q: 'Quel accord contient un triton entre sa 3ce et sa 7e ?',
            choices: ['maj7', 'm7', '7', 'm6'],
            answer: 2,
            explain: 'Dans un 7, 3ce et ♭7 sont à 6 demi-tons : B et F dans G7.'
          },
          {
            t: 'quiz',
            q: 'Combien d’accords °7 différents existe-t-il ?',
            choices: ['12', '6', '4', '3'],
            answer: 3,
            explain: 'C°7 = E♭°7 = G♭°7 = A°7 (mêmes notes). Il reste C°7, C♯°7 et D°7.'
          },
          { t: 'go', links: [{ href: '#/oreille', label: 'Oreille › Accords : reconnaître maj7, m7, 7, ø7, °7' }] }
        ]
      },
      {
        id: 'tonalite',
        title: 'Les accords de la tonalité',
        sub: 'Harmoniser la gamme majeure et mineure',
        minutes: 5,
        blocks: [
          {
            t: 'p',
            text: 'Si on construit un accord de 4 sons sur chaque note de la gamme majeure, en restant dans la gamme, on obtient toujours la même suite :'
          },
          {
            t: 'chords',
            chords: ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5'],
            romans: ['IΔ7', 'IIm7', 'IIIm7', 'IVΔ7', 'V7', 'VIm7', 'VIIø7'],
            gap: 0.9
          },
          {
            t: 'p',
            text: 'Une seule dominante (**V7**), un seul **ø7** (VII), deux maj7 (I et IV), trois m7 (II, III, VI). C’est vrai dans les 12 tonalités : en D, F♯ est le III, donc F♯m7.'
          },
          { t: 'h', text: 'En mineur' },
          {
            t: 'p',
            text: 'Le jazz mélange le mineur naturel et le mineur harmonique : le V prend la **sensible** (G♯ en A mineur) pour devenir V7. Le I se joue souvent m6 ou m(maj7).'
          },
          {
            t: 'chords',
            chords: ['Am7', 'Bm7b5', 'Cmaj7', 'Dm7', 'E7', 'Fmaj7', 'G7', 'G#dim7'],
            romans: ['Im7', 'IIø7', '♭IIIΔ7', 'IVm7', 'V7', '♭VIΔ7', '♭VII7', 'VII°7'],
            gap: 0.9
          },
          { t: 'tip', text: 'Majeur : **Δ7 m7 m7 Δ7 7 m7 ø7**. Mineur : **m7 ø7 Δ7 m7 7 Δ7 7**, et °7 sur la sensible.' },
          {
            t: 'quiz',
            q: 'En B♭ majeur, quel accord se construit sur G ?',
            choices: ['Gmaj7', 'G7', 'Gm7', 'Gø7'],
            answer: 2,
            explain: 'G est le VI de B♭ : VIm7, Gm7.'
          },
          {
            t: 'quiz',
            q: 'En E mineur, quel accord se construit sur B ?',
            choices: ['Bm7', 'B7', 'Bø7', 'Bmaj7'],
            answer: 1,
            explain: 'B est le V : en mineur, le V prend la sensible (D♯) et devient B7.'
          },
          { t: 'go', links: [{ href: '#/tonalite', label: 'Accords, niveaux 2 à 5' }] }
        ]
      }
    ]
  },
  {
    title: 'Les enchaînements',
    lessons: [
      {
        id: 'iiVI',
        title: 'Le ii–V–I majeur',
        sub: 'La cadence du jazz',
        minutes: 5,
        blocks: [
          {
            t: 'p',
            text: 'IIm7 – V7 – IΔ7. Les fondamentales montent de quarte (ou descendent de quinte) : D → G → C. C’est l’enchaînement le plus fréquent du jazz : souvent plusieurs par grille, chacun dans une tonalité.'
          },
          { t: 'chords', chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], gap: 1.4 },
          { t: 'h', text: 'Les guide tones' },
          {
            t: 'p',
            text: 'À chaque accord, la **7e descend d’un demi-ton** sur la 3ce du suivant, et la **3ce reste** pour devenir la 7e. Dm7 (F, C) → G7 (F, B) → Cmaj7 (E, B). Joue seulement ces deux notes : l’enchaînement s’entend déjà.'
          },
          { t: 'chords', label: 'En shells (fondamentale, 3ce, 7e)', chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], voicing: 'shell', gap: 1.4 },
          { t: 'h', text: 'Dans les standards' },
          {
            t: 'p',
            text: 'Le ii–V sert à **changer de tonalité** : Autumn Leaves alterne B♭ et G mineur, All the Things You Are passe par A♭, C, E♭, G et E. Chaque ii–V annonce le prochain centre tonal.'
          },
          { t: 'tip', text: 'Un **m7 suivi d’un 7 une quarte plus haut** = un ii–V. Cherche ensuite où il résout.' },
          {
            t: 'quiz',
            q: 'Le ii–V–I en F, c’est…',
            choices: ['Dm7 G7 Fmaj7', 'Gm7 C7 F7', 'Gm7 C7 Fmaj7', 'Am7 D7 Gmaj7'],
            answer: 2,
            explain: 'II = G, V = C dans F majeur : Gm7 C7 Fmaj7.'
          },
          {
            t: 'quiz',
            q: 'Dans Dm7 → G7, où va la 7e de Dm7 (C) ?',
            choices: ['Sur B, la 3ce de G7', 'Sur D, la 5te de G7', 'Elle reste : C', 'Sur F, la 7e de G7'],
            answer: 0,
            explain: 'C descend d’un demi-ton sur B, la 3ce de G7. F (3ce de Dm7) reste et devient la 7e de G7.'
          },
          {
            t: 'go',
            links: [
              { href: '#/grille/cycle-maj', label: 'Morceaux : ii–V–I dans les 12 tonalités' },
              { href: '#/flash', label: 'Voicings, niveau 2 (shell) : ii–V–I' }
            ]
          }
        ]
      },
      {
        id: 'iiVim',
        title: 'Le ii–V–i mineur',
        sub: 'ø7, 7♭9, m6',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'En mineur : **IIø7 – V7♭9 – Im6** (ou Im7, Im(maj7)). En C mineur : Dø7 – G7♭9 – Cm6.'
          },
          { t: 'chords', chords: ['Dm7b5', 'G7b9', 'Cm6'], romans: ['IIø7', 'V7♭9', 'Im6'], gap: 1.4 },
          {
            t: 'p',
            text: 'Dø7 et G7♭9 viennent de C mineur harmonique. Le ♭9 de G7 (A♭) est la ♭6 de la tonalité : c’est aussi la ♭5 de Dø7, qui reste d’un accord à l’autre. Le Cm6 prend la 6te majeure (A) du mineur mélodique.'
          },
          {
            t: 'p',
            text: 'Autumn Leaves alterne les deux cadences dans la même armure : Cm7 F7 B♭maj7 (majeur), puis Aø7 D7♭9 Gm6 (relatif mineur).'
          },
          { t: 'chords', label: 'Autumn Leaves, mesures 1 à 8', chords: ['Cm7', 'F7', 'Bbmaj7', 'Ebmaj7', 'Am7b5', 'D7b9', 'Gm6'], romans: ['IIm7', 'V7', 'IΔ7', 'IVΔ7', 'IIø7', 'V7♭9', 'Im6'], gap: 1 },
          { t: 'tip', text: '**ø7 → 7♭9 → m6** : dès que tu vois un ø7, un mineur arrive.' },
          {
            t: 'quiz',
            q: 'Le ii–V–i en A mineur, c’est…',
            choices: ['Bm7 E7 Am7', 'Bø7 E7♭9 Am6', 'Bø7 E7 Amaj7', 'Eø7 A7♭9 Dm6'],
            answer: 1,
            explain: 'II = B (ø7), V = E (7♭9), I = A mineur.'
          },
          {
            t: 'quiz',
            q: 'Pourquoi joue-t-on ♭9 sur le V d’un ii–V–i mineur ?',
            choices: ['Pour faire « blues »', 'C’est la ♭6 de la tonalité mineure', 'Pour éviter la 3ce', 'C’est une note d’approche'],
            answer: 1,
            explain: 'En C mineur, A♭ (♭6) est la ♭9 de G7 : la gamme du morceau la donne.'
          },
          { t: 'go', links: [{ href: '#/grille/cycle-min', label: 'Morceaux : ii–V–i mineur dans les 12 tonalités' }, { href: '#/grille/autumn-leaves', label: 'Morceaux : Autumn Leaves' }] }
        ]
      },
      {
        id: 'turnarounds',
        title: 'Les turnarounds',
        sub: 'I – VI – II – V et ses variantes',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'Un turnaround ramène au I en fin de grille ou de section, en deux mesures. La base : **I – VI – II – V**, que des quartes à partir du VI.'
          },
          { t: 'chords', chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'], romans: ['IΔ7', 'VIm7', 'IIm7', 'V7'], gap: 0.9 },
          { t: 'h', text: 'Variantes' },
          { t: 'chords', label: 'Le VI devient dominante (V7/II)', chords: ['Cmaj7', 'A7', 'Dm7', 'G7'], romans: ['IΔ7', 'V7/II', 'IIm7', 'V7'], gap: 0.9 },
          { t: 'chords', label: 'Le III remplace le I', chords: ['Em7', 'A7', 'Dm7', 'G7'], romans: ['IIIm7', 'V7/II', 'IIm7', 'V7'], gap: 0.9 },
          { t: 'chords', label: 'Avec substitutions tritoniques', chords: ['Cmaj7', 'Eb7', 'Dm7', 'Db7'], romans: ['IΔ7', 'SubV/II', 'IIm7', 'SubV'], gap: 0.9 },
          {
            t: 'p',
            text: 'Dans les rhythm changes, le turnaround tourne en boucle sur les mesures 1–2 et 3–4 : B♭6 G7 Cm7 F7.'
          },
          { t: 'tip', text: 'Deux dernières mesures d’une grille, quatre accords qui descendent par quintes : turnaround.' },
          {
            t: 'quiz',
            q: 'I – VI – II – V en F :',
            choices: ['Fmaj7 Dm7 Gm7 C7', 'Fmaj7 Am7 Dm7 G7', 'Fmaj7 Dm7 Em7 A7', 'Fmaj7 Gm7 Am7 B♭maj7'],
            answer: 0,
            explain: 'VI = D, II = G, V = C dans F.'
          },
          { t: 'go', links: [{ href: '#/grille/rhythm-changes', label: 'Morceaux : Rhythm changes en B♭' }, { href: '#/express', label: 'Enchaînements, niveau 2' }] }
        ]
      },
      {
        id: 'secondaires',
        title: 'Les dominantes secondaires',
        sub: 'V7/II, V7/V, V7/VI…',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'Chaque accord de la tonalité peut être précédé de **sa propre dominante**, une quarte en dessous. On l’écrit V7/X : « V de X ».'
          },
          {
            t: 'table',
            head: ['En C', 'Vise', 'Note étrangère'],
            rows: [
              ['A7 = V7/II', 'Dm7', 'C♯'],
              ['B7 = V7/III', 'Em7', 'D♯, F♯'],
              ['C7 = V7/IV', 'Fmaj7', 'B♭'],
              ['D7 = V7/V', 'G7', 'F♯'],
              ['E7 = V7/VI', 'Am7', 'G♯']
            ]
          },
          {
            t: 'p',
            text: 'Indice : un accord **7 ailleurs que sur le V**. Sa 3ce est la sensible de l’accord visé, souvent une note étrangère à la tonalité : C♯ dans A7 monte sur D.'
          },
          { t: 'chords', chords: ['Cmaj7', 'E7', 'Am7', 'D7', 'Dm7', 'G7', 'Cmaj7'], romans: ['IΔ7', 'V7/VI', 'VIm7', 'V7/V', 'IIm7', 'V7', 'IΔ7'], gap: 1 },
          {
            t: 'p',
            text: 'Enchaînées, elles forment des **dominantes en cascade** : D7 G7 C7 F7 dans le pont des rhythm changes, ou E7 A7 D7 G7 vers C.'
          },
          { t: 'chords', label: 'Cascade', chords: ['E7', 'A7', 'D7', 'G7', 'Cmaj7'], gap: 1 },
          {
            t: 'quiz',
            q: 'En C, D7 est…',
            choices: ['V7/II', 'V7/V', 'V7/IV', 'SubV'],
            answer: 1,
            explain: 'D7 résout sur G : V de V.'
          },
          {
            t: 'quiz',
            q: 'Quel accord prépare Em7 en C ?',
            choices: ['B7', 'E7', 'A7', 'F7'],
            answer: 0,
            explain: 'La dominante de E est B : B7 = V7/III.'
          },
          { t: 'go', links: [{ href: '#/express', label: 'Enchaînements, niveau 4' }, { href: '#/grille/a-train', label: 'Morceaux : Take the A Train (V7/V)' }] }
        ]
      },
      {
        id: 'subv',
        title: 'La substitution tritonique',
        sub: 'SubV : D♭7 à la place de G7',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'G7 et D♭7 ont le **même triton** : B–F dans G7, F–C♭ (= B) dans D♭7. Ils se résolvent donc pareil. On remplace un V7 par la dominante située un triton plus loin : le **SubV**.'
          },
          { t: 'chords', label: 'Version normale', chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], gap: 1.3 },
          { t: 'chords', label: 'Avec SubV : la basse descend par demi-tons', chords: ['Dm7', 'Db7', 'Cmaj7'], romans: ['IIm7', 'SubV', 'IΔ7'], gap: 1.3 },
          {
            t: 'p',
            text: 'Pour improviser sur D♭7 en SubV, joue **lydien ♭7** (D♭ E♭ F G A♭ B♭ C♭). Ce sont les mêmes notes que la gamme altérée de G.'
          },
          { t: 'tip', text: 'Un **7 qui descend d’un demi-ton** sur sa résolution = SubV.' },
          {
            t: 'quiz',
            q: 'Le SubV de D7, c’est…',
            choices: ['G7', 'A7', 'A♭7', 'E♭7'],
            answer: 2,
            explain: 'Un triton au-dessus de D : A♭. A♭7 résout sur G par demi-ton.'
          },
          {
            t: 'quiz',
            q: 'Quelles notes G7 et D♭7 ont-elles en commun ?',
            choices: ['G et D♭', 'B (C♭) et F', 'D et A♭', 'Aucune'],
            answer: 1,
            explain: 'Le triton 3ce–7e : B–F pour G7, F–C♭ pour D♭7.'
          },
          { t: 'go', links: [{ href: '#/express', label: 'Enchaînements, niveau 4' }] }
        ]
      },
      {
        id: 'backdoor',
        title: 'Backdoor et emprunts au mineur',
        sub: 'IVm7, ♭VII7',
        minutes: 3,
        blocks: [
          {
            t: 'p',
            text: 'Un morceau majeur peut **emprunter** des accords au mineur de même tonique : IVm7 (ou IVm6), ♭VII7, ♭VIΔ7. Couleur plus sombre, mélancolique.'
          },
          { t: 'chords', label: 'IV puis IV mineur', chords: ['Fmaj7', 'Fm6', 'Cmaj7'], romans: ['IVΔ7', 'IVm6', 'IΔ7'], gap: 1.3 },
          {
            t: 'p',
            text: 'La **cadence backdoor** : IVm7 – ♭VII7 – IΔ7 (Fm7 B♭7 Cmaj7). B♭7 arrive sur C par un ton : ce n’est ni un V ni un SubV. On l’entend dans Lady Bird.'
          },
          { t: 'chords', chords: ['Fm7', 'Bb7', 'Cmaj7'], romans: ['IVm7', '♭VII7', 'IΔ7'], gap: 1.3 },
          { t: 'tip', text: 'Un **accord mineur sur le IV** d’un morceau majeur = emprunt. Un 7 un ton sous le I = backdoor.' },
          {
            t: 'quiz',
            q: 'La cadence backdoor vers G, c’est…',
            choices: ['Am7 D7 Gmaj7', 'Cm7 F7 Gmaj7', 'Cmaj7 F7 Gmaj7', 'A♭7 Gmaj7'],
            answer: 1,
            explain: 'IVm7 = Cm7, ♭VII7 = F7, puis Gmaj7.'
          },
          { t: 'go', links: [{ href: '#/express', label: 'Enchaînements, niveau 4' }] }
        ]
      },
      {
        id: 'blues',
        title: 'Le blues jazz',
        sub: '12 mesures, que des 7',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: '12 mesures en trois phrases de 4. Le I et le IV sont des **accords 7** : ce ne sont pas des dominantes qui résolvent, c’est la couleur blues.'
          },
          {
            t: 'table',
            head: ['Mesures', 'Blues en F', 'Ce qui se passe'],
            rows: [
              ['1–4', 'F7 | B♭7 | F7 | Cm7 F7', 'IV en mesure 2 ; ii–V vers le IV en 4'],
              ['5–8', 'B♭7 | B°7 | F7 | Am7 D7', '°7 de passage ; ii–V vers Gm'],
              ['9–12', 'Gm7 | C7 | F7 D7 | Gm7 C7', 'ii–V–I, puis turnaround']
            ]
          },
          { t: 'chords', label: 'Les 4 premières mesures', chords: ['F7', 'Bb7', 'F7', 'Cm7', 'F7'], gap: 1 },
          { t: 'chords', label: 'Les 4 dernières', chords: ['Gm7', 'C7', 'F7', 'D7', 'Gm7', 'C7'], gap: 1 },
          {
            t: 'p',
            text: 'Variantes : blues mineur (Cm7 Fm7 A♭7 G7), blues Bird (Parker) avec des ii–V à chaque mesure.'
          },
          {
            t: 'quiz',
            q: 'Mesure 5 d’un blues en F :',
            choices: ['F7', 'C7', 'B♭7', 'Gm7'],
            answer: 2,
            explain: 'Début de la 2e phrase : le IV7.'
          },
          {
            t: 'go',
            links: [
              { href: '#/grille/blues-f', label: 'Morceaux : Blues en F' },
              { href: '#/grille/blues-mineur', label: 'Morceaux : Blues mineur' },
              { href: '#/grille/blues-bird', label: 'Morceaux : Blues Bird' }
            ]
          }
        ]
      }
    ]
  },
  {
    title: 'Au clavier',
    lessons: [
      {
        id: 'voicings',
        title: 'Voicings main gauche',
        sub: 'Shells, sans fondamentale A et B',
        minutes: 5,
        blocks: [
          {
            t: 'p',
            text: 'Un voicing, c’est le choix et l’ordre des notes jouées. En jazz, on ne joue presque jamais 1-3-5-7 serré : on garde ce qui compte.'
          },
          { t: 'h', text: 'Shell : 1, 3, 7' },
          {
            t: 'p',
            text: 'Fondamentale + guide tones. Idéal en solo ou sans contrebasse. Dans les graves (sous A2), écarte : 1-7-10 au lieu de 1-3-7.'
          },
          { t: 'chords', chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], voicing: 'shell', gap: 1.3 },
          { t: 'h', text: 'Sans fondamentale : A et B' },
          {
            t: 'p',
            text: 'Avec une contrebasse, on laisse la fondamentale et on ajoute la 9 (et la 13 sur les dominantes). **Type A** : 3ce en bas (3-5-7-9). **Type B** : 7e en bas (7-9-3-5).'
          },
          { t: 'chords', label: 'Type A', chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], voicing: 'A', gap: 1.3 },
          { t: 'chords', label: 'Type B', chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], voicing: 'B', gap: 1.3 },
          { t: 'chords', label: 'A, B, A : le bon enchaînement', chords: ['Dm7', 'G7', 'Cmaj7'], romans: ['IIm7', 'V7', 'IΔ7'], voicing: ['A', 'B', 'A'], gap: 1.3 },
          {
            t: 'p',
            text: 'Dans un ii–V–I, **alterne** A et B : Dm7 (A) → G7 (B) → Cmaj7 (A). Chaque voix bouge d’un ton au plus.'
          },
          { t: 'tip', text: 'Zone idéale : la note grave du voicing entre C3 et C4. Plus bas, ça devient boueux.' },
          {
            t: 'quiz',
            q: 'Type A de Cmaj7 (3ce en bas) :',
            choices: ['C E G B', 'E G B D', 'B D E G', 'E B D G'],
            answer: 1,
            explain: '3-5-7-9 : E G B D.'
          },
          { t: 'go', links: [{ href: '#/flash', label: 'Voicings, niveaux 2 à 4 : shell, A et B, avec le micro' }] }
        ]
      },
      {
        id: 'tensions',
        title: 'Les tensions : 9, 11, 13',
        sub: 'Ce qu’on ajoute, ce qu’on évite',
        minutes: 5,
        blocks: [
          {
            t: 'p',
            text: 'Au-dessus de la 7e, on continue d’empiler des tierces : **9, 11, 13** (les 2, 4 et 6, une octave plus haut). Elles colorent l’accord ; la fondamentale et la 5te peuvent alors sauter.'
          },
          {
            t: 'table',
            head: ['Accord', 'Tensions', 'À éviter'],
            rows: [
              ['maj7', '9, ♯11, 13', '11 (frotte avec la 3ce)'],
              ['m7', '9, 11 ; 13 sur un II', '♭13 sur un II'],
              ['7 vers majeur', '9, 13 (♯11)', '11'],
              ['7 vers mineur', '♭9, ♭13 (♯9)', '9, 13'],
              ['ø7', '11, ♭13 (9 en locrien ♮2)', '♭9'],
              ['°7', 'un ton au-dessus de chaque note', '—']
            ]
          },
          { t: 'chords', label: 'Dominante vers majeur : 9 et 13', chords: ['G13', 'Cmaj9'], romans: ['V13', 'IΔ9'], gap: 1.6 },
          { t: 'chords', label: 'Dominante vers mineur : ♭9 et ♭13', chords: ['G7b9b13', 'Cm6'], romans: ['V7♭9♭13', 'Im6'], gap: 1.6 },
          { t: 'tip', text: 'Le V **résout sur du majeur** : tensions naturelles. **Sur du mineur** : tensions bémolisées.' },
          {
            t: 'quiz',
            q: 'G7 qui résout sur Cm : 9 ou ♭9 ?',
            choices: ['9 (A)', '♭9 (A♭)'],
            answer: 1,
            explain: 'A♭ appartient à C mineur.'
          },
          {
            t: 'quiz',
            q: 'Quelle tension éviter sur Cmaj7 ?',
            choices: ['9 (D)', '11 (F)', '♯11 (F♯)', '13 (A)'],
            answer: 1,
            explain: 'F est un demi-ton au-dessus de E (la 3ce) : il brouille l’accord.'
          },
          { t: 'go', links: [{ href: '#/express', label: 'Enchaînements, niveau 3 : 9 ou ♭9' }] }
        ]
      },
      {
        id: 'gammes',
        title: 'Une gamme par accord',
        sub: 'Dorien, mixolydien, altérée…',
        minutes: 5,
        blocks: [
          {
            t: 'p',
            text: 'Une gamme d’improvisation = **l’accord + les tensions qui lui vont**. Sur chaque accord, vise ses notes (1, 3, 5, 7) sur les temps forts ; les autres notes de la gamme servent de passage.'
          },
          {
            t: 'table',
            head: ['Accord', 'Gamme', 'Sur C'],
            rows: [
              ['maj7 (I)', 'ionien (ou lydien)', 'C D E F G A B'],
              ['maj7 (IV)', 'lydien', 'C D E F♯ G A B'],
              ['m7 (II)', 'dorien', 'C D E♭ F G A B♭'],
              ['7 vers majeur', 'mixolydien', 'C D E F G A B♭'],
              ['7 vers mineur', 'mixolydien ♭9 ♭13', 'C D♭ E F G A♭ B♭'],
              ['7alt', 'altérée', 'C D♭ D♯ E F♯ G♯ B♭'],
              ['ø7', 'locrien', 'C D♭ E♭ F G♭ A♭ B♭'],
              ['°7', 'diminuée ton/demi-ton', 'C D E♭ F G♭ A♭ A B']
            ]
          },
          {
            t: 'p',
            text: 'Sur un ii–V–I en C, dorien de D, mixolydien de G et ionien de C sont **la même gamme** (les touches blanches) : seul le point d’appui change. Ce qui compte, ce sont les notes de l’accord sur les temps forts.'
          },
          { t: 'tip', text: 'Commence par les guide tones sur le 1er temps de chaque accord, puis remplis avec la gamme.' },
          {
            t: 'quiz',
            q: 'Gamme pour Dm7 dans un ii–V–I en C :',
            choices: ['D éolien', 'D dorien', 'D phrygien', 'D mineur harmonique'],
            answer: 1,
            explain: 'Le II d’une tonalité majeure : dorien (D E F G A B C).'
          },
          { t: 'go', links: [{ href: '#/grille/autumn-leaves', label: 'Morceaux : Autumn Leaves, vue Gammes, avec le micro' }] }
        ]
      }
    ]
  },
  {
    title: 'Le rythme',
    lessons: [
      {
        id: 'swing',
        title: 'Le swing',
        sub: 'Croches ternaires, 2 et 4',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'En jazz, deux croches ne durent pas pareil : la 1re est **longue**, la 2e **courte**, à peu près ⅔ – ⅓ du temps. C’est un triolet dont on lie les deux premières notes : « dou-ba, dou-ba ». C’est le **swing**.'
          },
          { t: 'rhythm', id: 'c-all', label: 'Les mêmes croches, en swing puis droites', compare: true },
          {
            t: 'table',
            head: ['Croches', 'Longue / courte', 'Où'],
            rows: [
              ['Droites (binaire)', '50 / 50', 'bossa, samba, latin, funk'],
              ['Swing, tempo moyen', '67 / 33', 'swing, ballade, valse jazz'],
              ['Swing, plus de 200 BPM', '≈ 60 / 40', 'le swing se resserre en allant vite']
            ]
          },
          { t: 'h', text: 'Le 2 et le 4' },
          {
            t: 'p',
            text: 'En swing, la batterie ferme le charleston sur **2 et 4**, et le public claque des doigts sur 2 et 4. La contrebasse, elle, joue les 4 temps. Taper sur 1 et 3 sonne « fanfare ».'
          },
          { t: 'rhythm', id: 'n-24', label: '2 et 4, sur la ride' },
          { t: 'tip', text: 'Règle le métronome pour qu’il ne clique que sur 2 et 4 : à 60 sur le métronome, tu joues à 120 BPM. Tu sens le 1 toi-même, comme avec un batteur.' },
          {
            t: 'quiz',
            q: 'En swing, la 2e croche du temps (le « et ») tombe :',
            choices: ['Au milieu du temps', 'Aux ⅔ du temps (la 3e note du triolet)', 'Au ¼ du temps', 'Sur le temps suivant'],
            answer: 1,
            explain: 'Longue-courte : ⅔ puis ⅓ du temps. Au milieu, ce sont des croches droites (bossa, funk).'
          },
          {
            t: 'quiz',
            q: 'Morceau à 160 BPM, métronome sur 2 et 4 seulement : on le règle à…',
            choices: ['40', '80', '160', '320'],
            answer: 1,
            explain: '2 clics par mesure de 4 temps : la moitié du tempo, 80.'
          },
          { t: 'go', links: [{ href: '#/rythme/tempo/2', label: 'Rythme › Tenir le tempo, niveau 2 (sur 2 et 4)' }] }
        ]
      },
      {
        id: 'comping',
        title: 'Placer ses accords',
        sub: 'Charleston, contretemps, anticipation',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'Accompagner (« comper »), ce n’est pas jouer l’accord sur chaque temps. Peu d’attaques, **courtes**, bien placées, souvent sur les **contretemps** (les « et ») : le piano répond à la batterie et laisse de la place au soliste.'
          },
          { t: 'rhythm', id: 's-charleston', label: 'Le Charleston : 1, puis le « et » de 2' },
          { t: 'p', text: 'Le **Charleston** est le rythme de comping le plus joué. Variante : seulement le « et » de 2, plus léger.' },
          { t: 'rhythm', id: 's-24e', label: 'Les contretemps de 2 et de 4' },
          { t: 'h', text: 'L’anticipation' },
          {
            t: 'p',
            text: 'L’accord de la mesure suivante arrive **une croche plus tôt**, sur le « et » de 4, et on le tient sur le 1. Ça donne de l’élan à la grille : très typique du jazz (et de la bossa).'
          },
          { t: 'rhythm', id: 'p-ant4', label: 'Mesure 1 : le 1, puis l’accord suivant sur le « et » de 4' },
          { t: 'rhythm', id: 'p-charl-ant', label: 'Charleston, puis anticipation' },
          { t: 'tip', text: 'Accords courts sur les contretemps, longs sur les anticipations. Et de l’espace : une mesure sans rien jouer, c’est aussi du comping.' },
          {
            t: 'quiz',
            q: 'Le Charleston, c’est :',
            choices: ['1 et 3', '1 et le « et » de 2', '2 et 4', 'Le « et » de 4'],
            answer: 1,
            explain: 'Le 1, puis le contretemps de 2 : « TA – ta », la 2e attaque juste avant le 3.'
          },
          {
            t: 'quiz',
            q: 'Une anticipation de l’accord de la mesure 2 se joue :',
            choices: ['Sur le 1 de la mesure 2', 'Sur le « et » de 4 de la mesure 1', 'Sur le 4 de la mesure 1', 'Sur le 2 de la mesure 2'],
            answer: 1,
            explain: 'Une croche avant la barre de mesure, puis tenu sur le 1 : le changement d’accord arrive en avance.'
          },
          {
            t: 'go',
            links: [
              { href: '#/rythme/taper/3', label: 'Rythme › Lire et taper, niveaux 3 et 4' },
              { href: '#/grille/autumn-leaves', label: 'Morceaux : Autumn Leaves, comper en Charleston' }
            ]
          }
        ]
      },
      {
        id: 'styles',
        title: 'Reconnaître les styles',
        sub: 'Swing, ballade, valse, bossa, samba, latin, funk',
        minutes: 5,
        blocks: [
          {
            t: 'p',
            text: 'Un style se reconnaît d’abord à la **batterie** et à la **basse** : croches ternaires ou droites, ce qui marque le 2 et le 4, le jeu de la basse. Écoute chaque style et suis les indices.'
          },
          { t: 'grooves', styles: ['swing', 'ballade', 'valse'], label: 'Ternaire (swing)' },
          { t: 'grooves', styles: ['bossa', 'samba', 'latin', 'funk'], label: 'Binaire (croches droites)' },
          {
            t: 'table',
            head: ['Style', 'Croches', 'BPM', 'Signe distinctif'],
            rows: [
              ['Swing', 'ternaires', tempoOf('swing'), 'ride « ding, ding-ga ding », walking bass'],
              ['Ballade', 'ternaires', tempoOf('ballade'), 'balais, basse sur 1 et 3, accords tenus'],
              ['Valse jazz', 'ternaires', tempoOf('valse'), '3 temps : « UN deux trois »'],
              ['Bossa nova', 'droites', tempoOf('bossa'), 'clave au bord de la caisse, basse 1 et 3'],
              ['Samba', 'droites', tempoOf('samba'), 'rapide, surdo sur 2 et 4, shaker continu'],
              ['Afro-cubain', 'droites', tempoOf('latin'), 'clave, cloche, basse tumbao'],
              ['Funk', 'doubles droites', tempoOf('funk'), 'caisse claire forte sur 2 et 4']
            ]
          },
          {
            t: 'tip',
            text: 'Bossa ou samba ? Même famille brésilienne : la bossa est **lente et feutrée** (bord de caisse, guitare), la samba **rapide et percussive** (surdo, shaker). Ternaire ou binaire ? Écoute la cymbale : « longue-courte » = swing.'
          },
          {
            t: 'quiz',
            q: 'Croches droites, tempo modéré, coups au bord de la caisse claire sur un motif de 2 mesures :',
            choices: ['Swing', 'Bossa nova', 'Samba', 'Funk'],
            answer: 1,
            explain: 'Le cross-stick en clave de bossa, les croches droites et le tempo modéré : bossa nova.'
          },
          {
            t: 'quiz',
            q: 'Cymbale « ding, ding-ga ding », charleston sur 2 et 4, contrebasse sur chaque temps :',
            choices: ['Funk', 'Afro-cubain', 'Swing', 'Valse jazz'],
            answer: 2,
            explain: 'Ride ternaire, 2 et 4 et walking bass : le swing à 4 temps (en valse, 3 temps par mesure).'
          },
          {
            t: 'go',
            links: [
              { href: '#/rythme/style', label: 'Rythme › Reconnaître un style' },
              { href: '#/grilles', label: 'Morceaux : change le style dans les réglages du play-along' }
            ]
          }
        ]
      },
      {
        id: 'clave',
        title: 'La clave',
        sub: 'Son, rumba, bossa : le motif qui organise tout',
        minutes: 4,
        blocks: [
          {
            t: 'p',
            text: 'Dans la musique afro-cubaine, tout s’organise autour de la **clave** : 5 coups sur 2 mesures, joués par deux bâtons de bois. Une mesure à **3 coups**, une à **2 coups**. Personne n’est obligé de la jouer, mais tout le monde la sent.'
          },
          { t: 'rhythm', id: 'k-son32', label: 'Clave de son 3-2', tempo: 100 },
          { t: 'rhythm', id: 'k-son23', label: 'Clave de son 2-3 : les deux mesures inversées', tempo: 100 },
          {
            t: 'p',
            text: 'Le sens (3-2 ou 2-3) dépend de la mélodie et ne change pas pendant le morceau. La **rumba** décale le 3e coup sur le « et » de 4 : plus tendue.'
          },
          { t: 'rhythm', id: 'k-rumba32', label: 'Clave de rumba 3-2', tempo: 100 },
          { t: 'h', text: 'La clave de bossa' },
          { t: 'p', text: 'La bossa nova a la sienne, jouée au bord de la caisse claire : comme le son 3-2, mais le dernier coup glisse sur le « et » de 3.' },
          { t: 'rhythm', id: 'k-bossa', label: 'Clave de bossa nova', tempo: 120 },
          { t: 'grooves', styles: ['latin', 'bossa'], label: 'Dans le contexte : afro-cubain, puis bossa' },
          {
            t: 'quiz',
            q: 'Clave de son 3-2, la mesure à 3 coups :',
            choices: ['1, « et » de 2, 4', '2, 3', '1, 2, 3', '« Et » de 1, 3, 4'],
            answer: 0,
            explain: '1, « et » de 2, 4 ; puis 2 et 3 dans la mesure suivante.'
          },
          {
            t: 'quiz',
            q: 'Ce qui distingue la clave de rumba de celle du son :',
            choices: ['Le 3e coup est sur le « et » de 4', 'Elle se joue en ternaire', 'Elle a 6 coups', 'Elle commence toujours par la mesure à 2 coups'],
            answer: 0,
            explain: 'Même motif, mais le 3e coup recule d’une croche, du 4 au « et » de 4.'
          },
          { t: 'go', links: [{ href: '#/rythme/taper/6', label: 'Rythme › Lire et taper, niveau 6 (claves)' }] }
        ]
      }
    ]
  }
];

export const LESSONS: Lesson[] = PARTS.flatMap((p) => p.lessons);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
