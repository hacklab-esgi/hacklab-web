const fs = require('fs');
const { createEvents } = require('ics');

// Chemin vers le fichier JSON des événements
const eventsData = JSON.parse(fs.readFileSync('./public/events/events.json', 'utf8'));

// Transformation des événements
const events = eventsData.map(ev => {
  const startDate = new Date(ev.start);
  const endDate = new Date(startDate.getTime() + ev.duration * 60 * 60 * 1000);

  return {
    title: ev.title,
    description: ev.description,
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
    url: ev.url
  };
});

// Création du fichier ICS
createEvents(events, (error, value) => {
  if (error) {
    console.log(error);
    return;
  }

  fs.writeFileSync('./public/calendar.ics', value);
  console.log('Fichier calendar.ics généré avec succès.');
});
