// Sessions du HackLab, lues depuis events.json (même source que le calendrier et le fichier ICS)
import events from '../../public/events/events.json';

export interface Session {
  number: number;
  start: Date;
  title: string;
  place: string;
  speaker: string;
  description: string;
  url?: string;
}

// Les lieux et descriptions contiennent parfois du HTML (liens Discord, <br>, mentions de salon <#…>)
const toText = (html = '') =>
  html
    .replace(/<\/?br\s*\/?>/gi, '\n')
    .replace(/<#\d+>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();

// Même règle que generate-ics.cjs : une date sans fuseau est une heure de Paris (été/hiver gérés)
const parisOffset = (date: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map(({ type, value }) => [type, Number(value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
};
const parseStart = (value: string) => {
  if (/(Z|[+-]\d\d:?\d\d)$/.test(value)) return new Date(value);
  const asUtc = new Date(`${value}Z`);
  // Deux passes : le décalage est recalculé à l'heure estimée (juste autour du changement d'heure)
  const guess = new Date(asUtc.getTime() - parisOffset(asUtc));
  return new Date(asUtc.getTime() - parisOffset(guess));
};

const all = events
  .map((ev) => ({ ...ev, startDate: parseStart(ev.start) }))
  .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

// Les entraînements CTF (« type »: « training », créés par le bot Discord) ont leur propre ligne sur l'accueil
// et leur propre abonnement : ils ne comptent pas dans le journal des sessions.
const isTraining = (ev: object) => (ev as { type?: string }).type === 'training';

const toSession = (ev: (typeof all)[number], i: number): Session => ({
  number: i + 1,
  start: ev.startDate,
  title: ev.title.trim(),
  place:
    toText(ev.location)
      .replace(/Discord (du )?HackLab ESGI/g, 'Discord')
      .replace(/\+\s*&\s*/g, '+ ') || 'Lieu à confirmer',
  speaker: toText(ev.speaker),
  description: toText(ev.description),
  // Lien affiché tel quel dans le journal : http(s) uniquement (pas de javascript:)
  url: /^https?:\/\//i.test(ev.url?.trim() ?? '') ? ev.url.trim() : undefined,
});

/** Toutes les sessions, de la plus ancienne (n° 1) à la plus récente. */
export const sessions: Session[] = all.filter((ev) => !isTraining(ev)).map(toSession);

/** Les entraînements CTF, du plus ancien au plus récent. */
export const trainings: Session[] = all.filter(isTraining).map(toSession);

// Le build tourne en UTC (Netlify) : toujours formater en heure de Paris
const PARIS = { timeZone: 'Europe/Paris' } as const;
export const formatDay = (d: Date) => d.toLocaleDateString('fr-FR', { ...PARIS, day: 'numeric', month: 'short', year: 'numeric' });
export const formatLongDay = (d: Date) => d.toLocaleDateString('fr-FR', { ...PARIS, weekday: 'long', day: 'numeric', month: 'long' });
export const formatHour = (d: Date) => d.toLocaleTimeString('fr-FR', { ...PARIS, hour: '2-digit', minute: '2-digit' });
