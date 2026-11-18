import { defineConfig } from 'astro/config';

import expressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import spectre from './package/src';
import { spectreDark } from './src/ec-theme';
import rehypeSanitize from 'rehype-sanitize';
import { unified } from '@astrojs/markdown-remark';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Les .md viennent des issues GitHub (contenu public) : on retire le HTML dangereux
// (<script>, onerror=, liens javascript:…). Les .mdx de l'équipe ne sont pas concernés.
const sanitizeUntrusted = () => {
  const sanitize = rehypeSanitize();
  return (tree: any, file: any) => (file.path?.endsWith('.md') ? sanitize(tree) : tree);
};

// La politique de sécurité (public/_headers) n'autorise que les scripts servis en fichiers.
// Un <script is:inline> marcherait en local mais serait bloqué en ligne : le build échoue s'il en reste un.
// La page est lue balise par balise, valeurs d'attributs comprises : un « <script> » cité dans un attribut
// (bouton « copier » d'un bloc de code, description d'un article sur les XSS) n'est pas une balise.
const TAG = /<!--[\s\S]*?-->|<\/?[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>/g;
const hasInlineScript = (html: string) =>
  (html.match(TAG) ?? []).some((tag) => /^<script\b/i.test(tag) && !/\ssrc=/i.test(tag) && !tag.includes('application/ld+json'));
console.assert(hasInlineScript('<p>a</p><script>x()</script>'), 'hasInlineScript : script en ligne non détecté');
console.assert(
  !hasInlineScript('<meta content="un <script> cité"><button data-code="<script>x()</script>"></button><script type="module" src="/a.js"></script><!-- <script> -->'),
  'hasInlineScript : faux positif',
);
const noInlineScripts = {
  name: 'no-inline-scripts',
  hooks: {
    'astro:build:done': ({ dir }: { dir: URL }) => {
      const root = fileURLToPath(dir);
      const bad = (readdirSync(root, { recursive: true }) as string[])
        .filter((file) => file.endsWith('.html') && hasInlineScript(readFileSync(root + file, 'utf8')));
      if (bad.length) throw new Error(`Script en ligne interdit par la CSP dans : ${bad.join(', ')}. Retirer « is:inline » du <script>.`);
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://www.hacklab-esgi.fr',
  output: 'static',
  // Tous les scripts sortent en fichiers (aucun script en ligne), voir noInlineScripts
  vite: { build: { assetsInlineLimit: 0 } },
  markdown: {
    processor: unified({
      rehypePlugins: [sanitizeUntrusted],
    }),
  },
  integrations: [expressiveCode({
    themes: [spectreDark],
  }), mdx(), sitemap(), spectre({
    name: 'HackLab ESGI',
    themeColor: '#121212', // couleur de la navbar : barre d'état mobile assortie
    openGraph: {
      // Titres : « | HackLab ESGI » est ajouté par le Layout. Descriptions : le texte affiché sous le lien dans Google.
      home: {
        title: 'HackLab ESGI, le laboratoire associatif de cybersécurité de l’ESGI',
        description: 'Le HackLab ESGI est le laboratoire associatif de cybersécurité de l’ESGI : sessions, articles et projets présentés par des étudiants et des alumni.'
      },
      about: {
        title: 'Le laboratoire',
        description: 'Un laboratoire étudiant libre dédié à la cybersécurité : l’équipe de bénévoles, le projet, le déroulement des sessions et les partenaires du HackLab ESGI.'
      },
      join: {
        title: 'Nous rejoindre',
        description: 'Rejoindre le HackLab ESGI : sans sélection, ouvert à tous les niveaux. Suivez les sessions, proposez un sujet de conférence ou un atelier.'
      },
      blog: {
        title: 'Articles',
        description: 'Les articles des membres du HackLab ESGI : recherches en sécurité offensive et défensive, outils et retours d’expérience.'
      },
      projects: {
        title: 'Projets',
        description: 'Les outils, scripts et recherches en cybersécurité développés par les membres du HackLab ESGI.'
      }
    }
  }), noInlineScripts],
});