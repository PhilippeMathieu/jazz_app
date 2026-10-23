// Pop, rock et chanson : grilles d'accords simplifiées (pas de paroles, pas de mélodie), relevées d'après des
// grilles publiques (Cifra Club, e-chords, tabs4acoustic) et ramenées à l'essentiel pour l'analyse.
import { Chart, parseChart } from '../core/chart/model';

const SOURCES: Record<string, string> = {
  'wind-of-change': `
title: Wind of Change
subtitle: Scorpions, 1990
genre: pop
key: C
tempo: 76
style: slow
level: 1
notes: Le refrain tourne sur I – V – ii – V. Le pont et le solo passent par E7, la dominante de Am (le vi) : une dominante secondaire, le frisson du morceau. Grille simplifiée.
[Intro]
| F | Dm | F | Dm |
| Am7 | Dm Am7 | G | G |
[Couplet]
| C | Dm | C | Dm Am7 | G | G |
| C | Dm | C | Dm Am7 | G | G |
[Refrain]
| C G | Dm G | C G | Dm G |
| Am7 F | G | C | C |
[Pont]
| Am7 | G | Am7 | G |
| C | Dm | E7 | E7 |
[Solo]
| F G | E7 Am7 | F G | Am7 |
| F G | E7 Am7 | Dm | E7 |
`,
  'still-loving-you': `
title: Still Loving You
subtitle: Scorpions, 1984
genre: pop
key: Gm
tempo: 98
style: slow
level: 2
notes: Couplet : G mineur, puis A majeur (pas dans la gamme : c'est la dominante de D) et D, le V. Refrain : i – ♭VI – ♭III – ♭VII, la suite « épique » du rock en mineur, puis i – iv – V – i. Grille simplifiée ; transpose si besoin pour jouer avec le disque.
[Couplet]
| Gm | Gm | Gm | Gm |
| A | A | D | D |
| Gm | Gm | Gm | Gm |
| A | A | D | D |
[Refrain]
| Gm | E♭ | B♭ | F |
| Gm | E♭ | B♭ | F |
| Gm | Cm | D | Gm |
| E♭ | E♭ | F | F |
`,
  'bohemian-rhapsody': `
title: Bohemian Rhapsody (la ballade)
subtitle: Queen, 1975 · grille très simplifiée
genre: pop
key: B♭
tempo: 72
style: slow
level: 3
notes: La ballade (« Mama… ») réduite à l'essentiel : I – vi – ii – V en B♭, puis un passage en E♭ avec son propre I – vi – ii – V, et A♭m, l'accord mineur emprunté (iv de E♭). L'original est bien plus riche : basses qui descendent, accords de 7e, modulations.
[Couplet]
| B♭ | Gm | Cm | F |
| B♭ | Gm | Cm | F |
[Suite]
| E♭ | Cm | Fm | B♭ |
| E♭ | B♭ | Cm | A♭m E♭ |
`,
  'dont-stop-me-now': `
title: Don't Stop Me Now
subtitle: Queen, 1978
genre: pop
key: F
tempo: 156
style: rock
level: 2
notes: Couplet : I – iii – vi – ii – V, chaque accord une quinte au-dessus du suivant, comme un cycle. Pré-refrain : F7 mène à B♭, puis D7 – Gm, la dominante du ii. Grille simplifiée.
[Couplet]
| F | Am | Dm | Gm C |
| F | Am | Dm Gm | Am B♭ C |
[Pré-refrain]
| F7 | B♭ | Gm | D7 Gm |
| D7 | Gm | Am B♭ | C |
[Refrain]
| F Gm | Am Dm | Gm7 | C |
| F Gm | Am Dm | Gm7 | D7 |
| Gm F | C Gm7 | Gm F | C Gm7 |
| C7 | % | F | F |
`,
  'we-are-the-champions': `
title: We Are the Champions
subtitle: Queen, 1977
genre: pop
key: Cm
tempo: 64
style: slow
level: 3
notes: Couplet en C mineur (i – v), puis E♭, le relatif majeur. Refrain en F : I – iii – vi – IV – V, un F♯° qui mène à Gm, B♭m (le iv mineur emprunté), puis A♭ – B♭ (♭VI – ♭VII) qui ramènent vers C. Grille simplifiée.
[Couplet]
| Cm Gm7/C | Cm Gm7/C | Cm Gm7/C | Cm Gm7/C |
| E♭ A♭/E♭ | E♭ A♭/E♭ | E♭ | B♭/D Cm |
| F | B♭ | B♭9sus4 | C |
[Refrain]
| F Am | Dm B♭ | C | C |
| F Am | B♭ F♯dim | Gm | Gsus4 |
| B♭m | Edim | F | E♭/G |
| A♭6 | B♭ | Cm11 | F |
`,
  'love-of-my-life': `
title: Love of My Life
subtitle: Queen, 1975 · version guitare (live)
genre: pop
key: D
tempo: 72
style: slow
level: 3
notes: Une ballade pleine de détours : E (la dominante de A), F♯ (la dominante de Bm), D♯°7 de passage vers Em. Grille simplifiée de la version guitare en D.
[Intro]
| D Bm | Em A7 | D Bm | G6 D/F♯ | E | E |
[Couplet]
| A F♯m | Bm E | A G6 | A7 |
| D Bm | F♯m G | D G | D Bm |
| Em A7 | D | G6 D/F♯ | E |
[Pont]
| Bm F♯m | G | D F♯ | Bm F♯m |
| D♯°7 Em | A | D Dmaj7 | D Dmaj7 |
`,
  'let-it-be': `
title: Let It Be
subtitle: The Beatles, 1970
genre: pop
key: C
tempo: 72
style: slow
level: 1
notes: Couplet : I – V – vi – IV, puis I – V – IV – I. Refrain : vi – V – IV – I. À la fin, B♭ : le ♭VII, emprunté au mineur, la couleur rock.
[Couplet]
| C G | Am F | C G | F C |
| C G | Am F | C G | F C |
[Refrain]
| Am G | F C | C G | F C |
| Am G | F C | C G | F C |
[Fin]
| F C | B♭ Am | G F | C |
`,
  'imagine': `
title: Imagine
subtitle: John Lennon, 1971
genre: pop
key: C
tempo: 76
style: slow
level: 1
notes: Couplet : C – Cmaj7 – F, le I et le IV. Pont : la basse descend (C/E, Dm/C) jusqu'au V. Refrain : IV – V – I, puis E7, la dominante de Am (V7 du vi), qui relance.
[Couplet]
| C Cmaj7 | F | C Cmaj7 | F |
| C Cmaj7 | F | C Cmaj7 | F |
[Pont]
| F C/E | Dm Dm/C | G | G7 |
[Refrain]
| F | G | C Cmaj7 | E7 |
| F | G | C Cmaj7 | E7 |
| F | G | C Cmaj7 | E7 |
| F | G | C | C |
`,
  'hotel-california': `
title: Hotel California
subtitle: Eagles, 1976
genre: pop
key: Bm
tempo: 74
style: slow
level: 2
notes: Huit accords en B mineur. Trois fois le même geste, un accord puis celui une quinte au-dessus, qui descend d'un ton à chaque fois : Bm – F♯7, A – E7, G – D ; puis Em – F♯7 ramène au début. F♯7 (V7) et E7 (IV7) ne sont pas dans la gamme mineure naturelle.
[Couplet]
| Bm | F♯7 | A | E7 |
| G | D | Em | F♯7 |
| Bm | F♯7 | A | E7 |
| G | D | Em | F♯7 |
[Refrain]
| G | D | F♯7 | Bm |
| G | D | Em | F♯7 |
`,
  'hallelujah': `
title: Hallelujah
subtitle: Leonard Cohen, 1984
genre: pop
key: C
tempo: 60
style: slow
level: 1
notes: La chanson décrit sa propre grille : « the fourth, the fifth, the minor fall, the major lift » : C – F – G – Am – F, la 4te, la 5te, la chute vers le mineur, la remontée. Et E7 → Am, la dominante du vi.
[Couplet]
| C | Am | C | Am |
| F | G | C | G |
| C | F G | Am | F |
| G | E7 | Am | Am |
[Refrain]
| F | F | Am | Am |
| F | F | C G | C |
`,
  'knockin': `
title: Knockin' on Heaven's Door
subtitle: Bob Dylan, 1973
genre: pop
key: G
tempo: 68
style: slow
level: 1
notes: Deux phrases de 4 mesures : I – V – ii, puis I – V – IV. Trois ou quatre accords suffisent pour toute la chanson.
[A]
| G | D | Am7 | Am7 |
| G | D | C | C |
| G | D | Am7 | Am7 |
| G | D | C | C |
`,
  'ne-me-quitte-pas': `
title: Ne me quitte pas
subtitle: Jacques Brel, 1959 · transposé en A mineur
genre: chanson
key: Am
tempo: 66
style: slow
level: 1
notes: En A mineur : i – iv – V7 (Am, Dm, E7), la cadence mineure de base. E7 contient G♯, la sensible, qui tire vers A. Plus loin, F et G (♭VI, ♭VII) colorent la descente. Grille simplifiée.
[Couplet]
| Am | Am7 | Dm | E7 |
| Dm | E7 | Am | Am7 |
| Dm | E7 | Am | Dm Am |
[Refrain]
| Dm | E7 | Am | Dm Am |
[Pont]
| Am | F | E7 | Am |
| E7 Am | F | G | Dm E7 |
| Am | Gm | F | E7 Am |
`,
  'la-boheme': `
title: La Bohème
subtitle: Charles Aznavour, 1965
genre: chanson
key: Cm
tempo: 100
style: slow
level: 2
notes: En C mineur, la cadence mineure : i – iv – V – i (Cm, Fm, G, Cm), chaque phrase partant de Fm. G majeur (pas Gm) contient B, la sensible, qui tire vers C. Le C7 en fin de phrase est la dominante de Fm (V7 du iv) : il relance vers la phrase suivante, qui repart sur Fm. Grille simplifiée.
[Couplet]
| Fm A♭ | Cm | Fm G | Cm |
| Fm | A♭ Cm | Fm G | Cm C7 |
[Refrain]
| Fm | Cm | Fm G | Cm C7 |
| Fm | Cm | Fm G | Cm C7 |
`,
  'je-laime-a-mourir': `
title: Je l'aime à mourir
subtitle: Francis Cabrel, 1979
genre: chanson
key: C
tempo: 92
style: slow
level: 1
notes: Couplet : I – iii – vi – ii – IV – V, les accords de la gamme de C. Puis E, la dominante de Am (V du vi), qui tire vers le mineur. Grille simplifiée.
[Couplet]
| C | Em | Am | Dm |
| F | G | C Em | Am |
[Refrain]
| E | Am | G | C |
| E | Am | F | C |
`
};

export const POP: Chart[] = Object.entries(SOURCES).map(([id, src]) => parseChart(src, id));
