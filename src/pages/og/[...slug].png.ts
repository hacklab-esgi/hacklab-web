import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { sessions } from '../../lib/sessions';

// Image de partage (Open Graph) générée au build pour chaque article/projet (même s'il a sa propre image)
// et pour les pages principales du site, toutes au même format.
// Police embarquée : le build ne dépend pas des polices installées sur la machine (aucune sur Netlify).
const FONT = resolve('src/assets/fonts/CascadiaCode-Bold.ttf');
const W = 1200;
const H = 630;
const TEXT_WIDTH = 900;
// Violet doux du site (--accent-past)
const ACCENT = '#BB86FC';

// Markup Pango : on échappe & < >, et on retire les emojis (pas de glyphe dans la police)
const escape = (s: string) =>
  s
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();

const text = (value: string, color: string, size: number) =>
  sharp({
    text: {
      text: `<span foreground="${color}">${escape(value)}</span>`,
      font: `Cascadia Code Bold ${size}`,
      fontfile: FONT,
      width: TEXT_WIDTH,
      wrap: 'word',
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

export const getStaticPaths = (async () => {
  const [posts, projects] = await Promise.all([
    getCollection('posts', (post) => !post.data.draft),
    getCollection('projects', (project) => !project.data.draft),
  ]);

  const since = sessions[0].start.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', month: 'long', year: 'numeric' });
  // Pages du site : un titre et une phrase à la place de la date et de l'auteur
  const pages = [
    { name: 'accueil', title: 'Laboratoire associatif de cybersécurité de l’ESGI', meta: 'Sessions, articles et projets des étudiants' },
    { name: 'laboratoire', title: 'Le laboratoire', meta: 'L’équipe, le projet et les partenaires' },
    { name: 'rejoindre', title: 'Nous rejoindre', meta: 'Ouvert à tous, sans sélection' },
    { name: 'articles', title: 'Articles des membres', meta: 'Recherches, outils et retours d’expérience' },
    { name: 'projets', title: 'Projets des membres', meta: 'Outils, scripts et recherches' },
    { name: 'agenda', title: 'Agenda des sessions', meta: `${sessions.length} sessions depuis ${since}` },
  ];

  return [
    ...pages.map((page) => ({ params: { slug: `pages/${page.name}` }, props: { title: page.title, meta: page.meta } })),
    ...posts.map((post) => ({
      params: { slug: `blog/${post.id}` },
      props: { title: post.data.title, date: post.data.createdAt, author: post.data.author },
    })),
    ...projects.map((project) => ({
      params: { slug: `projects/${project.id}` },
      props: { title: project.data.title, date: project.data.date, author: project.data.author },
    })),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { date, author } = props as { date?: Date; author?: string; meta?: string };
  // Au-delà, même en petite taille, le titre déborderait de la carte
  const title: string = props.title.length > 140 ? `${props.title.slice(0, 139).trimEnd()}…` : props.title;
  const meta: string = props.meta ?? [date?.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }), author && `@${author}`].filter(Boolean).join('  ·  ');

  // Titre long : police plus petite pour tenir dans la carte
  let heading = await text(title, '#ffffff', 60);
  if (heading.info.height > 280) heading = await text(title, '#ffffff', 44);

  const [brand, footer, logo] = await Promise.all([
    text('HackLab ESGI', ACCENT, 34),
    text(meta, '#c7c7c7', 28),
    // Logo non carré : redimensionné en hauteur, sans recadrage
    sharp('public/favicon.png').resize({ height: 112 }).toBuffer({ resolveWithObject: true }),
  ]);

  const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="100%" height="100%" fill="#121212"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="24" fill="none" stroke="#353535" stroke-width="2"/>
    <rect x="80" y="160" width="72" height="6" fill="${ACCENT}"/>
  </svg>`);

  const png = await sharp(frame)
    .composite([
      { input: brand.data, left: 80, top: 96 },
      { input: logo.data, left: W - 80 - logo.info.width, top: 72 },
      { input: heading.data, left: 80, top: 200 },
      { input: footer.data, left: 80, top: H - 80 - footer.info.height },
    ])
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
