import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildDocsSearchIndex } from '../../lib/docsSearch';

export const prerender = true;

export const GET: APIRoute = async () => {
  const entries = await getCollection('docs');
  return new Response(JSON.stringify(buildDocsSearchIndex(entries, 'en')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
