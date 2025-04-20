const fs = require('fs');
const { createEvents } = require('ics');

// Chemin vers le fichier JSON des événements
const eventsData = JSON.parse(fs.readFileSync('/events/events.json', 'utf8'));

// Transformation des événements
const events = eventsData.map(ev => {
  const startDate = new Date(ev.start);
  const endDate = new Date(startDate.getTime() + ev.duration * 60 * 60 * 1000);

  const description = ev.description || '';
  const speakerInfo = ev.speaker ? `\n\nIntervenant(s) : ${ev.speaker}` : '';

const event = {
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
  };  
  if (ev.url && ev.url.trim() !== '') {
    event.url = ev.url;
  }

  return event;
});

// Création du fichier ICS
createEvents(events, (error, value) => {
  if (error) {
    console.log(error);
    return;
  }

  fs.writeFileSync('/calendar.ics', value);
  console.log('Fichier calendar.ics généré avec succès.');
});
