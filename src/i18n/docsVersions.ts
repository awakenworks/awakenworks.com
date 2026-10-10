// Versioned docs registry — one entry list per route collection, newest first.
// `platform` and `harness` are one public Awaken release line. They remain
// separate here only because their canonical content and archive paths differ.
//
// URL convention:
//   • the `latest` version is served at the unversioned path, e.g.
//       /docs/workforce/quickstart
//   • archived versions live under a version segment, e.g.
//       /docs/workforce/v0.1/quickstart
//
// Each collection has one current version today. Adding a version later = add
// an entry here + its content; the selector, banner, and routing pick it up
// automatically.

import type { Lang } from './locales';
import provenance from '../../config/source-provenance.json' with { type: 'json' };

export type { Lang } from './locales';
export type VersionStatus = 'dev' | 'stable' | 'archived';
export type DocsProduct = 'flow' | 'harness' | 'platform';
// One public product catalog feeds navigation, cards, docs and request choices.
// Objects retains its technical routes and domain ownership inside Workforce.
export const publicProducts = {
  agents: { path: '/agents', docsPath: '/docs/agents', tone: 'iris', status: 'source-available-pre-release' },
  workforce: { path: '/workforce', docsPath: '/docs/workforce', tone: 'rust', status: 'early-preview' },
} as const;
export type PublicProduct = keyof typeof publicProducts;
export type PublicCapability = 'objects';
export type ProductStatus = 'source-available-pre-release' | 'early-preview';
export const capabilityOwner: Record<PublicCapability, PublicProduct> = { objects: 'workforce' };

export interface DocsVersion {
  /** 'current' for the latest (unversioned) path; otherwise the URL segment. */
  id: string;
  /** Display label, e.g. 'v0.0.0-dev'. Same in both locales. */
  label: string;
  status: VersionStatus;
  /** The version served at the unversioned path. Exactly one per product. */
  latest?: boolean;
  /** Exact committed source base used for the current documentation audit. */
  sourceRevision: string;
  /** Date on which the public claims were checked against that source base. */
  verifiedOn: string;
}

// Both Agent documentation collections share one release record. The committed
// provenance lock owns source identity; route collections do not repin it.
const agentsVersions: DocsVersion[] = [{
    id: 'current',
    label: 'v1.0.0-dev',
    status: 'dev',
    latest: true,
    sourceRevision: provenance.repositories.awaken.revision,
    verifiedOn: '2026-08-31',
}];
export const docsVersions: Record<DocsProduct, DocsVersion[]> = {
  harness: agentsVersions,
  platform: agentsVersions,
  flow: [{
    id: 'current',
    label: 'v0.1.0',
    status: 'dev',
    latest: true,
    sourceRevision: provenance.repositories.flow.revision,
    verifiedOn: '2026-08-31',
  }],
};

export function versionsFor(product: string): DocsVersion[] {
  return (docsVersions as Record<string, DocsVersion[]>)[product] ?? [];
}

export function currentVersion(product: string): DocsVersion | undefined {
  const list = versionsFor(product);
  return list.find((v) => v.latest) ?? list[0];
}

export const statusLabel: Record<VersionStatus, Record<Lang, string>> = {
  dev: { en: 'In development', zh: '开发版' },
  stable: { en: 'Stable', zh: '稳定版' },
  archived: { en: 'Archived', zh: '历史版本' },
};

export const devBanner: Record<Lang, (label: string) => string> = {
  en: (label) =>
    `You're reading pre-release documentation (${label}). Interfaces and behavior may change before a stable release.`,
  zh: (label) => `你正在阅读发布前文档（${label}）。接口与行为在稳定发布前仍可能变化。`,
};

const docsProductOwner: Record<DocsProduct, PublicProduct> = {
  flow: 'workforce',
  harness: 'agents',
  platform: 'agents',
};

export function publicProductLabel(product: PublicProduct | PublicCapability, lang: Lang): string {
  const owner = product in capabilityOwner ? capabilityOwner[product as PublicCapability] : product as PublicProduct;
  if (publicProducts[owner].status === 'source-available-pre-release') {
    return publicProductLabels[lang].openSource;
  }
  return publicProductLabels[lang].earlyPreview;
}

const publicProductLabels: Record<Lang, { openSource: string; earlyPreview: string }> = {
  en: { openSource: 'Source available · pre-release', earlyPreview: 'Preview access by request' },
  zh: { openSource: '源码可评估 · 尚无稳定发布包', earlyPreview: '需申请预览' },
};

export function publicVersionLabel(product: DocsProduct, lang: Lang): string {
  return publicProductLabel(docsProductOwner[product], lang);
}

export const archivedBanner: Record<Lang, (label: string) => string> = {
  en: (label) => `You're viewing an archived version (${label}).`,
  zh: (label) => `你正在查看历史版本(${label})。`,
};
