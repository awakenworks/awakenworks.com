// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mermaid from 'astro-mermaid';
import sitemap from '@astrojs/sitemap';
import { siteBasePath, siteUrl } from './src/config/siteDeployment.mjs';
import { DEFAULT_LANG, LANGS, localeRegistry } from './src/i18n/locales';
import prefixMarkdownSiteUrls from './src/lib/prefixMarkdownSiteUrls.mjs';

// Mermaid theme aligned with the Awaken visual system. Theme variables are neutral grey
// anchors mermaid uses for derived colours; the visible chrome is driven by our
// brand tokens in themeCSS, which resolve at paint time against <html> and so
// auto-flip with data-theme / data-brand (cold indigo vs warm amber).
const mermaidThemeCSS = `
  .node rect, .node circle, .node ellipse, .node polygon, .node path {
    fill: color-mix(in oklch, var(--color-accent-500) 12%, transparent) !important;
    stroke: var(--color-accent-500) !important;
    stroke-width: 1px !important;
  }
  .cluster rect {
    fill: var(--color-ink-900) !important;
    stroke: var(--color-ink-700) !important;
    stroke-width: 1px !important;
  }
  .edgePath .path, .flowchart-link {
    stroke: var(--color-ink-600) !important;
    stroke-width: 1.5px !important;
  }
  .arrowheadPath, marker path {
    fill: var(--color-ink-600) !important;
    stroke: var(--color-ink-600) !important;
  }
  text { fill: var(--color-fog-100) !important; }
  foreignObject *, foreignObject span, foreignObject p, foreignObject div, foreignObject {
    color: var(--color-fog-100) !important;
  }
  .nodeLabel, .edgeLabel, .cluster-label .nodeLabel, .label {
    fill: var(--color-fog-100) !important;
    color: var(--color-fog-100) !important;
  }
  g.edgeLabel rect, g.edgeLabel .labelBkg, g.edgeLabel span.edgeLabel, g.edgeLabel p {
    fill: var(--color-ink-850) !important;
    background: var(--color-ink-850) !important;
    opacity: 1 !important;
  }
  g.edgeLabel .labelBkg {
    border-radius: 4px;
    padding: 1px 3px;
  }
  .actor {
    fill: color-mix(in oklch, var(--color-accent-500) 12%, transparent) !important;
    stroke: var(--color-accent-500) !important;
  }
  .actor-line { stroke: var(--color-ink-600) !important; }
  text.actor, text.actor > tspan, .actor-man, .actor-man text {
    fill: var(--color-fog-100) !important;
  }
  .messageLine0, .messageLine1 { stroke: var(--color-fog-500) !important; }
  .messageText { fill: var(--color-fog-100) !important; stroke: none !important; }
  .labelBox { fill: var(--color-ink-900) !important; stroke: var(--color-ink-700) !important; }
  .labelText, .labelText > tspan { fill: var(--color-fog-100) !important; }
  .loopText, .loopText > tspan, .loopLine { stroke: var(--color-ink-600) !important; }
  .loopText, .loopText > tspan { fill: var(--color-fog-100) !important; stroke: none !important; }
  .note { fill: var(--color-ink-900) !important; stroke: var(--color-ink-700) !important; }
  .noteText, .noteText > tspan { fill: var(--color-fog-100) !important; }
  rect.rect { fill: var(--color-ink-800) !important; stroke: var(--color-ink-700) !important; }
`;

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  base: siteBasePath,
  i18n: {
    defaultLocale: DEFAULT_LANG,
    locales: LANGS,
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    // Auto-generated at build time so the sitemap can't drift from the routes.
    // Emits hreflang alternates matching the i18n routing (en at root, zh under /zh).
    sitemap({
      i18n: {
        defaultLocale: DEFAULT_LANG,
        locales: Object.fromEntries(
          LANGS.map((lang) => [lang, localeRegistry[lang].hrefLang]),
        ),
      },
    }),
    mermaid({
      theme: 'base',
      // themeCSS uses var(--color-*) which auto-flips via data-theme, so a
      // single render covers both light and dark.
      autoTheme: false,
      mermaidConfig: {
        themeVariables: {
          fontFamily:
            "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: '13px',
          primaryColor: '#cccccc',
          primaryBorderColor: '#888888',
          primaryTextColor: '#444444',
          lineColor: '#999999',
        },
        themeCSS: mermaidThemeCSS,
      },
    }),
  ],
  markdown: {
    // Markdown owns most documentation links. Prefix them at compilation with
    // the same deployment authority used by Astro and application navigation.
    rehypePlugins: [[prefixMarkdownSiteUrls, { basePath: siteBasePath }]],
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Mermaid is loaded only on pages that contain a diagram, and Vite
      // already splits its diagram definitions into lazy chunks. Its core and
      // Wardley chunks sit just above Vite's generic 500 kB default, so keep a
      // tight limit that reflects this intentional client-side boundary.
      chunkSizeWarningLimit: 650,
    },
  },
});
