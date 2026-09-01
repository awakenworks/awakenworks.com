import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  brandMarkAssetStem,
  brandMarkSchemes,
  publicBrandMarks,
  renderAdaptiveFaviconSvg,
  renderBrandMarkSvg,
} from '../src/lib/brandMarks.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'public/brand');
mkdirSync(output, { recursive: true });

for (const mark of publicBrandMarks) {
  for (const scheme of brandMarkSchemes) {
    writeFileSync(
      resolve(output, `${brandMarkAssetStem(mark)}-${scheme}.svg`),
      renderBrandMarkSvg(mark, scheme),
    );
  }
}

writeFileSync(resolve(root, 'public/favicon.svg'), renderAdaptiveFaviconSvg());
