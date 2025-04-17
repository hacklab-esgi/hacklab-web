import { defineConfig } from 'astro/config';

import expressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import spectre from './package/src';
import staticAdapter from '@astrojs/adapter-static';
import { spectreDark } from './src/ec-theme';

// https://astro.build/config
export default defineConfig({
  site: 'https://hacklabesgi.netlify.app/',
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
    })
  ],
  adapter: staticAdapter()
});