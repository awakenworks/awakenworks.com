export const DEFAULT_UMAMI_WEBSITE_ID = '59dd9ed4-a538-4fd3-98f4-c9ab7ded1d57';
export const DEFAULT_UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';
export const DEFAULT_UMAMI_SEND_ENDPOINT = 'https://cloud.umami.is/api/send';
export const DEFAULT_UMAMI_API_ENDPOINT = 'https://api.umami.is/v1';
export const ANALYTICS_CANARY_EVENT = 'analytics_canary';

// One best-effort SDK boundary serves clicks and form lifecycle events. A
// collector failure must never change navigation or a submitted form's result.
export function trackEvent(name, data, sdk = globalThis.window?.umami) {
  if (typeof sdk?.track !== 'function') return;
  try { void Promise.resolve(sdk.track(name, data)).catch(() => {}); }
  catch { /* The product action retains its own outcome. */ }
}
