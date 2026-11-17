import { file, glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";
import { CATEGORIES, normalizeTag, type Category } from "./lib/articles";
import type { icons as lucideIcons } from '@iconify-json/lucide/icons.json';

const lucideIconSchema = z.object({
  type: z.literal("lucide"),
  name: z.custom<keyof typeof lucideIcons>(),
});

const socials = defineCollection({
  loader: file("src/content/socials.json"),
  schema: z.object({
    id: z.number(),
    icon: lucideIconSchema,
    text: z.string(),
    link: z.string().url(),
  })
});

const posts = defineCollection({
  loader: glob({ base: "src/content/posts", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    description: z.string(),
    // Une catégorie parmi la liste fermée de src/lib/articles.ts : le build échoue sur toute autre valeur
    category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
    // Tags libres, ramenés à une écriture unique (« SOC » = « soc », synonymes fusionnés) puis dédoublonnés
    tags: z.array(z.string()).transform((tags) => [...new Set(tags.map(normalizeTag).filter(Boolean))]),
    draft: z.boolean().optional().default(false),
    image: image().optional(),
    author: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ base: "src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().optional().default(false),
    image: image().optional(),
    link: z.string().url().optional(),
    author: z.string().optional(),
    info: z.array(
      z.object({
        text: z.string(),
        icon: lucideIconSchema,
        link: z.string().url().optional(),
      })
    )
  })
});

export const collections = { posts, projects, socials };