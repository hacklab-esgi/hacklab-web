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
const noInlineScripts = {
  name: 'no-inline-scripts',
  hooks: {
    'astro:build:done': ({ dir }: { dir: URL }) => {
      const root = fileURLToPath(dir);
      const inline = /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/;
      const bad = (readdirSync(root, { recursive: true }) as string[])
        .filter((file) => file.endsWith('.html') && inline.test(readFileSync(root + file, 'utf8')));
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
      home: {
        title: 'HackLab ESGI'
      },
      about: {
        title: 'Le laboratoire'
      },
      join: {
        title: 'Nous rejoindre'
      },
      blog: {
        title: 'Articles'
      },
      projects: {
        title: 'Projets'
      }
    }
  }), noInlineScripts],
});