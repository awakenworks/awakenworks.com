import { resolve4 } from 'node:dns/promises';

// Cause/effect test design for the public-domain release gate:
// C1 DNS can resolve while the registrar still serves a parked property.
// C2 HTTP can remain reachable without redirecting to HTTPS; C3 HTTPS can
// return a redirect whose terminal page is outside this site; C4 a 200 response
// can be unrelated HTML without the AwakenWorks identity; C5 HTML can load
// while its emitted CSS, JS, favicon, or public images return 404; C6 a home
// page can pass while product or localized routes fail; C7 www can resolve but
// present the wrong certificate or fail to redirect to the canonical apex;
// C8 a network failure must remain distinguishable from a content mismatch.
// E1 report resolved addresses for diagnosis; E2 require HTTP and www to end
// at the HTTPS apex; E3 reject /lander or parked-page content; E4 require a
// successful terminal response with canonical site copy; E5 require every
// emitted home asset to return its expected media type; E6 require core product
// and localized routes to return canonical site HTML; E7 exit non-zero for
// every unresolved release condition.
// Decision table:
// | Rule | DNS | HTTP/www terminal | apex HTML | assets | core routes | outcome |
// | D1   | yes | HTTPS apex        | expected  | 2xx/type| 2xx/canonical| pass   |
// | D2   | yes | HTTP/off-site     | any       | any     | any          | fail   |
// | D3   | yes | HTTPS apex        | parked/bad| any     | any          | fail   |
// | D4   | yes | HTTPS apex        | expected  | bad     | any          | fail   |
// | D5   | yes | HTTPS apex        | expected  | good    | bad          | fail   |
// | D6   | no  | any               | any       | any     | any          | fail   |
const host = process.env.AWAKENWORKS_LIVE_HOST ?? 'awakenworks.com';
const origin = `https://${host}`;
const canonicalPattern = /<link rel="canonical" href="https:\/\/awakenworks\.com(?:\/[^"#?]*)?">/;
const coreRoutes = ['/', '/agents/', '/objects/', '/workforce/', '/enterprise/', '/zh/'];
const assetPattern = /(?:href|src|poster)="(\/(?:[^"?#]+\.(?:css|js|svg|png|webp|jpe?g|gif|woff2?)))(?:[?#][^"]*)?"/gu;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchSiteHtml(url, label) {
  const response = await fetch(url, { redirect: 'follow' });
  const body = await response.text();
  const parked = response.url.includes('/lander') || /["']\/lander["']|domain.*(?:sale|parked)|godaddy/i.test(body);
  requireCondition(response.ok, `${label}: status=${response.status}, final=${response.url}`);
  requireCondition(new URL(response.url).origin === origin, `${label}: terminal origin=${response.url}`);
  requireCondition(!parked, `${label}: parked content at ${response.url}`);
  requireCondition(/AwakenWorks/.test(body) && canonicalPattern.test(body), `${label}: expected identity or canonical missing at ${response.url}`);
  return { body, response };
}

try {
  const addresses = await resolve4(host);
  process.stdout.write(`DNS ${host}: ${addresses.join(', ')}\n`);

  const httpResponse = await fetch(`http://${host}`, { redirect: 'follow' });
  requireCondition(httpResponse.ok && httpResponse.url === `${origin}/`, `HTTP must terminate at ${origin}/, found ${httpResponse.status} ${httpResponse.url}`);

  const home = await fetchSiteHtml(`${origin}/`, 'home');
  const assets = [...new Set([...home.body.matchAll(assetPattern)].map((match) => match[1]))];
  requireCondition(assets.some((path) => path.endsWith('.css')), 'home must emit at least one CSS asset');
  requireCondition(assets.some((path) => path.endsWith('.js')), 'home must emit at least one JavaScript asset');
  for (const path of assets) {
    const response = await fetch(new URL(path, origin));
    const contentType = response.headers.get('content-type') ?? '';
    const expectedType = path.endsWith('.css')
      ? 'text/css'
      : path.endsWith('.js')
        ? /(?:text|application)\/javascript/u
        : path.endsWith('.svg')
          ? 'image/svg+xml'
          : path.match(/\.(?:png|webp|jpe?g|gif)$/u)
            ? 'image/'
            : null;
    requireCondition(response.ok, `asset ${path}: status=${response.status}`);
    if (expectedType instanceof RegExp) {
      requireCondition(expectedType.test(contentType), `asset ${path}: unexpected content-type=${contentType}`);
    } else if (expectedType) {
      requireCondition(contentType.startsWith(expectedType), `asset ${path}: unexpected content-type=${contentType}`);
    }
  }

  for (const route of coreRoutes) await fetchSiteHtml(new URL(route, origin), `route ${route}`);

  const wwwResponse = await fetch(`https://www.${host}/`, { redirect: 'follow' });
  requireCondition(wwwResponse.ok && wwwResponse.url === `${origin}/`, `www must terminate at ${origin}/, found ${wwwResponse.status} ${wwwResponse.url}`);

  process.stdout.write(`Live site OK: ${coreRoutes.length} routes, ${assets.length} home assets, HTTPS apex + www\n`);
} catch (error) {
  process.stderr.write(`Live site check failed for ${origin}: ${error.message}\n`);
  process.exit(1);
}
