import { defineConfig } from 'astro/config';

import expressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import spectre from './package/src';
import netlify from '@astrojs/netlify';
import { spectreDark } from './src/ec-theme';
import rehypeSanitize from 'rehype-sanitize';

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
    rehypePlugins: [sanitizeUntrusted],
  },
  integrations: [expressiveCode({
    themes: [spectreDark],
  }), mdx(), sitemap(), spectre({
    name: 'HackLab ESGI',
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
  adapter:  netlify(),
});