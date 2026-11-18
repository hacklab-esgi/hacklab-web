// Textes saisis librement dans Discord (lieux, intervenants) : nettoyage et mise en forme communs au journal et au calendrier

/** Texte brut : les lieux et descriptions contiennent parfois du HTML (liens Discord, <br>, mentions de salon <#…>). */
export const toText = (html = '') =>
  html
    .replace(/<\/?br\s*\/?>/gi, '\n')
    .replace(/<#\d+>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();

/**
 * Même forme pour tous les lieux : « Campus, salle A07 ». Rien n'est inventé : on ne fait que réordonner ce qui est saisi
 * (« A07, Nation 1 », « Nation 1 - A07 » et « Salle A07 campus Nation 1 » donnent « Nation 1, salle A07 »).
 * `past` : la session a eu lieu, un « probablement » saisi à l'annonce n'a plus de sens et n'est plus affiché.
 */
export const formatPlace = (raw = '', past = false) =>
  toText(raw)
    .replace(/Discord (du )?HackLab ESGI/gi, 'Discord')
    .split(/\s*[+&]\s*/)
    .filter(Boolean)
    .map((part) => {
      const unsure = /probablement/i.test(part);
      // Salle : une lettre et deux chiffres (A07), ou un numéro après « salle »
      const room = part.match(/\b[A-Z]\d{2}\b/)?.[0] ?? part.match(/\bsalle\s+(\d+)\b/i)?.[1];
      const campus = part
        .replace(/\(?probablement\)?/gi, '')
        .replace(room ? new RegExp(`(salle\\s+)?\\b${room}\\b`, 'i') : /$^/, '')
        .replace(/\b(salle|campus)\b/gi, '')
        .replace(/^[\s,–-]+|[\s,–-]+$/g, '')
        // « Salle A11 à Nation » : la préposition ne fait pas partie du nom du campus
        .replace(/^(à|au)\s+/i, '')
        .replace(/\s+/g, ' ');
      const place = [campus, room && `salle ${room}`].filter(Boolean).join(', ');
      return place.charAt(0).toUpperCase() + place.slice(1) + (unsure && !past ? ' (à confirmer)' : '');
    })
    .join(' + ');

// Vérification à chaque build
console.assert(
  formatPlace('A07, Nation 1') === 'Nation 1, salle A07' &&
    formatPlace('Salle 3 Campus Voltaire') === 'Voltaire, salle 3' &&
    formatPlace('B12') === 'Salle B12' &&
    formatPlace('Salle A11 à Nation') === 'Nation, salle A11' &&
    formatPlace('Salle A11 (probablement) campus Nation 1') === 'Nation 1, salle A11 (à confirmer)' &&
    formatPlace('Salle A11 (probablement) campus Nation 1', true) === 'Nation 1, salle A11' &&
    formatPlace('Nation 1 - B01 + <#12> & <a href="x">Discord HackLab ESGI</a>') === 'Nation 1, salle B01 + Discord',
  'formatPlace',
);
