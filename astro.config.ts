import { defineConfig } from 'astro/config';

import expressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import spectre from './package/src';
import { spectreDark } from './src/ec-theme';
import rehypeSanitize from 'rehype-sanitize';
import { unified } from '@astrojs/markdown-remark';

// Les .md viennent des issues GitHub (contenu public) : on retire le HTML dangereux
// (<script>, onerror=, liens javascript:…). Les .mdx de l'équipe ne sont pas concernés.
const sanitizeUntrusted = () => {
  const sanitize = rehypeSanitize();
  return (tree: any, file: any) => (file.path?.endsWith('.md') ? sanitize(tree) : tree);
};

// https://astro.build/config
export default defineConfig({
  site: 'https://hacklab.esgi.fr',
  output: 'static',
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
  })],
});