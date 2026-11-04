This is the website of HackLab ESGI, a student association linked to ESGI.

For more information about us, please visit our website.

Our website is designed using the template from https://github.com/louisescher/spectre.

## Événements (`public/events/events.json`)

Les sessions et les entraînements CTF sont lus depuis ce fichier, rempli par le bot Discord. Chaque entrée :

```json
{
  "type": "training",
  "title": "Entraînement CTF",
  "start": "2026-10-10T12:00:00.000Z",
  "duration": 3,
  "location": "Discord HackLab ESGI",
  "speaker": "@pseudo",
  "description": "Texte libre, <br> accepté pour les retours à la ligne.",
  "url": ""
}
```

- `type` : `"training"` pour un entraînement CTF. Absent (ou toute autre valeur) : c'est une session.
- `start` : date ISO **avec fuseau** (`…Z` pour UTC). Une date sans fuseau est lue comme une heure de Paris.
- `title`, `start` et `duration` (en heures) sont obligatoires : le build échoue avec un message clair s'ils manquent.

Où ils apparaissent :

| | Sessions | Entraînements CTF |
| --- | --- | --- |
| Accueil | session mise en avant + journal des sessions | une ligne « Prochain entraînement CTF » |
| Agenda | aplat bleu | contour bleu, masquable via la légende |
| Abonnement | `/calendar.ics` | `/entrainements.ics` |
