// Heures dans le fuseau du visiteur. Le site est construit en heure de Paris ; si le visiteur est ailleurs,
// on réécrit les dates marquées [data-dt] dans son fuseau et on précise l'heure de Paris entre parenthèses.
// Sans JavaScript, l'heure de Paris reste affichée, ce qui reste juste.

const PARIS = 'Europe/Paris';
const visitor = Intl.DateTimeFormat().resolvedOptions().timeZone;

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions, timeZone?: string) =>
  d.toLocaleString('fr-FR', { ...opts, timeZone });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const HOUR: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** Vrai si, à cette date, le visiteur n'a pas la même heure que Paris. */
export const differsFromParis = (d: Date) =>
  fmt(d, { ...HOUR, day: 'numeric' }) !== fmt(d, { ...HOUR, day: 'numeric' }, PARIS);

/** « 08:00 (14:00 à Paris) » hors de Paris, « 14:00 » sinon. */
export const hourWithParis = (d: Date) =>
  differsFromParis(d) ? `${fmt(d, HOUR)} (${fmt(d, HOUR, PARIS)} à Paris)` : fmt(d, HOUR, PARIS);

// Formats utilisés par le journal et la session mise en avant
const formats: Record<string, (d: Date) => string> = {
  day: (d) => fmt(d, { day: 'numeric' }),
  month: (d) => fmt(d, { month: 'short' }),
  'long-hour': (d) => `${cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))} à ${hourWithParis(d)}`,
  'full-hour': (d) => `${cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} à ${hourWithParis(d)}`,
};

export function localizeTimes(root: ParentNode = document) {
  if (visitor === PARIS) return;
  root.querySelectorAll<HTMLElement>('[data-dt][data-fmt]').forEach((el) => {
    const d = new Date(el.dataset.dt!);
    if (!differsFromParis(d)) return;
    const format = formats[el.dataset.fmt!];
    if (format) el.textContent = format(d);
  });
}
