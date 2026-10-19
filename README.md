# Harmonie jazz

Appli web installable (PWA) pour progresser en harmonie jazz au piano, pensée pour l'iPhone.

Deux usages : **dans le métro** (sans piano, d'une main, hors ligne) et **au piano** (téléphone sur le pupitre, écran toujours allumé).

## Écrans

- **Accueil** : reprendre le dernier exercice, trois suggestions « À travailler » tirées de tes erreurs.
- **Accords de la tonalité** (métro) : une tonalité et une fondamentale (en D majeur, F♯), trouver le type d'accord (maj7, m7, 7, ø7, °7). 4 niveaux jusqu'au mineur et aux 12 tonalités ; les couples tonalité-degré ratés reviennent plus souvent ; réussite et temps par degré.
- **Analyse express** (métro) : questions chronométrées sur des suites d'accords (degré, schéma, tonalité, 9 ou ♭9, 3ce/7e, gamme), sprint 60 s ou série de 20. Les types de questions et les enchaînements ratés reviennent plus souvent.
- **Oreille** (métro, écouteurs) : reconnaître accords et progressions, construire un accord au clavier, 4 niveaux.
- **Grilles** (piano) : 10 standards + ii–V–I dans les 12 tonalités, import Ultimate Guitar / ChordPro. Trois vues sur la même grille :
  - *Degrés* : analyse (ii–V, centres tonaux, dominantes secondaires, SubV, backdoor), quiz à degrés masqués ; avec le micro, vérifie que ton comping contient la 3ce et la 7e.
  - *Gammes* : gamme de chaque accord ; avec le micro, classe chaque note jouée (accord, gamme, approche, hors) et compte les notes de l'accord jouées sur le 1er temps.
  - *Guide tones* : deux lignes 3ce/7e conduites par demi-ton ; le micro vérifie le guide tone au 1er temps.
  - Play-along (piano, contrebasse, batterie), transposition, mode pupitre plein écran (portrait ou paysage).
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
    listen/     micro, détection de notes et d'accords, vérification du comping
    progress.ts suggestions « À travailler »
    random.ts   tirages (pondérés, reproductibles en test)
    storage.ts  sauvegarde locale
  modules/      tonalite, express, oreille, grilles, flash, micro
  ui/           composants partagés (barre, clavier, lecteur, pupitre…)
  styles/       tokens, base, composants, écrans
  library/      grilles (accords uniquement)
```

Stack : TypeScript, Preact, Vite, WebAudio, service worker (hors ligne), GitHub Pages. Tests : Vitest (théorie, analyse, import, arrangement, détection calibrée sur les vrais échantillons de piano).

À venir : rythme (comping, placement), dictée de basse, voicings à deux mains.

## Installer sur iPhone

1. Ouvrir https://philippemathieu.github.io/jazz_app/ dans Safari.
2. Partager → « Sur l'écran d'accueil ».

L'appli fonctionne ensuite hors ligne.

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
- Polices : Big Shoulders Display, IBM Plex Sans et IBM Plex Mono (SIL Open Font License).
