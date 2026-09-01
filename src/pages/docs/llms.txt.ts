import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildDocsLlmIndex } from '../../lib/docsSearch';

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const entries = await getCollection('docs');
  return new Response(buildDocsLlmIndex(entries, 'en', site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
