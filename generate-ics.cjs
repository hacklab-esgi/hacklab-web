const path = require('path');
const fs = require('fs');
const { createEvents } = require('ics');

// 🔧 Convertit les balises <br> en \n et nettoie le HTML
function sanitizeHtmlDescription(str) {
  if (!str) return '';
  return str
    .replace(/<\/?br\s*\/?>/gi, '\n') // Convertit <br>, </br>, <br/> → \n
    .replace(/<\/?[^>]+>/g, '')      // Supprime toutes les balises HTML restantes
    .trim();
}

// 🔧 Slugify pour l’UID
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')                // décompose les accents
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents
    .replace(/[^a-z0-9]+/g, '-')     // remplace les non-alphanum
    .replace(/^-+|-+$/g, '');        // nettoie les tirets en trop
}

// 📂 Chargement des événements
const eventsPath = path.join(__dirname, 'public', 'events', 'events.json');
const icsPath = path.join(__dirname, 'public', 'calendar.ics');
const eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));

// 🕒 Date sans fuseau (ex. 2026-10-08T18:30:00) → heure de Paris, été/hiver gérés.
// Sinon elle serait lue dans le fuseau de la machine de build (UTC sur Netlify).
function parisToUtc(naive) {
  const offset = (date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Paris', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(date).map(({ type, value }) => [type, value])
    );
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
  };
  const asUtc = new Date(naive + 'Z');
  // Deux passes : le décalage est recalculé à l'heure estimée (juste autour du changement d'heure)
  const guess = new Date(asUtc.getTime() - offset(asUtc));
  return new Date(asUtc.getTime() - offset(guess));
}
// Vérification à chaque build (heure d'été puis d'hiver)
console.assert(parisToUtc('2026-07-01T18:00:00').toISOString() === '2026-07-01T16:00:00.000Z', 'parisToUtc été');
console.assert(parisToUtc('2026-12-01T18:00:00').toISOString() === '2026-12-01T17:00:00.000Z', 'parisToUtc hiver');

// 🔁 Transformation
const events = eventsData.map(ev => {
  const missing = ['title', 'start', 'duration'].filter(k => ev[k] === undefined || ev[k] === '');
  if (missing.length) {
    throw new Error(`Événement incomplet dans events.json (${missing.join(', ')} manquant) : ${JSON.stringify(ev).slice(0, 120)}`);
  }
  const hasTimezone = /(Z|[+-]\d\d:?\d\d)$/.test(ev.start);
  if (!hasTimezone) console.warn(`⚠️ Date sans fuseau lue comme heure de Paris : ${ev.start} (${ev.title})`);
  const startDate = hasTimezone ? new Date(ev.start) : parisToUtc(ev.start);
  if (isNaN(startDate)) {
    console.warn(`⚠️ Date invalide ignorée : ${ev.start}`);
    return null;
  }

  const endDate = new Date(startDate.getTime() + ev.duration * 60 * 60 * 1000);

  const description = sanitizeHtmlDescription(ev.description);
  const speakerInfo = ev.speaker ? `\n\nIntervenant(s) : ${ev.speaker}` : '';

  const uid = `${startDate.toISOString().slice(0, 10)}-${slugify(ev.title)}@hacklab_esgi`;

  const event = {
    uid,
    title: ev.title,
    description: description + speakerInfo,
    location: ev.location,
    start: startDate.getTime(),
    end: endDate.getTime(),
    organizer: {
      name: 'HackLab ESGI',
      email: 'hacklab.esgi@gmail.com'
    }
  };

  if (ev.url && ev.url.trim() !== '') {
    event.url = ev.url;
  }

  return event;
}).filter(Boolean); // enlève les nulls

// 🗓 Génération du fichier ICS
createEvents(events, (error, value) => {
  if (error) {
    console.error('❌ Erreur ICS :', error);
    process.exit(1);
  }

  fs.writeFileSync(icsPath, value);
  console.log('✅ Fichier calendar.ics généré avec succès.');
});
