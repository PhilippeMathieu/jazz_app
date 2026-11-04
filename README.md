# Harmonie jazz

Appli web installable (PWA) pour progresser en harmonie jazz au piano, pensée pour l'iPhone.

Deux usages : **dans le métro** (sans piano, d'une main, hors ligne) et **au piano** (téléphone sur le pupitre, écran toujours allumé).

## Le parcours

Une seule question à l'ouverture : **qu'est-ce que je fais maintenant ?** L'accueil répond par une carte « Continuer » : la prochaine leçon ou le prochain exercice. Un sélecteur **Métro / Au piano** dit où l'on est : dans le métro, seuls les exercices sans piano sont proposés (ceux au piano attendent, et l'accueil dit combien) ; au piano, ceux au piano passent d'abord.

12 étapes, des notes à l'improvisation, **avec une impro guidée dès l'étape 1**. Au premier lancement : « Je débute » (étape 1), « Je connais les accords de 3 sons » (étape 4) ou « Je joue déjà des ii–V–I » (étape 8) ; les étapes d'avant sont comptées comme acquises et restent ouvertes. Le point de départ est gardé par identifiant d'étape (un ancien choix est relu correctement après l'ajout d'une étape).

| # | Étape | Leçons | Exercices | Impro guidée |
|---|---|---|---|---|
| 1 | Notes et intervalles | 3 | 5 (+1) | les touches noires |
| 2 | Les accords de 3 sons | 1 | 5 | phrases et silences (C D E F G) |
| 3 | La gamme et ses accords | 4 | 7 (+2) | la pentatonique de C |
| 4 | Accompagner une chanson | 4 | 9 | sur la suite de la pop, 1ers temps visés |
| 5 | Les accords de 4 sons | 4 | 12 (+2) | un seul accord (Dm7), rythme imposé |
| 6 | Le blues | 2 | 5 | la gamme blues |
| 7 | Le ii–V–I | 2 | 7 | les notes de l'accord sur le 1er temps |
| 8 | Couleurs, voicings et guide tones | 3 | 5 | |
| 9 | Lire une grille et accompagner | 4 | 7 (+2) | |
| 10 | Le mineur et les dominantes secondaires | 4 | 8 (+3) | |
| 11 | Substitutions et tensions | 4 | 7 (+3) | |
| 12 | Improviser sur les accords | 3 | 7 (+3) | |

38 leçons, 84 exercices (43 dans le métro, 21 au piano, 7 impros guidées, 13 de rythme), 16 « pour aller plus loin ». Une étape est finie quand ses leçons sont lues et ses exercices validés. Dans les leçons, les renvois d'étape s'écrivent `{étape:id}` : le numéro suit l'ordre du parcours.

**Impro guidée** (d'après les play-alongs de Jamey Aebersold : improviser tout de suite, sur peu de notes, avec des silences) : une boucle tourne (basse et batterie ; un accord doux sans micro), les notes permises sont marquées au clavier, une consigne par passage. « Exemple » : l'appli improvise d'abord, ses notes s'allument. Le micro compte les notes dans la gamme, les respirations (2 temps sans nouvelle note), les mesures de silence tenues, les attaques du rythme imposé et les notes de l'accord sur le 1er temps ; 3 passages, 2 réussis. Niveaux : `src/modules/impro/impro.ts`.

**Aucun mot avant son explication** : un test parcourt les leçons dans l'ordre du parcours et échoue si un mot du lexique (shell, dominante, 9e, SubV…) apparaît avant la leçon qui l'explique (ou le présente en passant). Dans les leçons, la première apparition de chaque mot est touchable (définition, exemple à écouter) ; page Lexique depuis l'accueil.

Chaque étape : **Comprendre** (leçons de 3 à 5 min, exemples à écouter et à voir au clavier, mini-quiz), **Dans le métro** (sans piano, d'une main, écouteurs), **Au piano** (le micro valide ; sans micro, on peut valider soi-même), **Improviser**, **Rythme**, **Pour aller plus loin**.

Chaque exercice a un **objectif** chiffré, affiché avant et pendant : « 8 justes sur 10 », « 2 réussis sur 3 » (rythme), « 75 % des phrases reconnues » (quiz d'un morceau), « 80 % au micro, sur 12 accords au moins » (jouer une grille). Il se lance directement, sans écran de réglages. Résultat : Validé / Pas encore, Recommencer, Continuer.

Ce que contiennent les exercices :
- **Notes** : lire en clé de sol ou de fa, toucher la note au clavier ou la jouer au piano (le micro vérifie l'octave).
- **Armures** : l’armure ↔ la tonalité (3 ♯ → A majeur), dièses puis bémols, relatif mineur, citer les altérations dans l’ordre.
- **Les 5 accords de 4 sons à l’oreille** (étape 5), progressivement : maj7 → 7 → m7 → ø7 → °7, une seule note baisse d’un demi-ton à chaque fois. Leçon « Comparer les accords de 4 sons » : chaque paire (la note qui change, « la 7e : B → B♭ », l’un / l’autre / l’un puis l’autre, clavier avec la note qui change en bleu et celle de l’autre accord en pointillés, comment l’entendre), puis les 5 ensemble (la chaîne sur une même fondamentale, à la suite ou un par un) et la méthode d’écoute (3ce, 7e, puis 5te). Exercices, boutons toujours dans l’ordre de la chaîne : maj7 ou 7 → 7 ou m7 → les 3 → m7 ou ø7 → les 4 → ø7 ou °7 → **les 5** (12 justes sur 15), puis les 5 renversés en option. Après chaque réponse : la note qui change, et les accords de l’exercice sur la même fondamentale pour comparer.
- **Accords** : construire un accord au clavier ; quel accord sur ce degré ; majeur/mineur puis maj7, m7, 7, ø7, °7 à l'oreille ; l'accord entier (fondamentale et nature) dans une tonalité.
- **Intervalles et basse** à l'oreille : intervalles, degrés de la ligne de basse (I, IV, V… jusqu'à la walking bass).
- **Enchaînements** : analyse (degrés, ii–V, tonalité, 9 ou ♭9, gammes) ; reconnaître un enchaînement à l'oreille ; réharmoniser (SubV, dominantes secondaires, diminués de passage, ii–V du SubV, reconnaître la technique à l'écoute).
- **Voicings au piano** : 3 sons, shells, A et B, ii–V–I dans les 12 tonalités, deux mains (écartés, upper structures, quartes, drop 2). Le micro valide et passe au suivant.
- **Comping en rythme** : ii–V–I avec contrebasse et batterie, motifs 1 et 3, Charleston, anticipations ; le micro mesure chaque attaque et vérifie l'accord.
- **Phrases** : vocabulaire sur ii–V–I en appel-réponse (arpèges, gamme bebop, encerclements, approches chromatiques, mineur, altérée) ; le micro vérifie les notes.
- **Morceaux** : le quiz phrase par phrase de Let It Be (étape 4), du Blues en F, d'Autumn Leaves et de Wind of Change (+ Still Loving You, La Bohème) ; retrouver une grille de mémoire, jouer les guide tones, accompagner, improviser au micro.
- **Reconnaître une suite à l’oreille** (étape 4) : la méthode, un accord à la fois (le 1er accord est le I ; la basse monte de 4 notes = IV, de 5 = V ; le seul mineur = VIm ; à quelle place arrive-t-il ?), puis les exercices progressifs : I → IV ou I → V, + VIm, le mineur en 2e ou en 3e, enfin les 4 suites de la pop ; bouton « Basse seule », comparaison des suites dans la même tonalité après chaque réponse.
- **Accompagner une chanson** (étape 4) : enchaîner sans sauter (renversements, notes communes ; astuces I – V – vi – IV, « Amen » IV → I, V → I), la main gauche (fondamentale, octave, arpège 1-5-8) et le rythme (ballade, pop), lire une grille de chanson en degrés (majuscule = majeur, minuscule = mineur ; I – V – vi – IV et ses variantes) ; au piano : I – V – vi – IV renversés, accompagner Let It Be au micro (3ce et 5te des accords de 3 sons). **Le mineur de la pop et de la chanson** (étape 9) : le ♭VII, i – ♭VI – ♭III – ♭VII, i – iv – V – i, la dominante du vi.
- **Rythme** : tenir le tempo (avec le clic, sur 2 et 4, clic sur 2 et 4, une mesure sur deux, seul), lire et taper (noires, croches swing, contretemps, comping, triolets, claves), reconnaître un rythme, reconnaître un style (swing, ballade, valse jazz, bossa nova, samba, afro-cubain, funk). Le décalage du téléphone se règle une fois (10 s) au premier exercice.

**Astuces d'enchaînement** (15) : dans les leçons, là où la notion est enseignée : leçon « Les guide tones » (étape 8 : la 7e qui descend, la note commune, le triton, la 13), « Construire une ligne » (étape 12 : arpège depuis la 3ce, approche, encadrement), et dans les leçons turnarounds, dominantes secondaires, ii–V–i mineur, backdoor, SubV. Pour chacune : la règle en mots simples, la note de la main droite sous chaque accord avec son rôle (« 7e », « 3ce », « approche ») et son mouvement (« ↓ ½ ton », « reste »), un clavier (accord en gris, note en bleu), l'écoute, « Autre tonalité ».

**Micro** : le micro d'un téléphone, sans contrôle de gain, arrive très faible (un piano joué normalement ≈ −60 dBFS). L'appli mesure le bruit de fond de la pièce (10e centile du niveau sur 15 s), amplifie pour le ramener à −60 dBFS (jusqu'à +50 dB), et place le seuil de silence à 4 fois ce bruit. Sensibilité Moins / Normale / Plus dans Réglages › Tester le micro, et un enregistrement de 15 s (WAV, signal brut) à envoyer pour régler la détection sur un piano donné. Sur des accords joués à −55 et −65 dBFS avec souffle à −87 dBFS : 72/72 entendus, 68/72 reconnus (avant : seuil fixe à −44 dBFS, rien n'était entendu).

**Côté ludique, minimal** : étapes cochées, objectif du jour (5, 10 ou 20 min de pratique) et série de jours (un jour manqué par semaine ne la casse pas). Pas de points, de grades ni de badges.

**À revoir** (accueil) : l'appli retient ce que tu confonds à l'oreille (m7 ↔ ø7, deux intervalles, deux rythmes, deux styles…) ; la paire la plus confondue s'affiche, à départager deux réponses à la fois.

**Bandes-son** (En libre) : les play-alongs Jamey Aebersold de l'élève, avec un vrai trio. Il importe ses fichiers une fois (ils restent sur l'appareil, dans IndexedDB ; l'appli ne fournit aucun son). Chaque piste est reconnue par le numéro au début du nom de fichier et calée mesure par mesure (`src/library/vol21.ts` : début de chaque mesure, accord de chaque tonalité, obtenus par analyse du son : basse sur le canal gauche, piano sur le droit). Pendant la lecture : l'accord et la tonalité en cours, la suivante et dans combien de mesures, la gamme conseillée au clavier (notes de l'accord en bleu ; gamme blues pour les blues), les 12 tonalités à toucher pour y aller, boucle sur une tonalité (ou 4 mesures du blues), vitesse 75 à 100 % sans changer la hauteur. Vol. 21 *Gettin' It Together* : 20 pistes sur 31 calées (cycles majeur, dorien, dominante, ø7, mineur Δ7, V7sus4 → IΔ7, majeur/mineur, blues en F et en B♭) ; les autres se lisent sans grille.

**En libre** : *Morceaux*, trois onglets : Jazz (28 standards, 5 grilles d'exercice), Pop-rock (11 : Scorpions, Queen, Beatles, Lennon, Eagles, Cohen, Dylan), Chanson (3 : Brel, Aznavour, Cabrel) ; grilles simplifiées, accords seulement ; import Ultimate Guitar / ChordPro. Pour chaque morceau : **Comprendre** (la grille racontée phrase par phrase en mots simples, chaque phrase à écouter, degrés sous les accords), **Quiz** (pour chaque phrase : quelle suite, quel enchaînement ? explication après chaque réponse), Accords, Impro (gammes, guide tones), Mémoire ; play-along piano-contrebasse-batterie dans 9 styles (dont pop-rock et ballade pop), transposition, mode pupitre. **Mélodie** (Instruments) : tu la joues une fois au piano, au micro, avec basse et batterie ; l'appli la transcrit (hauteur toutes les 40 ms, attaques, au 1/12 de temps près), la garde sur l'appareil et la rejoue (case « Mélodie »), à tout tempo et dans toute tonalité ; on peut refaire une partie. Aucune mélodie n'est fournie avec les morceaux. **Paroles** : l'import garde les paroles collées (accords au-dessus des paroles, ou ChordPro) ; onglet « Paroles » : chaque ligne du texte, les accords au-dessus des mots, la mesure jouée surlignée. Aucune parole n'est fournie avec l'appli : seulement celles que l'élève colle, gardées sur l'appareil. Et *Clavier* (voir et entendre n'importe quel accord ; nommer ce que tu joues).

**Réglages** : objectif du jour, tester le micro, décalage du micro et de l'écran, point de départ, tout recommencer.

## Architecture

```
src/
  core/
    theory/     notes, accords, gammes, progressions types
    chart/      modèle de grille, import (UG, ChordPro), mise en page
    analysis/   analyse harmonique, gammes et guide tones, choix de quiz
    audio/      moteur WebAudio (piano échantillonné), voicings
    player/     arrangement (basse, comping, batterie) et lecteur
    rhythm/     motifs, styles (grooves), mesure du placement, lecture des rythmes
    listen/     micro, détection de notes, d'accords et d'attaques, vérification du comping
    events.ts   événements des exercices, temps de pratique, objectif du jour, série
    confusions.ts ce que l'élève confond, à départager
    random.ts   tirages (pondérés, reproductibles en test)
    storage.ts  sauvegarde locale
  parcours/     les 12 étapes (steps.ts), la progression, accueil, étape, exercice, réglages
  modules/      les briques : cours, lecture, tonalite, express, oreille, rythme, flash (voicings, comping),
                phrases, grilles, clavier, micro, reglages
  ui/           composants partagés (barre, clavier, lecteur, pupitre…)
  styles/       tokens, base, composants, écrans
  library/      grilles (accords uniquement)
```

Stack : TypeScript, Preact, Vite, WebAudio, service worker (hors ligne), GitHub Pages. Tests : Vitest (théorie, analyse, import, arrangement, détection calibrée sur les vrais échantillons de piano).


## Installer

**iPhone** : ouvrir https://philippemathieu.github.io/jazz_app/ dans Safari, Partager → « Sur l'écran d'accueil ».

**Android** : ouvrir la même adresse dans Chrome, puis le bouton « Installer l'appli » de l'accueil (ou menu ⋮ → « Installer l'application »).

L'appli fonctionne ensuite hors ligne. Les mises à jour se téléchargent seules et s'appliquent à l'ouverture, sur l'accueil (jamais au milieu d'un exercice).

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # tests (théorie, analyse, import, détection)
npm run build    # build de production (dist/)
```

Chaque push sur `main` lance les tests, le build et le déploiement GitHub Pages.

## Format des grilles

```
title: Autumn Leaves
key: Gm
tempo: 132
style: swing        # swing | bossa | ballade | blues | valse | samba | latin | funk | rock | slow
genre: jazz         # jazz | pop | chanson
level: 1
[A]
| Cm7 | F7 | B♭maj7 | E♭maj7 |
| Aø7 | D7♭9 | Gm6 | Gm6 |
```

Une mesure par cellule ; deux accords dans une cellule se partagent la mesure ; `%` répète la mesure précédente.

L'écran « Importer » accepte aussi du texte libre copié d'Ultimate Guitar ou d'une autre appli : lignes d'accords au-dessus des paroles, sections `[Verse]`, notations `C7M`, `G7(b9)`, `Bm7(b5)`, capo (accords ramenés à la hauteur réelle), lignes `Key:` et `Tuning:`, format brut `[ch]Am[/ch]` et ChordPro (`[Am7]paroles`, `{title:}`, `{key:}`). Sans barres de mesure, chaque accord occupe une mesure.

## Crédits

- Piano : Salamander Grand Piano V3 par Alexander Holm, licence CC BY 3.0 (couches de vélocité 6 et 12, via sfzinstruments/SalamanderGrandPiano).
- Contrebasse : soundfont Musyng Kite (rendu MIDI.js de gleitz/midi-js-soundfonts), licence CC BY-SA 3.0.
- Batterie et percussions : Versilian Community Sample Library (sgossner/VCSL), CC0.
- Clés et altérations : glyphes de la police Bravura (Steinberg), SIL Open Font License 1.1.
- Polices : Bodoni Moda, Source Serif 4 et Noto Music (♭ ♯), SIL Open Font License 1.1, embarquées (src/assets/fonts).
