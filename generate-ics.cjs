const path = require('path');
const fs = require('fs');
const { createEvents } = require('ics');

// 🔧 Convertit les balises <br> en \n et nettoie le HTML
function sanitizeHtmlDescription(str) {
  if (!str) return '';
  return str
    .replace(/<br\s*\/?>/gi, '\n')   // Convertit <br>, </br>, etc. → \n
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

// 🔁 Transformation
const events = eventsData.map(ev => {
  const startDate = new Date(ev.start);
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
    start: [
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      startDate.getDate(),
      startDate.getHours(),
      startDate.getMinutes()
    ],
    end: [
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      endDate.getDate(),
      endDate.getHours(),
      endDate.getMinutes()
    ],
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
    return;
  }

  fs.writeFileSync(icsPath, value);
  console.log('✅ Fichier calendar.ics généré avec succès.');
});
