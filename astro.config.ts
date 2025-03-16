import { defineConfig } from 'astro/config';

import expressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import spectre from './package/src';

import node from '@astrojs/node';
import { spectreDark } from './src/ec-theme';

// https://astro.build/config
export default defineConfig({
  site: 'https://hacklab-esgi.github.io',
  output: 'static',
  integrations: [
    expressiveCode({
      themes: [spectreDark],
    }),
    mdx(),
    sitemap(),
    spectre({
      name: 'HackLab ESGI',
      openGraph: {
        home: {
          title: 'HackLab ESGI',
          description: 'Home of the HackLab from ESGI school.'
        },
        blog: {
          title: 'Blog',
          description: 'News and articles for HackLab ESGI.'
        },
        projects: {
          title: 'Projects'
        }
      }
    })
  ],
  adapter: node({
    mode: 'standalone'
  })
});