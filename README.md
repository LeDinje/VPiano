# Piano Virtuel

Un piano jouable dans le navigateur avec un clavier AZERTY.

## Touches

| Rangée du clavier | Notes |
| --- | --- |
| `W X C V B N ,` | touches blanches, octave 3 (Do3 → Si3) |
| `S D G H J` | touches noires, octave 3 |
| `A Z E R T Y U I O P ^ $` | touches blanches, Do4 → Sol5 |
| `é " ( - è ç à =` | touches noires, octaves 4-5 |
| `Espace` (maintenu) | sustain |
| `←` / `→` | octave −1 / +1 |

## Ajouter ses sons

Dépose les fichiers dans `sounds/`, un fichier par note, nommés ainsi :

```
sounds/C4.mp3   sounds/Cs4.mp3   sounds/D4.mp3   sounds/Ds4.mp3 ...
```

Le dièse s'écrit `s` (`Cs4` = Do#4). Le format est réglé par `SOUND_EXT` dans `script.js`
(`.mp3` par défaut ; `.wav` ou `.ogg` marchent aussi).

Il n'est pas nécessaire d'avoir toutes les notes : une note manquante est jouée en transposant
l'échantillon le plus proche. Sans aucun fichier, un synthétiseur intégré prend le relais.

## Lancer en local

Les sons sont chargés via `fetch`, il faut donc un petit serveur (l'ouverture directe du fichier
`index.html` ne charge pas les sons) :

```
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.

## Mise en ligne

Le site est entièrement statique : il peut être publié tel quel avec GitHub Pages
(Settings → Pages → branche `main`, dossier racine).
