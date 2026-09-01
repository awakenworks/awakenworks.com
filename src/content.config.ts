import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { DOC_AUDIENCES, DOC_SECTIONS } from './lib/docsTaxonomy';
import { LANGS } from './i18n/locales';

// Blog posts live under src/content/blog/<lang>/<slug>.md
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('AwakenWorks'),
    lang: z.enum(LANGS as [typeof LANGS[number], ...typeof LANGS[number][]]),
    // Optional per-post brand override (e.g. an Awaken Workforce announcement → warm).
    brand: z.enum(['works', 'workforce']).optional(),
    draft: z.boolean().default(false),
  }),
});

// Product docs — versioned + bilingual:
//   src/content/docs/<product>/<version>/<lang>/<...slug>.md
// The `latest` version (per src/i18n/docsVersions.ts) is served at the
// unversioned URL; archived versions get a /<version>/ segment.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    // The description is the page's reader-facing purpose, not optional SEO
    // decoration. DocsPage renders it before the body for every public page.
    description: z.string().min(20).max(220),
    // Pages may name page-owned implementation evidence when a checked source
    // coordinate is available; check-docs.mjs validates every supplied value.
    evidence: z.array(z.string()).min(1).optional(),
    // Structural fields belong only to the English peer. Chinese pages keep
    // these optional and derive the same navigation from English at build time.
    audience: z.enum(DOC_AUDIENCES).optional(),
    section: z.enum(DOC_SECTIONS).optional(),
    subsection: z.string().optional(),
    order: z.number().optional(),
  }),
});

export const collections = { blog, docs };
