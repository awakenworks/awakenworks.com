import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  ANALYTICS_CANARY_EVENT,
  DEFAULT_UMAMI_API_ENDPOINT,
  DEFAULT_UMAMI_SEND_ENDPOINT,
  DEFAULT_UMAMI_WEBSITE_ID,
} from '../src/config/analytics.mjs';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function buildCanaryPayload({ websiteId, host, revision, runId }) {
  return {
    payload: {
      hostname: host,
      language: 'en-US',
      referrer: '',
      screen: '0x0',
      title: 'AwakenWorks analytics release check',
      url: '/__analytics_canary',
      website: websiteId,
      name: ANALYTICS_CANARY_EVENT,
      data: {
        kind: 'deployment',
        revision,
        run_id: runId,
      },
    },
    type: 'event',
  };
}

export function hasCanary(response, runId, revision) {
  return Array.isArray(response?.data) && response.data.some((row) => {
    if (row.eventName !== ANALYTICS_CANARY_EVENT) return false;
    const properties = Object.fromEntries(
      (row.propertyKeys ?? []).map((key, index) => [key, row.propertyValues?.[index]]),
    );
    return properties.run_id === runId && properties.revision === revision;
  });
}

async function requireOk(response, label) {
  if (response.ok) return response;
  const body = await response.text();
  throw new Error(`${label}: status=${response.status}, body=${body.slice(0, 240)}`);
}

export async function checkAnalyticsLive({
  apiKey,
  websiteId = DEFAULT_UMAMI_WEBSITE_ID,
  sendEndpoint = DEFAULT_UMAMI_SEND_ENDPOINT,
  apiEndpoint = DEFAULT_UMAMI_API_ENDPOINT,
  host = 'awakenworks.com',
  revision,
  runId = randomUUID(),
  attempts = 6,
  intervalMs = 5_000,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) throw new Error('UMAMI_API_KEY is required for the analytics release gate');
  if (!revision) throw new Error('AWAKENWORKS_EXPECTED_REVISION is required for the analytics release gate');

  const startedAt = Date.now() - 10_000;
  const sendResponse = await fetchImpl(sendEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': `AwakenWorks-Analytics-Canary/${revision}`,
    },
    body: JSON.stringify(buildCanaryPayload({ websiteId, host, revision, runId })),
  });
  await requireOk(sendResponse, 'Umami canary send failed');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const query = new URLSearchParams({
      startAt: String(startedAt),
      endAt: String(Date.now() + 10_000),
      eventName: ANALYTICS_CANARY_EVENT,
      page: '1',
      pageSize: '100',
    });
    const response = await fetchImpl(
      `${apiEndpoint.replace(/\/$/u, '')}/websites/${encodeURIComponent(websiteId)}/event-data-pivot?${query}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `AwakenWorks-Analytics-Canary/${revision}`,
        },
      },
    );
    await requireOk(response, 'Umami canary query failed');
    if (hasCanary(await response.json(), runId, revision)) {
      return { runId, revision, attempt };
    }
    if (attempt < attempts) await delay(intervalMs);
  }
  throw new Error(`Umami canary was not observable after ${attempts} attempts: run_id=${runId}`);
}

async function main() {
  const result = await checkAnalyticsLive({
    apiKey: process.env.UMAMI_API_KEY,
    websiteId: process.env.UMAMI_WEBSITE_ID ?? process.env.PUBLIC_UMAMI_WEBSITE_ID,
    sendEndpoint: process.env.UMAMI_SEND_ENDPOINT,
    apiEndpoint: process.env.UMAMI_API_CLIENT_ENDPOINT,
    host: process.env.AWAKENWORKS_LIVE_HOST,
    revision: process.env.AWAKENWORKS_EXPECTED_REVISION,
  });
  process.stdout.write(`Analytics data plane OK: revision ${result.revision}, run_id=${result.runId}, attempt=${result.attempt}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Analytics live check failed: ${error.message}\n`);
    process.exit(1);
  });
}
