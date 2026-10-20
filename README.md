# Harmonie jazz

Appli web installable (PWA) pour progresser en harmonie jazz au piano, pensée pour l'iPhone.

Deux usages : **dans le métro** (sans piano, d'une main, hors ligne) et **au piano** (téléphone sur le pupitre, écran toujours allumé).

## Écrans

Chaque exercice d'harmonie commence par un niveau **Débutant** : accords de 3 sons (majeur, mineur), sans 7e — Accords de la tonalité, Analyse express, Oreille (accords, construire, progressions I–IV–V, I–VI–IV–V, II–V–I) et Flash voicings (« 3 sons », renversement libre). Trois leçons et trois grilles en 3 sons pour démarrer.

- **Clavier** : 5 octaves qui défilent. « Nommer ce que je joue » : touche des notes (ou joue-les au piano, micro) et l'appli nomme l'accord, avec les autres lectures (renversement, sans quinte, sans fondamentale). « Voir un accord » : fondamentale, type (3 sons, 4 sons, enrichis), disposition (renversements, shell, A, B), à écouter.
- **Astuces d'enchaînement** : 15 réflexes de conduite des voix (7e du II → 3ce du V, 5te du II → ♭9 du V, encadrements, SubV, backdoor…), chacun avec un exemple écrit (accords, ligne, degrés), à écouter et à transposer.
- **Cours** : 20 leçons, dont 3 pour débuter (accords de 3 sons, accords de la gamme, premiers enchaînements) courtes (construire un accord, caractère des accords, accords de la tonalité, ii–V–I majeur et mineur, turnarounds, dominantes secondaires, SubV, backdoor, blues, voicings, tensions, gammes) et une partie **Le rythme** (le swing et le 2-4, placer ses accords, reconnaître les styles, la clave), avec exemples à écouter et à voir au clavier, mini-quiz et lien vers l'exercice.
- **Accueil** : reprendre le dernier exercice, trois suggestions « À travailler » tirées de tes erreurs.
- **Lecture de notes** (métro ou piano) : une note en clé de sol ou de fa ; la toucher sur un clavier, la nommer, ou la jouer au piano (le micro vérifie l'octave). 4 niveaux jusqu'aux lignes supplémentaires et aux altérations.
- **Accords de la tonalité** (métro) : une tonalité et une fondamentale (en D majeur, F♯), trouver le type d'accord (maj7, m7, 7, ø7, °7). 4 niveaux jusqu'au mineur et aux 12 tonalités ; les couples tonalité-degré ratés reviennent plus souvent ; réussite et temps par degré.
- **Analyse express** (métro) : questions chronométrées sur des suites d'accords (degré, schéma, tonalité, la note de la 9 ou ♭9, 3ce/7e, gamme), l'accord visé affiché au clavier après chaque réponse, sprint 60 s ou série de 20. Les types de questions et les enchaînements ratés reviennent plus souvent.
- **Oreille** (métro, écouteurs) : reconnaître accords et progressions, construire un accord au clavier, 4 niveaux.
- **Rythme** (métro au casque, ou piano au micro) : *Taper un rythme* (6 niveaux : noires, croches swing, contretemps/Charleston, comping sur 2 mesures avec anticipations, triolets, claves son/rumba/bossa ; écart mesuré en ms par attaque, tempo +4 à chaque réussite), *Garder le tempo* (clic sur les 4 temps et taper 2 et 4, clic sur 2 et 4, clic une mesure sur deux, clic qui disparaît ; dérive en BPM), *Quel rythme ?* et *Quel style ?* (swing, ballade, valse jazz, bossa nova, samba, afro-cubain, funk, avec les indices pour les reconnaître). Calibration de la latence (écran ou micro) ; au micro, détection des attaques par flux spectral et alerte si le micro entend le métronome.
- **Grilles** (piano) : 10 standards + ii–V–I dans les 12 tonalités, import Ultimate Guitar / ChordPro. Trois vues sur la même grille :
  - *Degrés* : analyse (ii–V, centres tonaux, dominantes secondaires, SubV, backdoor), quiz à degrés masqués ; avec le micro, vérifie que ton comping contient la 3ce et la 7e.
  - *Gammes* : gamme de chaque accord ; avec le micro, classe chaque note jouée (accord, gamme, approche, hors) et compte les notes de l'accord jouées sur le 1er temps.
  - *Guide tones* : deux lignes 3ce/7e conduites par demi-ton ; le micro vérifie le guide tone au 1er temps.
  - Play-along (piano, contrebasse, batterie) dans 7 styles (swing, ballade, valse jazz, bossa nova, samba, afro-cubain, funk), transposition, mode pupitre plein écran (portrait ou paysage).
- **Flash voicings** (piano) : un accord s'affiche, tu le joues (shell, sans fondamentale A/B), le micro valide et passe au suivant ; les accords ratés reviennent plus souvent.
- **Micro** : niveau, seuil de silence, note et accord entendus.

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
    progress.ts suggestions « À travailler »
    random.ts   tirages (pondérés, reproductibles en test)
    storage.ts  sauvegarde locale
  modules/      cours, lecture, tonalite, express, oreille, rythme, grilles, clavier, flash, micro
  ui/           composants partagés (barre, clavier, lecteur, pupitre…)
  styles/       tokens, base, composants, écrans
  library/      grilles (accords uniquement)
```

Stack : TypeScript, Preact, Vite, WebAudio, service worker (hors ligne), GitHub Pages. Tests : Vitest (théorie, analyse, import, arrangement, détection calibrée sur les vrais échantillons de piano).

À venir : dictée de basse, voicings à deux mains.

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

- Piano : Salamander Grand Piano V3 par Alexander Holm, licence CC BY 3.0.
- Clés et altérations : glyphes de la police Bravura (Steinberg), SIL Open Font License 1.1.
- Polices : Big Shoulders Display, IBM Plex Sans et IBM Plex Mono (SIL Open Font License).
