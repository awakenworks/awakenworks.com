import type { APIRoute } from 'astro';
import { renderBrandMarkSvg } from '@awaken/ui/brand';
import { canonicalEntities, publicProductEntries } from '../i18n/content';

export const prerender = true;
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const lines = (value: string, limit: number) => {
  const result: string[] = [];
  for (const word of value.split(' ')) {
    if (!result.length || result.at(-1)!.length + word.length + 1 > limit) result.push(word);
    else result[result.length - 1] += ` ${word}`;
  }
  return result;
};
const mark = (name: 'works' | 'agents' | 'workforce', x: number, y: number, size: number) =>
  renderBrandMarkSvg(name, 'on-dark').replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `);

// Same product and brand owners as the homepage; PNG is a rendered derivative.
export const GET: APIRoute = () => new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#0b0d13"/><rect width="1200" height="6" fill="#a392ff"/>
${mark('works', 72, 83, 64)}
<g fill="#f1f2f7" font-family="Arial, sans-serif"><text x="156" y="143" font-size="68" font-weight="700">AwakenWorks</text>
${lines(canonicalEntities.en.company, 64).map((line, index) => `<text x="80" y="220" dy="${index * 38}" fill="#b4b8c9" font-size="29">${escape(line)}</text>`).join('')}
${publicProductEntries('en').map((product, index) => {
  const x = 80 + index * 540;
  return `<g data-product="${product.key}"><rect x="${x}" y="320" width="500" height="230" rx="12" fill="#121622" stroke="#34394b"/>
${mark(product.key, x + 24, 346, 36)}<text x="${x + 76}" y="375" font-size="30" font-weight="700">${escape(product.name)}</text>
<text x="${x + 24}" y="416" fill="#a392ff" font-size="19">${escape(product.role)}</text>
${lines(product.tagline, 42).map((line, row) => `<text x="${x + 24}" y="455" dy="${row * 27}" fill="#b4b8c9" font-size="20">${escape(line)}</text>`).join('')}</g>`;
}).join('')}
<text x="80" y="589" fill="#8c93aa" font-size="20">awakenworks.com</text></g></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } });
