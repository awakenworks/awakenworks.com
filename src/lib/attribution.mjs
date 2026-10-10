export const ATTRIBUTION_KEY = 'awakenworks_attribution';
export const ATTRIBUTION_SCHEMA = 2;
export const ATTRIBUTION_CAMPAIGN_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
];

const TOUCH_KEYS = ['landing_page', 'referrer', ...ATTRIBUTION_CAMPAIGN_KEYS];

function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizedTouch(value = {}) {
  return Object.fromEntries(TOUCH_KEYS.map((key) => [key, stringValue(value[key])]));
}

function legacyTouch(value) {
  if (!isRecord(value)) return null;
  if (!TOUCH_KEYS.some((key) => typeof value[key] === 'string' && value[key])) return null;
  return normalizedTouch(value);
}

function currentTouch(href, referrer, params) {
  return normalizedTouch({
    landing_page: href,
    referrer,
    ...Object.fromEntries(ATTRIBUTION_CAMPAIGN_KEYS.map((key) => [key, params.get(key) ?? ''])),
  });
}

export function evolveAttribution(previous, href, referrer = '') {
  const params = new URL(href).searchParams;
  const incoming = currentTouch(href, referrer, params);
  const hasCampaign = ATTRIBUTION_CAMPAIGN_KEYS.some((key) => params.has(key));
  const isCurrent = previous?.schema === ATTRIBUTION_SCHEMA
    && isRecord(previous.first)
    && isRecord(previous.last);
  const migrated = isCurrent ? null : legacyTouch(previous);
  const first = normalizedTouch(isCurrent ? previous.first : migrated ?? incoming);
  const priorLast = normalizedTouch(isCurrent ? previous.last : migrated ?? incoming);

  return {
    schema: ATTRIBUTION_SCHEMA,
    first,
    last: hasCampaign || !priorLast.landing_page ? incoming : priorLast,
  };
}

export function captureAttribution({
  storage,
  href = globalThis.location?.href,
  referrer = globalThis.document?.referrer ?? '',
} = {}) {
  if (storage === undefined) {
    try { storage = globalThis.sessionStorage; } catch (_error) { storage = null; }
  }
  if (!storage || !href) return evolveAttribution({}, href ?? 'https://awakenworks.com/', referrer);
  let previous = {};
  try {
    previous = JSON.parse(storage.getItem(ATTRIBUTION_KEY) || '{}');
  } catch (_error) {
    previous = {};
  }
  const next = evolveAttribution(previous, href, referrer);
  try {
    storage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  } catch (_error) {}
  return next;
}

export function attributionFormValues(attribution) {
  const state = attribution?.schema === ATTRIBUTION_SCHEMA
    ? attribution
    : evolveAttribution(attribution ?? {}, 'https://awakenworks.com/');
  return {
    landing_page: state.last.landing_page,
    referrer: state.last.referrer,
    ...Object.fromEntries(ATTRIBUTION_CAMPAIGN_KEYS.map((key) => [key, state.last[key]])),
    first_landing_page: state.first.landing_page,
    first_referrer: state.first.referrer,
    ...Object.fromEntries(ATTRIBUTION_CAMPAIGN_KEYS.map((key) => [`first_${key}`, state.first[key]])),
  };
}
