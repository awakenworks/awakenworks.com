import { withSiteBase, withoutSiteBase } from '../config/siteDeployment.mjs';

export const localeRegistry = {
  en: {
    pathPrefix: '',
    htmlLang: 'en',
    hrefLang: 'en',
    ogLocale: 'en_US',
    nativeName: 'English',
    shortName: 'EN',
  },
  zh: {
    pathPrefix: 'zh',
    htmlLang: 'zh-CN',
    hrefLang: 'zh-Hans',
    ogLocale: 'zh_CN',
    nativeName: '中文',
    shortName: '中',
  },
} as const;

export type Lang = keyof typeof localeRegistry;

export const DEFAULT_LANG: Lang = 'en';
export const LANGS = Object.keys(localeRegistry) as Lang[];
export const NON_DEFAULT_LANGS = LANGS.filter(
  (lang): lang is Exclude<Lang, typeof DEFAULT_LANG> => lang !== DEFAULT_LANG,
);

export function isLang(value: string | undefined): value is Lang {
  return Boolean(value && value in localeRegistry);
}

export function canonicalLocalePath(lang: Lang, path = ''): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const prefix = localeRegistry[lang].pathPrefix;
  return `/${[prefix, clean].filter(Boolean).join('/')}`;
}

export function localePath(lang: Lang, path = ''): string {
  return withSiteBase(canonicalLocalePath(lang, path));
}

export function localeFromPath(pathname: string): Lang {
  const firstSegment = withoutSiteBase(pathname).split('/').filter(Boolean)[0];
  return LANGS.find(
    (lang) => localeRegistry[lang].pathPrefix === firstSegment,
  ) ?? DEFAULT_LANG;
}

export function unlocalizedPath(pathname: string): string {
  const logicalPath = withoutSiteBase(pathname);
  const lang = localeFromPath(logicalPath);
  const prefix = localeRegistry[lang].pathPrefix;
  if (!prefix) return logicalPath.replace(/\/+$/, '') || '/';
  return logicalPath.replace(new RegExp(`^/${prefix}(?=/|$)`), '').replace(/\/+$/, '') || '/';
}

export function localizedStaticPaths() {
  return NON_DEFAULT_LANGS.map((lang) => ({ params: { lang }, props: { lang } }));
}

// Interactive language navigation keeps the same page, intent and fragment.
// Canonical/hreflang URLs continue using localePath without request context.
export function localeNavigationHref(destination: string, href: string): string {
  const source = new URL(href);
  const target = new URL(destination, source);
  if (target.origin !== source.origin) throw new Error('Language navigation must stay on this website');
  // The server-rendered destination already projects locale and deployment base.
  target.search = source.search;
  target.hash = source.hash;
  return `${target.pathname}${target.search}${target.hash}`;
}
