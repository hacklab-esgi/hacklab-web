import type { APIRoute } from 'astro';

// Fichier standard (RFC 9116) : où signaler une faille du site.
// « Expires » est recalculé à chaque build (le site est reconstruit à chaque événement ajouté) : jamais périmé.
export const GET: APIRoute = ({ site }) => {
  const expires = new Date(Date.now() + 300 * 24 * 3600 * 1000).toISOString();
  const lines = [
    'Contact: mailto:hacklab.esgi@gmail.com',
    `Expires: ${expires}`,
    'Preferred-Languages: fr, en',
    `Canonical: ${new URL('/.well-known/security.txt', site)}`,
    'Policy: https://github.com/hacklab-esgi/hacklab-web/blob/master/SECURITY.md',
  ];
  return new Response(`${lines.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
