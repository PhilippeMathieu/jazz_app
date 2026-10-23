import { Chart, parseChart } from '../core/chart/model';
import { EXERCISES } from './exercises';
import { userCharts } from './userCharts';
import { POP } from './pop';

// Grilles d'accords uniquement (pas de mélodies). Format : voir parseChart.
const SOURCES: Record<string, string> = {
  'blues-f': `
title: Blues en F
subtitle: Blues jazz, 12 mesures
key: F
tempo: 120
style: blues
level: 1
notes: La forme la plus jouée en jam. I7 et IV7 sont des couleurs blues, puis ii–V vers le ii et turnaround.
[A]
| F7 | B♭7 | F7 | Cm7 F7 |
| B♭7 | B°7 | F7 | Am7 D7 |
| Gm7 | C7 | F7 D7 | Gm7 C7 |
`,
  'autumn-leaves': `
title: Autumn Leaves
subtitle: Standard, forme AAB, 32 mesures
key: Gm
tempo: 132
style: swing
level: 1
notes: Le meilleur standard pour apprendre : un ii–V–I majeur (B♭) puis un ii–V–i mineur (Gm), en boucle.
[A]
| Cm7 | F7 | B♭maj7 | E♭maj7 |
| Aø7 | D7♭9 | Gm6 | Gm6 |
| Cm7 | F7 | B♭maj7 | E♭maj7 |
| Aø7 | D7♭9 | Gm6 | Gm6 |
[B]
| Aø7 | D7♭9 | Gm6 | Gm6 |
| Cm7 | F7 | B♭maj7 | E♭maj7 |
| Aø7 | D7♭9 | Gm7 C7 | Fm7 B♭7 |
| E♭maj7 | Aø7 D7♭9 | Gm6 | Gm6 |
`,
  'blue-bossa': `
title: Blue Bossa
subtitle: Bossa nova, 16 mesures
key: Cm
tempo: 140
style: bossa
level: 2
notes: Tonalité mineure, puis une modulation d'un demi-ton vers D♭ majeur avec son propre ii–V–I.
[A]
| Cm7 | Cm7 | Fm7 | Fm7 |
| Dø7 | G7♭9 | Cm7 | Cm7 |
[B]
| E♭m7 | A♭7 | D♭maj7 | D♭maj7 |
| Dø7 | G7♭9 | Cm7 | Dø7 G7♭9 |
`,
  'rhythm-changes': `
title: Rhythm changes en B♭
subtitle: Forme AABA, 32 mesures
key: B♭
tempo: 160
style: swing
level: 2
notes: Turnarounds I–VI–ii–V dans les A, et un pont en cycle de dominantes (III7 VI7 II7 V7).
[A]
| B♭maj7 G7 | Cm7 F7 | B♭maj7 G7 | Cm7 F7 |
| Fm7 B♭7 | E♭maj7 A♭7 | Dm7 G7 | Cm7 F7 |
[A]
| B♭maj7 G7 | Cm7 F7 | B♭maj7 G7 | Cm7 F7 |
| Fm7 B♭7 | E♭maj7 A♭7 | Cm7 F7 | B♭6 |
[B]
| D7 | % | G7 | % |
| C7 | % | F7 | % |
[A]
| B♭maj7 G7 | Cm7 F7 | B♭maj7 G7 | Cm7 F7 |
| Fm7 B♭7 | E♭maj7 A♭7 | Cm7 F7 | B♭6 |
`,
  'blues-mineur': `
title: Blues mineur en C
subtitle: Blues mineur, 12 mesures
key: Cm
tempo: 130
style: swing
level: 1
notes: Tonique mineure, IV mineur, puis ♭VI7 – V7 pour revenir. La forme de Mr. P.C. ou d'Equinox.
[A]
| Cm7 | Fm7 | Cm7 | Cm7 |
| Fm7 | Fm7 | Cm7 | Cm7 |
| A♭7 | G7♭9 | Cm7 | Dø7 G7♭9 |
`,
  'so-what': `
title: So What
subtitle: Modal, forme AABA, 32 mesures
key: Dm
tempo: 136
style: swing
level: 1
notes: Un seul accord pendant 8 mesures : dorien de ré, puis dorien de mi♭ au pont. Idéal pour travailler la gamme et les notes cibles sans changement d'accord.
[A]
| Dm7 | % | % | % |
| % | % | % | % |
[A]
| Dm7 | % | % | % |
| % | % | % | % |
[B]
| E♭m7 | % | % | % |
| % | % | % | % |
[A]
| Dm7 | % | % | % |
| % | % | % | % |
`,
  'a-train': `
title: Take the A Train
subtitle: Standard, forme AABA, 32 mesures
key: C
tempo: 160
style: swing
level: 1
notes: Le II7 (D7♭5) colore le I sans résoudre sur le V : il glisse vers Dm7. Pont au IV.
[A]
| C6 | % | D7♭5 | % |
| Dm7 | G7 | C6 | Dm7 G7 |
[A]
| C6 | % | D7♭5 | % |
| Dm7 | G7 | C6 | C7 |
[B]
| Fmaj7 | % | % | % |
| D7 | % | Dm7 | G7 |
[A]
| C6 | % | D7♭5 | % |
| Dm7 | G7 | C6 | Dm7 G7 |
`,
  'blues-bird': `
title: Blues Bird
subtitle: Blues « Parker », 12 mesures
key: F
tempo: 150
style: blues
level: 3
notes: Le blues de Charlie Parker (Blues for Alice) : des ii–V en cascade qui descendent vers le IV, puis un turnaround.
[A]
| Fmaj7 | Eø7 A7♭9 | Dm7 G7 | Cm7 F7 |
| B♭7 | B♭m7 E♭7 | Am7 D7 | A♭m7 D♭7 |
| Gm7 | C7 | F7 D7 | Gm7 C7 |
`,
  solar: `
title: Solar
subtitle: 12 mesures
key: Cm
tempo: 150
style: swing
level: 3
notes: Des ii–V qui descendent d'un ton : vers F, vers E♭, vers D♭, puis retour en C mineur.
[A]
| Cm(maj7) | % | Gm7 | C7 |
| Fmaj7 | % | Fm7 | B♭7 |
| E♭maj7 | E♭m7 A♭7 | D♭maj7 | Dø7 G7♭9 |
`,
  'all-the-things': `
title: All the Things You Are
subtitle: Standard, forme AABA', 36 mesures
key: A♭
tempo: 150
style: swing
level: 3
notes: Le standard des modulations : A♭, C, E♭, G, E, retour en A♭. Suis les ii–V pour savoir où tu es.
[A]
| Fm7 | B♭m7 | E♭7 | A♭maj7 |
| D♭maj7 | G7 | Cmaj7 | Cmaj7 |
[A2]
| Cm7 | Fm7 | B♭7 | E♭maj7 |
| A♭maj7 | Am7 D7 | Gmaj7 | Gmaj7 |
[B]
| Am7 | D7 | Gmaj7 | Gmaj7 |
| F♯m7 | B7 | Emaj7 | C7♯5 |
[A3]
| Fm7 | B♭m7 | E♭7 | A♭maj7 |
| D♭maj7 | D♭m7 G♭7 | Cm7 | B°7 |
| B♭m7 | E♭7 | A♭maj7 | Gø7 C7♭9 |
`,
  'blues-bb': `
title: Blues en B♭
subtitle: Blues jazz, 12 mesures
key: B♭
tempo: 140
style: blues
level: 1
notes: La même forme que le blues en F, une quarte plus haut : la deuxième tonalité des jams (Tenor Madness, Sonnymoon for Two).
[A]
| B♭7 | E♭7 | B♭7 | Fm7 B♭7 |
| E♭7 | E°7 | B♭7 | Dm7 G7 |
| Cm7 | F7 | B♭7 G7 | Cm7 F7 |
`,
  'blue-monk': `
title: Blue Monk
subtitle: Thelonious Monk, blues en B♭
key: B♭
tempo: 120
style: blues
level: 1
notes: Un blues tout en dominantes, avec le diminué de passage E°7 entre E♭7 et B♭7.
[A]
| B♭7 E♭7 | B♭7 | E♭7 E°7 | B♭7 |
| E♭7 | E°7 | B♭7 | G7 |
| C7 | F7 | B♭7 | F7 |
`,
  'satin-doll': `
title: Satin Doll
subtitle: Duke Ellington, forme AABA, 32 mesures
key: C
tempo: 130
style: swing
level: 1
notes: Des ii–V qui montent d'un ton (Dm7 G7, Em7 A7), puis un ii–SubV ; le pont part en F avec Gm7 C7.
[A]
| Dm7 G7 | Dm7 G7 | Em7 A7 | Em7 A7 |
| Am7 D7 | A♭m7 D♭7 | C6 | C6 |
[A]
| Dm7 G7 | Dm7 G7 | Em7 A7 | Em7 A7 |
| Am7 D7 | A♭m7 D♭7 | C6 | C6 |
[B]
| Gm7 C7 | Gm7 C7 | Fmaj7 | Fmaj7 |
| Am7 D7 | Am7 D7 | Dm7 G7 | Dm7 G7 |
[A]
| Dm7 G7 | Dm7 G7 | Em7 A7 | Em7 A7 |
| Am7 D7 | A♭m7 D♭7 | C6 | C6 |
`,
  'all-of-me': `
title: All of Me
subtitle: Standard, forme ABAC, 32 mesures
key: C
tempo: 140
style: swing
level: 1
notes: Une chaîne de dominantes secondaires (E7 vers A7 vers Dm7) : chaque accord de 7 résout une quarte plus haut.
[A]
| Cmaj7 | Cmaj7 | E7 | E7 |
| A7 | A7 | Dm7 | Dm7 |
[B]
| E7 | E7 | Am7 | Am7 |
| D7 | D7 | Dm7 | G7 |
[A]
| Cmaj7 | Cmaj7 | E7 | E7 |
| A7 | A7 | Dm7 | Dm7 |
[C]
| Fmaj7 | Fm6 | Cmaj7 Em7 | A7 |
| Dm7 | G7 | C6 | Dm7 G7 |
`,
  'fly-me': `
title: Fly Me to the Moon
subtitle: Standard, 32 mesures
key: C
tempo: 140
style: swing
level: 1
notes: Le cycle des quartes presque complet : Am7 Dm7 G7 Cmaj7 Fmaj7 Bø7 E7 Am7. Idéal pour les guide tones.
[A]
| Am7 | Dm7 | G7 | Cmaj7 |
| Fmaj7 | Bø7 | E7 | Am7 A7 |
| Dm7 | G7 | Cmaj7 | Am7 |
| Dm7 | G7 | Cmaj7 | Bø7 E7 |
[B]
| Am7 | Dm7 | G7 | Cmaj7 |
| Fmaj7 | Bø7 | E7 | Am7 A7 |
| Dm7 | G7 | Em7 A7 | Dm7 G7 |
| C6 | C6 | Bø7 | E7 |
`,
  'summertime': `
title: Summertime
subtitle: Gershwin, 16 mesures
key: Am
tempo: 80
style: ballade
level: 1
notes: Tonalité mineure : Am6 tenu, la sous-dominante Dm7, et le ii–V mineur Bø7 E7 qui ramène à Am.
[A]
| Am6 | E7 | Am6 | Am6 |
| Dm7 | Dm7 | Bø7 | E7♭9 |
| Am6 | E7 | Am6 | A7 |
| Dm7 G7 | Cmaj7 F7 | Bø7 E7 | Am6 |
`,
  'song-for-my-father': `
title: Song for My Father
subtitle: Horace Silver, forme AAB, 24 mesures
key: Fm
tempo: 120
style: bossa
level: 1
notes: Fm7, puis la descente E♭7, D♭7, C7 : la basse descend par tons et demi-tons vers la dominante.
[A]
| Fm7 | Fm7 | E♭7 | E♭7 |
| D♭7 | C7 | Fm7 | Fm7 |
[A]
| Fm7 | Fm7 | E♭7 | E♭7 |
| D♭7 | C7 | Fm7 | Fm7 |
[B]
| E♭7 | E♭7 | Fm7 | Fm7 |
| E♭7 | E♭7 | D♭7 C7 | Fm7 |
`,
  'ipanema': `
title: The Girl from Ipanema
subtitle: Jobim, forme AABA, 40 mesures
key: F
tempo: 130
style: bossa
level: 2
notes: G7 (II7) puis le G♭7 chromatique ; le pont de 16 mesures monte d'un demi-ton (F♯maj7, puis F♯m7) et revient vers F par Gm7 et des ii–V.
[A]
| Fmaj7 | Fmaj7 | G7 | G7 |
| Gm7 | G♭7 | Fmaj7 | G♭7 |
[A]
| Fmaj7 | Fmaj7 | G7 | G7 |
| Gm7 | G♭7 | Fmaj7 | Fmaj7 |
[B]
| F♯maj7 | F♯maj7 | B7 | B7 |
| F♯m7 | F♯m7 | D7 | D7 |
| Gm7 | Gm7 | E♭7 | E♭7 |
| Am7 | D7 | Gm7 | C7 |
[A]
| Fmaj7 | Fmaj7 | G7 | G7 |
| Gm7 | G♭7 | Fmaj7 | G♭7 |
`,
  'misty': `
title: Misty
subtitle: Erroll Garner, forme AABA, 32 mesures
key: E♭
tempo: 66
style: ballade
level: 2
notes: Ballade : B♭m7 E♭7 vers le IV, puis l'emprunt A♭m7 D♭7 (backdoor) qui revient sur E♭.
[A]
| E♭maj7 | B♭m7 E♭7 | A♭maj7 | A♭m7 D♭7 |
| E♭maj7 Cm7 | Fm7 B♭7 | Gm7 C7 | Fm7 B♭7 |
[A]
| E♭maj7 | B♭m7 E♭7 | A♭maj7 | A♭m7 D♭7 |
| E♭maj7 Cm7 | Fm7 B♭7 | E♭6 | E♭6 |
[B]
| B♭m7 | E♭7 | A♭maj7 | A♭maj7 |
| Am7 | D7 | Gm7 C7 | Fm7 B♭7 |
[A]
| E♭maj7 | B♭m7 E♭7 | A♭maj7 | A♭m7 D♭7 |
| E♭maj7 Cm7 | Fm7 B♭7 | E♭6 | E♭6 |
`,
  'another-you': `
title: There Will Never Be Another You
subtitle: Standard, forme ABAC, 32 mesures
key: E♭
tempo: 160
style: swing
level: 2
notes: Le ii–V mineur Dø7 G7 vers Cm7, puis B♭m7 E♭7 vers A♭, le IVm D♭7 (backdoor) et un retour par F7, le V du V.
[A]
| E♭maj7 | E♭maj7 | Dø7 | G7♭9 |
| Cm7 | Cm7 | B♭m7 | E♭7 |
| A♭maj7 | D♭7 | E♭maj7 | Cm7 |
| F7 | F7 | Fm7 | B♭7 |
[B]
| E♭maj7 | E♭maj7 | Dø7 | G7♭9 |
| Cm7 | Cm7 | B♭m7 | E♭7 |
| A♭maj7 | D♭7 | E♭maj7 | Aø7 D7 |
| Gm7 C7 | Fm7 B♭7 | E♭6 | Fm7 B♭7 |
`,
  'just-friends': `
title: Just Friends
subtitle: Standard, 32 mesures
key: G
tempo: 170
style: swing
level: 2
notes: Commence sur le IV (Cmaj7), puis Cm7 F7, le backdoor vers G ; B♭m7 E♭7 est un ii–V qui glisse d'un demi-ton vers Am7.
[A]
| Cmaj7 | Cmaj7 | Cm7 | F7 |
| Gmaj7 | Gmaj7 | B♭m7 | E♭7 |
| Am7 | D7 | Bm7 | E7 |
| A7 | A7 | Am7 | D7 |
[B]
| Cmaj7 | Cmaj7 | Cm7 | F7 |
| Gmaj7 | Gmaj7 | B♭m7 | E♭7 |
| Am7 | D7 | Bm7 E7 | Am7 D7 |
| G6 | E7 | Am7 | D7 |
`,
  'tune-up': `
title: Tune Up
subtitle: Miles Davis, 16 mesures
key: D
tempo: 180
style: swing
level: 2
notes: Trois ii–V–I qui descendent d'un ton : vers D, vers C, vers B♭. Le meilleur exercice de ii–V–I en plusieurs tonalités.
[A]
| Em7 | A7 | Dmaj7 | Dmaj7 |
| Dm7 | G7 | Cmaj7 | Cmaj7 |
| Cm7 | F7 | B♭maj7 | B♭maj7 |
| Eø7 | A7 | Dmaj7 | Eø7 A7 |
`,
  'ladybird': `
title: Lady Bird
subtitle: Tadd Dameron, 16 mesures
key: C
tempo: 160
style: swing
level: 2
notes: Le standard du backdoor : Fm7 B♭7 (IVm7 ♭VII7) vers C, puis B♭m7 E♭7 vers A♭, et le turnaround C E♭7 A♭ D♭7.
[A]
| Cmaj7 | Cmaj7 | Fm7 | B♭7 |
| Cmaj7 | Cmaj7 | B♭m7 | E♭7 |
| A♭maj7 | A♭maj7 | Am7 | D7 |
| Dm7 | G7 | Cmaj7 E♭7 | A♭maj7 D♭7 |
`,
  'stella': `
title: Stella by Starlight
subtitle: Standard, 32 mesures
key: B♭
tempo: 140
style: swing
level: 3
notes: Commence loin de B♭ (Eø7 A7) : une suite de ii–V, majeurs et mineurs, qui visent chacun une tonalité différente.
[A]
| Eø7 | A7♭9 | Cm7 | F7 |
| Fm7 | B♭7 | E♭maj7 | A♭7 |
| B♭maj7 | Eø7 A7 | Dm7 | B♭m7 E♭7 |
| Fmaj7 | Eø7 A7 | Aø7 | D7♭9 |
[B]
| G7♯5 | G7♯5 | Cm7 | Cm7 |
| A♭7 | A♭7 | B♭maj7 | B♭maj7 |
| Eø7 | A7♭9 | Dø7 | G7♭9 |
| Cø7 | F7♭9 | B♭maj7 | B♭maj7 |
`,
  'prince': `
title: Someday My Prince Will Come
subtitle: Valse jazz, 32 mesures
key: B♭
tempo: 160
style: valse
beats: 3
level: 2
notes: À 3 temps. B♭maj7 D7 (V7 du VI) vers E♭, G7 vers Cm7 ; le diminué D♭°7 glisse entre Dm7 et Cm7.
[A]
| B♭maj7 | D7♯5 | E♭maj7 | G7 |
| Cm7 | G7 | Cm7 | F7 |
| Dm7 | D♭°7 | Cm7 | F7 |
| Dm7 | D♭°7 | Cm7 | F7 |
[B]
| B♭maj7 | D7♯5 | E♭maj7 | G7 |
| Cm7 | G7 | Cm7 | F7 |
| Fm7 | B♭7 | E♭maj7 | E°7 |
| B♭maj7 | G7 | Cm7 F7 | B♭6 |
`,
  'footprints': `
title: Footprints
subtitle: Wayne Shorter, blues mineur à 6/4 (écrit ici en 3/4)
key: Cm
tempo: 180
style: valse
beats: 3
level: 3
notes: Un blues mineur modal : Cm et Fm tenus, puis la cadence F♯ø7 F7 E7 A7 qui revient sur Cm par des dominantes chromatiques.
[A]
| Cm7 | % | % | % |
| % | % | % | % |
| Fm7 | % | % | % |
| Cm7 | % | % | % |
| F♯ø7 | F7 | E7 | A7 |
| Cm7 | % | % | % |
`,
  'cantaloupe': `
title: Cantaloupe Island
subtitle: Herbie Hancock, 16 mesures
key: Fm
tempo: 110
style: funk
level: 1
notes: Trois couleurs tenues 4 mesures chacune : Fm7, D♭7, Dm7. Idéal pour travailler le placement (comping funk).
[A]
| Fm7 | % | % | % |
| D♭7 | % | % | % |
| Dm7 | % | % | % |
| Fm7 | % | % | % |
`,
  'watermelon': `
title: Watermelon Man
subtitle: Herbie Hancock, blues de 16 mesures
key: F
tempo: 120
style: funk
level: 1
notes: Un blues funk : F7 et B♭7, puis l'aller-retour C7 B♭7 avant de revenir sur F7.
[A]
| F7 | % | % | % |
| B♭7 | % | F7 | % |
| C7 | B♭7 | C7 | B♭7 |
| C7 | B♭7 | F7 | % |
`

};

export const LIBRARY: Chart[] = Object.entries(SOURCES).map(([id, src]) => parseChart(src, id));

export { POP };

/** Cherche dans les standards, la pop et la chanson, les exercices et les grilles importées. */
export const chartById = (id: string): Chart | undefined =>
  LIBRARY.find((c) => c.id === id) ?? POP.find((c) => c.id === id) ?? EXERCISES.find((c) => c.id === id) ?? userCharts().find((c) => c.id === id);
