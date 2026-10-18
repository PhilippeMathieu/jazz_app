# Harmonie jazz

Appli web installable (PWA) pour progresser en harmonie jazz au piano, pensée pour l'iPhone.

## Piliers

1. **Lire et analyser** : grilles d'accords, chiffrage en degrés, ii–V–I, centres tonaux, substitutions.
2. **Improviser** : gamme par accord, guide tones, notes cibles, play-along.
3. **Entendre** : reconnaissance d'accords et de progressions à l'oreille.

Plus tard : rythme (comping, swing, rythme harmonique).

## Architecture

```
src/
  core/
    theory/     notes, intervalles, accords, gammes, orthographe
    chart/      modèle de grille (tonalité, mesures, accords, durées en temps)
    analysis/   moteur d'analyse (ii–V–I, subs, tonalités, degrés)
    player/     lecteur de grille (basse + comping, tempo)
  modules/
    analyse/
    impro/
    oreille/
  library/      grilles (accords uniquement) + import
```

Stack : TypeScript, Vite, Tone.js (piano échantillonné), service worker pour le hors ligne, déploiement GitHub Pages.

## Lots

1. Socle : PWA, son piano, modèle de grille, moteur d'analyse, lecteur, oreille v1.
2. Analyse : bibliothèque de grilles, exercices de chiffrage.
3. Impro : play-along, guide tones, exercices guidés.
4. Oreille : enrichissement.

## Installer sur iPhone

1. Ouvrir https://philippemathieu.github.io/jazz_app/ dans Safari.
2. Partager → « Sur l'écran d'accueil ».

L'appli fonctionne ensuite hors ligne.

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # tests de la théorie et du moteur d'analyse
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

## Crédits

- Piano : Salamander Grand Piano V3 par Alexander Holm, licence CC BY 3.0.
- Polices : Big Shoulders Display, IBM Plex Sans et IBM Plex Mono (SIL Open Font License).
