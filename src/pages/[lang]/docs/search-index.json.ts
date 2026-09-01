import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildDocsSearchIndex } from '../../../lib/docsSearch';
import { localizedStaticPaths, type Lang } from '../../../i18n/locales';

export const prerender = true;
export const getStaticPaths = localizedStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { lang } = props as { lang: Lang };
  const entries = await getCollection('docs');
  return new Response(JSON.stringify(buildDocsSearchIndex(entries, lang)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
