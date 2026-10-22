# Harmonie jazz

Appli web installable (PWA) pour progresser en harmonie jazz au piano, pensée pour l'iPhone.

Deux usages : **dans le métro** (sans piano, d'une main, hors ligne) et **au piano** (téléphone sur le pupitre, écran toujours allumé).

## Le parcours

Une seule question à l'ouverture : **qu'est-ce que je fais maintenant ?** L'accueil répond par une carte « Continuer » : la prochaine leçon ou le prochain exercice. Un sélecteur **Métro / Au piano** dit où l'on est : dans le métro, seuls les exercices sans piano sont proposés (ceux au piano attendent, et l'accueil dit combien) ; au piano, ceux au piano passent d'abord.

10 étapes, des notes à l'improvisation. Au premier lancement : « Je débute » (étape 1), « Je connais les accords de 3 sons » (étape 4) ou « Je joue déjà des ii–V–I » (étape 6) ; les étapes d'avant sont comptées comme acquises et restent ouvertes.

| # | Étape | Leçons | Exercices |
|---|---|---|---|
| 1 | Notes et intervalles | 2 | 4 (+1) |
| 2 | Les accords de 3 sons | 1 | 4 |
| 3 | La gamme et ses accords | 3 | 6 (+1) |
| 4 | Les accords de 4 sons | 3 | 6 |
| 5 | Le ii–V–I | 2 | 7 |
| 6 | Voicings et guide tones | 1 | 6 |
| 7 | Lire une grille : le blues | 3 | 6 (+3) |
| 8 | Le mineur et les dominantes secondaires | 4 | 7 (+1) |
| 9 | Substitutions et couleurs | 4 | 7 (+3) |
| 10 | Improviser sur les accords | 2 | 7 (+3) |

25 leçons, 60 exercices (31 dans le métro, 18 au piano, 11 de rythme), 12 « pour aller plus loin ». Une étape est finie quand ses leçons sont lues et ses exercices validés.

Chaque étape : **Comprendre** (leçons de 3 à 5 min, exemples à écouter et à voir au clavier, mini-quiz), **Dans le métro** (sans piano, d'une main, écouteurs), **Au piano** (le micro valide ; sans micro, on peut valider soi-même), **Rythme**, **Pour aller plus loin**.

Chaque exercice a un **objectif** chiffré, affiché avant et pendant : « 8 justes sur 10 », « 2 réussis sur 3 » (rythme), « 80 % des enchaînements trouvés » (analyse d'une grille), « 80 % au micro, sur 12 accords au moins » (jouer une grille). Il se lance directement, sans écran de réglages. Résultat : Validé / Pas encore, Recommencer, Continuer.

Ce que contiennent les exercices :
- **Notes** : lire en clé de sol ou de fa, toucher la note au clavier ou la jouer au piano (le micro vérifie l'octave).
- **Armures** : l’armure ↔ la tonalité (3 ♯ → A majeur), dièses puis bémols, relatif mineur, citer les altérations dans l’ordre.
- **Accords** : construire un accord au clavier ; quel accord sur ce degré ; majeur/mineur puis maj7, m7, 7, ø7, °7 à l'oreille ; l'accord entier (fondamentale et nature) dans une tonalité.
- **Intervalles et basse** à l'oreille : intervalles, degrés de la ligne de basse (I, IV, V… jusqu'à la walking bass).
- **Enchaînements** : analyse (degrés, ii–V, tonalité, 9 ou ♭9, gammes) ; reconnaître un enchaînement à l'oreille ; réharmoniser (SubV, dominantes secondaires, diminués de passage, ii–V du SubV, reconnaître la technique à l'écoute).
- **Voicings au piano** : 3 sons, shells, A et B, ii–V–I dans les 12 tonalités, deux mains (écartés, upper structures, quartes, drop 2). Le micro valide et passe au suivant.
- **Comping en rythme** : ii–V–I avec contrebasse et batterie, motifs 1 et 3, Charleston, anticipations ; le micro mesure chaque attaque et vérifie l'accord.
- **Phrases** : vocabulaire sur ii–V–I en appel-réponse (arpèges, gamme bebop, encerclements, approches chromatiques, mineur, altérée) ; le micro vérifie les notes.
- **Morceaux** : analyser le Blues en F et Autumn Leaves, les retrouver de mémoire, jouer les guide tones, accompagner, improviser au micro.
- **Rythme** : tenir le tempo (avec le clic, sur 2 et 4, clic sur 2 et 4, une mesure sur deux, seul), lire et taper (noires, croches swing, contretemps, comping, triolets, claves), reconnaître un rythme, reconnaître un style (swing, ballade, valse jazz, bossa nova, samba, afro-cubain, funk). Le décalage du téléphone se règle une fois (10 s) au premier exercice.

**Côté ludique, minimal** : étapes cochées, objectif du jour (5, 10 ou 20 min de pratique) et série de jours (un jour manqué par semaine ne la casse pas). Pas de points, de grades ni de badges.

**À revoir** (accueil) : l'appli retient ce que tu confonds à l'oreille (m7 ↔ ø7, deux intervalles, deux rythmes, deux styles…) ; la paire la plus confondue s'affiche, à départager deux réponses à la fois.

**En libre** : *Morceaux* (28 standards et grilles d'exercice, import Ultimate Guitar / ChordPro ; degrés, analyse, gammes, guide tones, mémoire, play-along piano-contrebasse-batterie dans 7 styles, transposition, mode pupitre) et *Clavier* (voir et entendre n'importe quel accord ; nommer ce que tu joues).

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
  parcours/     les 10 étapes (steps.ts), la progression, accueil, étape, exercice, réglages
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
style: swing        # swing | bossa | blues
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
- Polices : Big Shoulders Display, IBM Plex Sans et IBM Plex Mono (SIL Open Font License).
