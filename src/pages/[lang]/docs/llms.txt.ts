import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildDocsLlmIndex } from '../../../lib/docsSearch';
import { localizedStaticPaths, type Lang } from '../../../i18n/locales';

export const prerender = true;
export const getStaticPaths = localizedStaticPaths;

export const GET: APIRoute = async ({ site, props }) => {
  const { lang } = props as { lang: Lang };
  const entries = await getCollection('docs');
  return new Response(buildDocsLlmIndex(entries, lang, site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
