const DEFAULT_SITE_URL = 'https://awakenworks.com';

export function normalizeSiteUrl(value = DEFAULT_SITE_URL) {
  const url = new URL(value);
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`AWAKENWORKS_SITE_URL must be an origin, received: ${value}`);
  }
  return url.origin;
}

export function normalizeBasePath(value = '/') {
  const raw = value.trim();
  if (!raw || raw === '/') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || /[?#]/.test(raw)) {
    throw new Error(`AWAKENWORKS_BASE_PATH must be a root-relative path, received: ${value}`);
  }
  return raw.replace(/\/+$/u, '');
}

const environment = typeof process === 'undefined' ? {} : process.env;

export const siteUrl = normalizeSiteUrl(environment.AWAKENWORKS_SITE_URL);
export const siteBasePath = normalizeBasePath(environment.AWAKENWORKS_BASE_PATH);

export function withSiteBase(value, basePath = siteBasePath) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return value;
  }
  const base = normalizeBasePath(basePath);
  if (base === '/') return value;
  const boundary = value.at(base.length);
  if (value.startsWith(base) && (!boundary || ['/', '?', '#'].includes(boundary))) {
    return value;
  }
  return `${base}${value}`;
}

export function withoutSiteBase(value, basePath = siteBasePath) {
  if (typeof value !== 'string') return value;
  const base = normalizeBasePath(basePath);
  if (base === '/') return value;
  if (value === base) return '/';
  if (value.startsWith(`${base}/`)) return value.slice(base.length) || '/';
  return value;
}

export function siteHref(path = '/', origin = siteUrl, basePath = siteBasePath) {
  return new URL(withSiteBase(path, basePath), `${normalizeSiteUrl(origin)}/`).href;
}
