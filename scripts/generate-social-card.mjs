import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(root, 'dist/og.svg')).href);
  await page.screenshot({ path: resolve(root, 'public/og.png') });
} finally { await browser.close(); }
