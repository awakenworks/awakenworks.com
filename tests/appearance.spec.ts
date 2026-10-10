import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { currentVersion } from "../src/i18n/docsVersions";
import { content, REFUND_SCENARIO_KEY } from "../src/i18n/content";
import { localeNavigationHref } from "../src/i18n/locales";

// Site integration decision table: language en/zh x desktop/narrow, across all
// four route identities and the documentation shell. Legacy stored light wins
// over OS dark; explicit dark survives route changes/refresh; system resumes OS.
// Product routes must never reset brightness, duplicate persistence, or hide the
// native theme selector. Chinese 390px previously overflowed by 11px: the docs
// chrome must wrap into available rows; search retains its name with hidden text.
// Runtime failure combinations live in @awaken/ui tests.
for (const lang of ["en", "zh"]) {
  for (const width of [1280, 390, 320]) {
    test(`${lang} ${width}px preserves one appearance across product and docs routes`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.addInitScript(() => {
        if (!localStorage.getItem("appearance-fixture-initialized")) {
          localStorage.setItem("theme", "light");
          localStorage.setItem("appearance-fixture-initialized", "true");
        }
      });
      const base = lang === "zh" ? "/zh" : "";
      await page.goto(`${base}/`);
      const appearance = page.getByRole("combobox", { name: lang === "zh" ? "外观" : "Appearance" });
      await expect(appearance).toHaveValue("light");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
      // Radius projection: existing Tailwind surfaces resolve the shared family
      // radius rather than retaining an independent utility scale. Pill shapes
      // remain semantic pills and are excluded from this surface rule.
      const surface = page.locator(".rounded-xl").first();
      await expect(surface).toHaveCSS("border-top-left-radius", "4px");
      await appearance.selectOption("dark");
      // M1 en/zh x desktop/390/320: native disclosures must dismiss on Escape
      // with trigger focus, outside pointer, or focus leaving the menu. M2 two
      // desktop menus -> exactly one open. Dismissal never changes appearance.
      const menuTrigger = page.locator('header [data-site-menu] > summary:visible').first();
      const menu = menuTrigger.locator('..');
      await menuTrigger.click();
      await expect(menu).toHaveAttribute('open', '');
      await page.keyboard.press('Escape');
      await expect(menu).not.toHaveAttribute('open', '');
      await expect(menuTrigger).toBeFocused();
      await menuTrigger.click();
      await page.mouse.click(width - 4, 896);
      await expect(menu).not.toHaveAttribute('open', '');
      await menuTrigger.click();
      await page.keyboard.press('Shift+Tab');
      await expect(menu).not.toHaveAttribute('open', '');
      if (width >= 768) {
        await menuTrigger.click();
        await page.locator('header [data-site-menu] > summary:visible').nth(1).click();
        await expect(page.locator('header [data-site-menu][open]')).toHaveCount(1);
        await page.keyboard.press('Escape');
      }
      for (const [path, brand] of [["/", "works"], ["/agents", "agents"], ["/objects", "objects"], ["/workforce", "workforce"], ["/docs", "works"]]) {
        await page.goto(`${base}${path}`);
        await expect(page.locator("html")).toHaveAttribute("data-brand", brand!);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await expect(appearance).toHaveValue("dark");
        await expect(appearance).toBeVisible();
        // V1 developer x language/width -> actual Console capture arrives early.
        // V1b business reader -> the explicitly labelled refund illustration
        // arrives early instead of an unrelated developer setup gallery.
        if (path === '/agents') {
          const imageTop = await page.locator('#platform-preview img').first().evaluate((node) => node.getBoundingClientRect().top + scrollY);
          expect(imageTop).toBeLessThan(width < 640 ? 1800 : 1400);
        }
        if (path === '/') {
          const storyTop = await page.locator('[data-workforce-refund-example]').evaluate((node) => node.getBoundingClientRect().top + scrollY);
          expect(storyTop).toBeLessThan(width < 640 ? 1800 : 1400);
          await expect(page.locator('[data-workforce-refund-example]')).toHaveAttribute('data-preview-kind', 'illustration');
        }
        // V2 the Chinese promise keeps the meaningful phrase on one line;
        // neither forced semantic wrapping nor zoom may create horizontal overflow.
        if (path === '/' && lang === 'zh') {
          for (const selector of ['[data-home-title-prefix]', '[data-home-title-highlight]']) expect(await page.locator(selector).evaluate((node) => {
            const range = document.createRange(); range.selectNodeContents(node);
            return range.getClientRects().length;
          })).toBe(1);
        }
        if (brand === "agents") {
          // Capture rules: each actual image x en/zh x wide/narrow -> full
          // intrinsic image, named native modal, bounded size and Escape focus
          // restoration. Inspecting an image cannot change the selected theme.
          const triggers = page.locator("button[data-console-image]");
          await expect(triggers).toHaveCount(5);
          for (const trigger of await triggers.all()) {
            await trigger.click();
            const modal = page.getByRole("dialog");
            await expect(modal).toHaveAccessibleName(await trigger.getAttribute("data-console-alt") ?? "");
            const image = modal.getByRole("img");
            await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(1280);
            await expect(image).toHaveAttribute("width", "1280");
            const box = await modal.boundingBox();
            expect(box!.width).toBeLessThanOrEqual(width);
            await page.keyboard.press("Escape");
            await expect(modal).not.toBeVisible();
            await expect(trigger).toBeFocused();
          }
        }
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      // Source-baseline decision table: collection platform/harness -> Agents
      // record; Flow and its Objects module -> Flow record. Each en/zh x
      // 1280/390/320 combination must disclose the exact locked SHA and review
      // date without overflow. No source refresh or live-code claim is inferred
      // from rendering. These are projections of the existing registry, not
      // independent expected revisions.
      for (const [path, collection] of [
        ["/docs/agents/get-started", "platform"],
        ["/docs/agents/runtime/get-started", "harness"],
        ["/docs/workforce/quickstart", "flow"],
        ["/docs/objects/concepts/resource-model", "flow"],
      ] as const) {
        const version = currentVersion(collection)!;
        await page.goto(`${base}${path}`);
        const source = page.locator("[data-doc-source]");
        await expect(source).toHaveCount(1);
        await expect(source.locator("[data-doc-source-revision]")).toHaveText(version.sourceRevision);
        await expect(source.locator("time")).toHaveAttribute("datetime", version.verifiedOn);
        await expect(source).toContainText(lang === "zh" ? "文档源码基线" : "Documentation source baseline");
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (collection === "platform") await page.screenshot({ path: `test-results/doc-source-${lang}-${width}.png` });
      }
      await page.goto(`${base}/docs`);
      // I1 en/zh x narrow/desktop: one Astro SVG projects the same Search nodes
      // as React; decoration is hidden while the native dialog trigger keeps its
      // translated name, focus entry and Escape restoration.
      const search = page.getByRole("button", { name: lang === "zh" ? "搜索" : "Search" });
      const icon = search.locator("svg[data-functional-icon]");
      await expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
      await expect(icon).toHaveAttribute("stroke-width", "2");
      await expect(icon).toHaveAttribute("aria-hidden", "true");
      await expect(icon.locator("circle")).toHaveAttribute("r", "8");
      await search.click();
      await expect(page.getByRole("dialog").getByRole("searchbox")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(search).toBeFocused();
      await page.reload();
      await expect(appearance).toHaveValue("dark");
      await page.screenshot({ path: `test-results/appearance-docs-${lang}-${width}.png`, fullPage: true });
      await appearance.selectOption("system");
      await page.emulateMedia({ colorScheme: "light" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      // Form focus uses the family ring instead of a local outline suppression.
      // Only keyboard inspection is required; this case sends no form submission.
      await page.goto(`${base}/enterprise`);
      const email = page.locator('form[data-opportunity-form] input[name="email"]');
      await email.focus();
      await expect(email).toHaveCSS("outline-style", "solid");
      await expect(email).toHaveCSS("outline-width", "2px");
      await expect(email).toHaveCSS("border-top-left-radius", "4px");
      expect(errors).toEqual([]);
    });
  }
}

// Product/intent cause-effect graph:
// C1 en/zh; C2 business/developer intent; C3 valid, legacy Objects or unknown
// URL context; C4 JavaScript present/absent; C5 narrow/wide; C6 module metadata.
// E1 exactly Agents+Workforce in navigation, cards and purchasing choices;
// E2 both intents reach their existing canonical owners; E3 legacy module
// intent selects Workforce and retains capability context; unknown input cannot
// add an option; E4 no-JS still offers one normal POST form; E5 no overflow;
// E6 Objects belongs to Workforce in structured data and remains reachable.
// Rules P1 C1+C2 -> E1+E2; P2 legacy C3 -> E3; P3 unknown C3 -> E1;
// P4 !C4 -> E4; P5 C5 -> E5; P6 C6 -> E6. Locale parity is checked with
// English wide and Chinese narrow; the existing appearance matrix covers both
// widths for both locales and every retained product/module route.
for (const lang of ["en", "zh"]) {
  test(`${lang} keeps two products and one module-aware request path`, async ({ page, browser }) => {
    const base = lang === "zh" ? "/zh" : "";
    await page.setViewportSize({ width: lang === "zh" ? 390 : 1280, height: 900 });
    await page.goto(`${base}/`);
    const actions = page.locator("#home-hero a");
    await expect(actions).toHaveCount(2);
    await expect(actions.nth(0)).toHaveAttribute("href", '#workforce-preview');
    await expect(actions.nth(1)).toHaveAttribute("href", `${base}/docs/agents/get-started`);
    await expect(page.locator("#home-products [data-product-role]")).toHaveCount(2);
    await expect(page.locator(`header a[href="${base}/objects"]`)).toHaveCount(0);
    await expect(page.locator(`footer a[href="${base}/objects"]`)).toHaveCount(0);
    const graph = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? "{}")["@graph"]);
    expect(graph.filter((entity: { "@type": string }) => entity["@type"] === "SoftwareApplication").map((entity: { name: string }) => entity.name).sort()).toEqual(["Awaken Agents", "Awaken Workforce"]);
    // P8 social sharing consumes the same two-product identity; old Harness,
    // Platform and Flow product branding cannot survive in the SVG source.
    const social = await (await page.request.get("/og.svg")).text();
    expect(social.match(/data-product="/g)).toHaveLength(2);
    expect(social).toContain("Awaken Agents");
    expect(social).toContain("Awaken Workforce");
    expect(social).not.toMatch(/Awaken (?:Harness|Platform|Flow)/);
    for (const [requested, expected, capability] of [["agents", "agents", ""], ["workforce", "workforce", ""], ["objects", "workforce", "objects"], ["unknown", "workforce", ""]]) {
      await page.goto(`${base}/enterprise?product=${requested}&scenario=enterprise-private-agent`);
      const form = page.locator("form[data-opportunity-form]");
      await expect(form).toHaveCount(1);
      expect(await form.locator('select[name="product"] option').evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))).toEqual(["agents", "workforce"]);
      await expect(form.locator('select[name="product"]')).toHaveValue(expected!);
      await expect(form.locator('input[name="capability_context"]')).toHaveValue(capability!);
      await expect(form.locator('input[name="scenario_context"]')).toHaveValue("enterprise-private-agent");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto(`${base}/objects`);
    const moduleGraph = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? "{}")["@graph"]);
    expect(moduleGraph.find((entity: { "@id": string }) => entity["@id"].endsWith("#workforce-objects"))).toMatchObject({ isPartOf: { "@id": "https://awakenworks.com/#awaken-workforce" } });
    await page.goto(`${base}/docs`);
    await expect(page.locator("#products article")).toHaveCount(2);
    await expect(page.locator(`#products a[href="${base}/docs/objects"]`)).toHaveCount(1);
    // P7: a fixed source can be downloaded; a pending case follows the one request path;
    // ZIP avoids treating a gzip file as HTTP content encoding: download bytes
    // must equal the displayed archive digest after ordinary browser fetching.
    // Unknown context is discarded. The media is a deterministic fixture clip,
    // so it cannot silently become live-provider or customer evidence.
    await page.goto(`${base}/cases/deepseek-harness`);
    await expect(page.locator("[data-case-source] dd")).toHaveText(/^[a-f0-9]{40}$/);
    await expect(page.locator("[data-case-walkthrough] video")).toHaveAttribute("src", "/cases/deepseek-harness/deterministic-demo.mp4");
    const download = page.locator('[data-awaken-event="case_source_download_selected"]');
    await expect(download).toHaveAttribute("href", /source-[a-f0-9]{40}\.zip$/);
    const response = await page.request.get((await download.getAttribute("href"))!);
    expect(response.ok()).toBe(true);
    const archiveBytes = await response.body();
    expect(archiveBytes.subarray(0, 2).toString("hex")).toBe("504b");
    const digest = createHash("sha256").update(archiveBytes).digest("hex");
    await expect(page.locator("[data-case-source-digest]")).toContainText(digest);
    await page.goto(`${base}/cases/design`);
    // D1 frozen application + dated passed local receipt -> positive, bounded
    // local evidence; D2 public archive absent -> existing access request;
    // D3 production/semantic/customer acceptance absent -> pending boundary.
    // A passing local journey must neither keep the superseded failure claim
    // nor become a general release/customer claim.
    const design = content[lang].cases.items.find((item) => item.slug === "design")!;
    const source = page.locator("[data-case-source]");
    await expect(source.locator("dd")).toHaveText(design.sourceBaseline);
    const status = page.locator("[data-case-source-status]");
    await expect(status).toContainText("411");
    await expect(status).toContainText(lang === "zh" ? "生产登录与部署" : "production login and deployment");
    await expect(status).not.toContainText(lang === "zh" ? "尚未通过发布验收" : "has not passed release acceptance");
    await expect(page.locator('[data-awaken-event="case_source_download_selected"]')).toHaveCount(0);
    const sourceAction = page.locator('[data-awaken-event="case_source_access_selected"]');
    await sourceAction.click();
    await expect(page.locator('form input[name="reference_case"]')).toHaveValue("design");
    // D4 install/build passed but published-runtime compatibility and full live
    // acceptance failed -> retain the fixed source download with the known
    // limitation, never promote source-check success into real-Agent success.
    await page.goto(`${base}/cases/pilot`);
    await expect(page.locator("[data-case-source-status]")).toContainText(lang === "zh" ? "运行接口兼容缺口" : "runtime compatibility gaps");
    await expect(page.locator('[data-awaken-event="case_source_download_selected"]')).toHaveCount(1);
    await page.goto(`${base}/enterprise?reference_case=unknown`);
    await expect(page.locator('form input[name="reference_case"]')).toHaveValue("");
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    try {
      const plain = await noJS.newPage();
      await plain.goto(`${base}/enterprise?product=objects`);
      const form = plain.locator("form[data-opportunity-form]");
      await expect(form).toHaveCount(1);
      await expect(form).toHaveAttribute("method", "POST");
      expect(await form.locator('select[name="product"] option').evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))).toEqual(["agents", "workforce"]);
      await expect(form.locator('select[name="product"]')).toHaveValue("workforce");
    } finally { await noJS.close(); }
  });
}

// Click/telemetry graph: C1 SDK unavailable; C2 synchronous failure;
// C3 rejected send; C4 unresolved send; C5 native navigation/control action.
// E1 C5 proceeds immediately; E2 at most one SDK call with the same bounded
// event name and dimensions; E3 no duplicate SDK-attribute dispatcher, retry
// queue or persistence. Rules A1 !SDK -> E1; A2 C2/C3/C4 -> E1+E2+E3.
// Both locales retain real navigation and one request form; this fault case
// makes the observed hung collector deterministic without contacting it.
for (const behavior of ["pending", "rejected", "throw", "missing"]) {
  test(`native navigation survives ${behavior} analytics`, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.route("https://cloud.umami.is/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
    await page.addInitScript((mode) => {
      const calls: unknown[] = [];
      (window as unknown as { telemetryCalls: unknown[] }).telemetryCalls = calls;
      if (mode === "missing") return;
      (window as unknown as { umami: unknown }).umami = { track(name: string, data: unknown) {
        calls.push({ name, data });
        sessionStorage.setItem("telemetry-call", JSON.stringify(calls));
        if (mode === "throw") throw new Error("collector unavailable");
        if (mode === "rejected") return Promise.reject(new Error("collector unavailable"));
        return new Promise(() => {});
      } };
    }, behavior);
    await page.goto("/zh/cases/design");
    await page.locator('[data-awaken-event="case_source_access_selected"]').click();
    await expect(page).toHaveURL(/\/zh\/enterprise\?product=agents&reference_case=design#apply/);
    await expect(page.locator('form input[name="reference_case"]')).toHaveValue("design");
    const recorded = await page.evaluate(() => JSON.parse(sessionStorage.getItem("telemetry-call") ?? "[]"));
    expect(recorded.length).toBe(behavior === "missing" ? 0 : 1);
    if (recorded.length) expect(recorded[0]).toEqual({ name: "case_source_access_selected", data: { location: "case-availability", product: "agents", destination: "enterprise" } });
    expect(failures).toEqual([]);
  });

  // Form decision table F1 incomplete inputs -> zero requests; F2 valid inputs
  // + pending POST + repeat submit -> one request; F3 HTTP failure -> retained
  // inputs/id and retry; F4 retry success -> one success surface with focus.
  // Analytics missing/throw/reject/pending cannot change F1-F4. POSTs are
  // intercepted at the existing endpoint: no external contact is generated.
  test(`form failure and retry retain their outcome with ${behavior} analytics`, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.route("https://cloud.umami.is/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
    await page.addInitScript((mode) => {
      if (mode === "missing") return;
      (window as unknown as { umami: unknown }).umami = { track() {
        if (mode === "throw") throw new Error("collector unavailable");
        if (mode === "rejected") return Promise.reject(new Error("collector unavailable"));
        return new Promise(() => {});
      } };
    }, behavior);
    let requests = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("https://formspree.io/f/mrewzorl", async (route) => {
      requests++;
      if (requests === 1) await held;
      await route.fulfill({ status: requests === 1 ? 503 : 200, contentType: "application/json", body: "{}" });
    });
    await page.goto("/zh/enterprise?product=agents&reference_case=pilot");
    const form = page.locator("form[data-opportunity-form]");
    const submit = form.locator('button[type="submit"]');
    await submit.click();
    expect(requests).toBe(0);
    await form.locator('[name="email"]').fill("test@example.invalid");
    // Optional detail stays in the same form; this rule exercises the expanded
    // path, while the locale tests below prove the minimal request needs no scope fields.
    await form.locator('[data-opportunity-details] > summary').click();
    await form.locator('[name="company"]').fill("Fixture only");
    await form.locator('[name="job"]').fill("Review one repeatable job");
    for (const name of ["role", "current_stage", "current_loss"]) {
      const select = form.locator(`select[name="${name}"]`);
      const value = await select.locator("option:not([disabled])").first().getAttribute("value");
      await select.selectOption(value!);
    }
    await form.locator('[name="contact_consent"]').check();
    const id = await form.locator('[name="submission_id"]').inputValue();
    await submit.click();
    await expect(form).toHaveAttribute("aria-busy", "true");
    await form.evaluate((node) => (node as HTMLFormElement).requestSubmit());
    await expect.poll(() => requests).toBe(1);
    release();
    await expect(form.locator(".opportunity-message")).toBeVisible();
    await expect(form.locator('[name="submission_id"]')).toHaveValue(id);
    await expect(form.locator('[name="job"]')).toHaveValue("Review one repeatable job");
    await expect(submit).toBeEnabled();
    await submit.click();
    const success = form.locator("[data-opportunity-success]");
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    expect(requests).toBe(2);
    await expect(form.locator("[data-opportunity-fields]")).toBeHidden();
    expect(failures).toEqual([]);
  });
}

// Locale transfer graph: C1 en->zh/zh->en; C2 desktop/narrow; C3 intent query
// and hash; C4 edited product plus contact/optional/multi-checkbox fields;
// C5 tab storage available/unavailable; C6 live draft/expired/invalid schema.
// Effects: E1 same logical page/context; E2 exact field and expansion restoration;
// E3 one-use cleanup, fresh submission identity and target language; E4 no contact
// or free text in URLs; E5 unavailable storage keeps a dirty form in place with
// a focused explanation, but permits empty-form navigation; E6 invalid drafts
// are consumed without applying unknown values or changing hidden metadata.
// Rules L1 C1+C2+C3+C4+C5 -> E1-E4; L2 dirty+!C5 -> E5; L3 empty+!C5 -> E1;
// L4 invalid C6 -> E6. Actual native links and the shared form own this journey.
const localeDraftKey = 'awakenworks_opportunity_locale_draft';
for (const lang of ['en', 'zh'] as const) {
  for (const width of [1280, 390]) {
    test(`${lang} ${width}px transfers one draft across language navigation`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('https://cloud.umami.is/script.js', (route) => route.fulfill({ status: 200, body: '' }));
      const base = lang === 'zh' ? '/zh' : '';
      const nextLang = lang === 'zh' ? 'en' : 'zh';
      await page.goto(`${base}/enterprise?product=agents&reference_case=design&scenario=solution-delivery#apply`);
      const form = page.locator('[data-opportunity-form]');
      await expect(form).toHaveAttribute('data-initial-product', 'agents');
      await expect(form.locator('[data-opportunity-details]')).not.toHaveAttribute('open', '');
      // Minimal intake remains three required controls and four visible fields.
      await expect(form.locator('[required]')).toHaveCount(3);
      await expect(form.locator('[data-opportunity-fields] input:visible, [data-opportunity-fields] textarea:visible, [data-opportunity-fields] select:visible')).toHaveCount(4);
      await form.locator('[name=email]').fill('locale@example.invalid');
      await form.locator('[name=job]').fill('Review support tickets <literal text>');
      await form.locator('[name=product]').selectOption('workforce');
      await form.locator('[name=contact_consent]').check();
      await form.locator('[data-opportunity-details] > summary').click();
      await form.locator('[name=company]').fill('Fixture company');
      await form.locator('[name=role]').selectOption('business-owner');
      await form.locator('[name=systems_and_risks][value=models]').check();
      await form.locator('[name=systems_and_risks][value=business-systems]').check();
      await form.locator('[name=additional_context]').fill('Keep this optional detail');
      const originalId = await form.locator('[name=submission_id]').inputValue();
      await page.locator(`a[data-locale-switch=${nextLang}]`).click();
      const url = new URL(page.url());
      expect(url.pathname).toBe(nextLang === 'zh' ? '/zh/enterprise' : '/enterprise');
      expect(url.searchParams.get('product')).toBe('agents');
      expect(url.searchParams.get('reference_case')).toBe('design');
      expect(url.searchParams.get('scenario')).toBe('solution-delivery');
      expect(url.hash).toBe('#apply');
      expect(url.href).not.toContain('locale%40');
      expect(url.href).not.toContain('literal');
      await expect(form.locator('[name=email]')).toHaveValue('locale@example.invalid');
      await expect(form.locator('[name=job]')).toHaveValue('Review support tickets <literal text>');
      await expect(form.locator('[name=product]')).toHaveValue('workforce');
      await expect(form.locator('[name=company]')).toHaveValue('Fixture company');
      await expect(form.locator('[name=role]')).toHaveValue('business-owner');
      await expect(form.locator('[name=systems_and_risks][value=models]')).toBeChecked();
      await expect(form.locator('[name=systems_and_risks][value=business-systems]')).toBeChecked();
      await expect(form.locator('[name=additional_context]')).toHaveValue('Keep this optional detail');
      await expect(form.locator('[name=contact_consent]')).toBeChecked();
      await expect(form.locator('[name=lang]')).toHaveValue(nextLang);
      await expect(form.locator('[name=reference_case]')).toHaveValue('design');
      await expect(form.locator('[data-opportunity-details]')).toHaveAttribute('open', '');
      expect(await form.locator('[name=submission_id]').inputValue()).not.toBe(originalId);
      expect(await page.evaluate((key) => sessionStorage.getItem(key), localeDraftKey)).toBeNull();
      await expect(form.locator('.opportunity-message')).toBeVisible();
    });
  }
}
for (const dirty of [false, true]) {
  test(`language navigation with blocked storage and ${dirty ? 'dirty' : 'empty'} form`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } }));
    await page.goto('/zh/enterprise?product=agents&reference_case=pilot#apply');
    const form = page.locator('[data-opportunity-form]');
    await expect(form).toHaveAttribute('data-initial-product', 'agents');
    if (dirty) await form.locator('[name=email]').fill('retained@example.invalid');
    await page.locator('a[data-locale-switch=en]').click();
    if (dirty) {
      expect(new URL(page.url()).pathname).toBe('/zh/enterprise');
      await expect(form.locator('[name=email]')).toHaveValue('retained@example.invalid');
      await expect(form.locator('.opportunity-message')).toBeVisible();
      await expect(form.locator('.opportunity-message')).toBeFocused();
    } else {
      expect(new URL(page.url()).pathname).toBe('/enterprise');
      await expect(form.locator('[name=product]')).toHaveValue('agents');
      await expect(form.locator('[name=reference_case]')).toHaveValue('pilot');
    }
    expect(errors).toEqual([]);
  });
}
for (const condition of ['expired', 'wrong-language', 'unknown-schema', 'corrupt', 'oversized']) {
  test(`language draft ${condition} cannot overwrite the form`, async ({ page }) => {
    await page.route('https://cloud.umami.is/script.js', (route) => route.fulfill({ status: 200, body: '' }));
    await page.addInitScript(({ key, condition }) => {
      const draft = { schema: condition === 'unknown-schema' ? 99 : 1, lang: condition === 'wrong-language' ? 'en' : 'zh', expiresAt: Date.now() + (condition === 'expired' ? -60_000 : 300_000), fields: { email: ['injected@example.invalid'], product: ['cloud'], lang: ['en'], submission_id: ['forged'] } };
      sessionStorage.setItem(key, condition === 'corrupt' ? '{invalid' : condition === 'oversized' ? 'x'.repeat(20_000) : JSON.stringify(draft));
    }, { key: localeDraftKey, condition });
    await page.goto('/zh/enterprise?product=agents');
    const form = page.locator('[data-opportunity-form]');
    await expect(form).toHaveAttribute('data-initial-product', 'agents');
    await expect(form.locator('[name=email]')).toHaveValue('');
    await expect(form.locator('[name=product]')).toHaveValue('agents');
    await expect(form.locator('[name=lang]')).toHaveValue('zh');
    await expect(form.locator('[name=submission_id]')).not.toHaveValue('forged');
    expect(await page.evaluate((key) => sessionStorage.getItem(key), localeDraftKey)).toBeNull();
  });
}

// A1 selected Workforce -> preview CTA truthfully labels a static illustration;
// A2 cooperation intent -> same selected product directly at the only request;
// A3 delivery question -> existing enterprise page explains operator and access
// for three delivery modes without creating a third product or application form.
for (const lang of ['en', 'zh']) {
  test(`${lang} explains preview and deployment before the single request`, async ({ page }) => {
    const base = lang === 'zh' ? '/zh' : '';
    await page.goto(`${base}/workforce`);
    const preview = page.locator('#workforce-hero a').first();
    await expect(preview).toHaveText(lang === 'zh' ? '查看工作流程预览' : 'See the workflow preview');
    await preview.click();
    await expect(page).toHaveURL(/#workforce-preview$/);
    await page.locator('#workforce-hero a').nth(1).click();
    await expect(page).toHaveURL(new RegExp(`${base}/enterprise\\?product=workforce&scenario=${REFUND_SCENARIO_KEY}#apply$`));
    await expect(page.locator('form [name=product]')).toHaveValue('workforce');
    await expect(page.locator('form [name=scenario_context]')).toHaveValue(REFUND_SCENARIO_KEY);
    await expect(page.locator('[data-opportunity-form]')).toHaveCount(1);
    await expect(page.locator('[data-delivery-mode]')).toHaveCount(3);
    await expect(page.locator('[data-delivery-mode=cloud]')).toContainText(lang === 'zh' ? '托管预览' : 'Hosted preview');
    expect(await page.locator('form select[name=product] option').evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))).toEqual(['agents', 'workforce']);
    const headerBottom = await page.locator('header').evaluate((node) => node.getBoundingClientRect().bottom);
    const formTop = await page.locator('#apply').evaluate((node) => node.getBoundingClientRect().top);
    expect(formTop).toBeGreaterThanOrEqual(headerBottom);
  });
}

// Refund story cause/effect rules:
// R1 entry Home/Workforce x en/zh x JS enabled/disabled -> one fictional case,
// four stages, explicit AI/person/system roles and three completion records.
// R2 approval or timeout question -> native disclosure reveals the wait/check
// rule with keyboard input; it never performs a refund or creates work.
// R3 business contact + JS -> same single form retains the selected scenario
// and product across locale navigation. R4 !JS -> story remains fully readable
// and the native request still has the existing Workforce default.
// R5 Home hero previews the story while the header requests contact -> each
// label names its own native destination, independent of JS or viewport.
// These are website comprehension cues and navigation contracts, not proof
// of a deployed refund solution or observed user comprehension.
for (const lang of ['en', 'zh']) {
  for (const javaScriptEnabled of [true, false]) {
    test(`${lang} refund story with JavaScript ${javaScriptEnabled}`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 900 } });
      try {
        await context.route('https://cloud.umami.is/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await context.route('https://formspree.io/**', (route) => route.abort());
        const page = await context.newPage();
        const businessWrites: string[] = [];
        page.on('request', (request) => {
          if (request.method() !== 'GET') businessWrites.push(request.url());
        });
        const base = lang === 'zh' ? '/zh' : '';
        for (const path of ['/', '/workforce']) {
          await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
          for (const contact of await page.locator('header a[data-awaken-event=business_job_evaluation_selected]').all()) {
            await expect(contact).toHaveText(lang === 'zh' ? '评估一项业务工作' : 'Evaluate one business job');
            await expect(contact).toHaveAttribute('href', `${base}/enterprise?product=workforce#apply`);
            await expect(contact).toHaveAttribute('data-awaken-event-destination', 'enterprise');
          }
          const story = page.locator('[data-workforce-refund-example]');
          await expect(story).toHaveCount(1);
          await expect(story).toHaveAttribute('data-preview-kind', 'illustration');
          await expect(story).toContainText(lang === 'zh' ? '同一个订单扣了两次款' : 'This order was charged twice');
          await expect(story.locator('[data-refund-example-boundary]')).toContainText(lang === 'zh' ? '研究候选' : 'research candidate');
          await expect(story.locator('[data-workforce-stage]')).toHaveCount(4);
          const approval = story.locator('[data-workforce-stage]').nth(1);
          await approval.locator('summary').focus();
          await page.keyboard.press('Enter');
          await expect(approval).toHaveAttribute('open', '');
          await expect(approval.locator('p')).toBeVisible();
          await expect(approval).toContainText(lang === 'zh' ? '方案未获批准时，操作保持等待' : 'Execution waits until the proposal is approved');
          const execution = story.locator('[data-workforce-stage]').nth(2);
          await execution.locator('summary').focus();
          await page.keyboard.press('Enter');
          await expect(execution.locator('p')).toBeVisible();
          await expect(execution).toContainText(lang === 'zh' ? '请求超时时先查询支付状态' : 'If a request times out, query the payment state');
          await expect(story.locator('[data-workforce-role]')).toHaveCount(3);
          await expect(story.locator('[data-workforce-role]').nth(1)).toContainText(lang === 'zh' ? '负责人' : 'Responsible person');
          await expect(story.locator('[data-refund-result-record]')).toHaveCount(3);
          await expect(story.locator('[data-refund-result-record]').nth(0)).toContainText(lang === 'zh' ? '退款已确认' : 'Refund confirmed');
          await expect(story.locator('[data-refund-result-record]').nth(1)).toContainText(lang === 'zh' ? '通知已记录' : 'Notification recorded');
          await expect(story.locator('[data-refund-result-record]').nth(2)).toContainText(lang === 'zh' ? '工单已关闭' : 'Case closed');
          await expect(story.locator('button, input, form, [aria-disabled]')).toHaveCount(0);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
        expect(businessWrites).toEqual([]);
        if (javaScriptEnabled) {
          await page.goto(`${base}/`);
          await page.locator('#home-cta [data-awaken-event=business_job_evaluation_selected]').click();
          const form = page.locator('[data-opportunity-form]');
          await expect(form).toHaveAttribute('data-initial-product', 'workforce');
          await expect(form.locator('[name=scenario_context]')).toHaveValue(REFUND_SCENARIO_KEY);
          await expect(form.locator('[data-scenario-context]')).toBeVisible();
          await form.locator('[name=email]').fill('refund-review@example.invalid');
          await page.locator(`a[data-locale-switch=${lang === 'zh' ? 'en' : 'zh'}]`).click();
          await expect(form).toHaveAttribute('data-initial-product', 'workforce');
          await expect(form.locator('[name=scenario_context]')).toHaveValue(REFUND_SCENARIO_KEY);
          await expect(form.locator('[name=email]')).toHaveValue('refund-review@example.invalid');
        }
      } finally { await context.close(); }
    });
  }
}

// N1 JavaScript absent + native keyboard consent/submit + only email/job entered -> a native POST reaches
// the same endpoint with the selected product and localized schema. N2 extras
// untouched -> no hidden required controls block intake. Transport is intercepted
// so the test never sends a real inquiry to another person.
test('native request needs only the minimum information without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    let submitted: URLSearchParams | undefined;
    await page.route('https://formspree.io/f/mrewzorl', async (route) => {
      submitted = new URLSearchParams(route.request().postData() ?? '');
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<main><h1>Fixture request received</h1></main>' });
    });
    await page.goto('/zh/enterprise');
    await page.locator('[name=product]').selectOption('agents');
    await page.locator('[name=job]').fill('Prepare a daily support summary');
    await page.locator('[name=email]').fill('minimal@example.invalid');
    await page.locator('[name=contact_consent]').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('[name=contact_consent]')).toBeChecked();
    await page.locator('button[type=submit]').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Fixture request received' })).toBeVisible();
    expect(submitted?.get('product')).toBe('agents');
    expect(submitted?.get('lang')).toBe('zh');
    expect(submitted?.get('job')).toBe('Prepare a daily support summary');
    expect(submitted?.get('email')).toBe('minimal@example.invalid');
    expect(submitted?.get('contact_consent')).toBe('yes');
  } finally { await context.close(); }
});

// M3 a short viewport + full resource menu -> popup remains within the viewport
// with its own scrolling; Escape restores the trigger. No body lock or second
// mobile navigation state is introduced.
test('short mobile viewport contains and dismisses the full navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/zh/');
  const trigger = page.locator('header [data-site-menu] > summary:visible');
  await trigger.click();
  const popup = trigger.locator('..').locator('div').first();
  const box = await popup.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(500);
  await expect(popup).toHaveCSS('overflow-y', 'auto');
  await page.keyboard.press('Escape');
  await expect(trigger.locator('..')).not.toHaveAttribute('open', '');
  await expect(trigger).toBeFocused();
});

// L5 server-rendered locale target under a deployment base + intent/hash ->
// exact prefix and request context survive; source query cannot change origin.
test('language context preserves the deployment base and canonical destination', () => {
  expect(localeNavigationHref('/preview/enterprise', 'https://example.test/preview/zh/enterprise?product=agents&reference_case=design#apply'))
    .toBe('/preview/enterprise?product=agents&reference_case=design#apply');
  expect(() => localeNavigationHref('https://elsewhere.test/enterprise', 'https://example.test/zh/enterprise'))
    .toThrow('Language navigation must stay on this website');
});

// A4 collector script download never finishes -> DOMContentLoaded and first-party
// form/menu initialization remain available. The SDK still owns pageviews; this
// is independence from an optional network resource, not disabled measurement.
test('a stalled analytics script cannot delay website interaction readiness', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://cloud.umami.is/script.js', async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  try {
    await page.goto('/zh/enterprise?product=agents#apply', { waitUntil: 'domcontentloaded' });
    const form = page.locator('[data-opportunity-form]');
    await expect(form).toHaveAttribute('data-initial-product', 'agents');
    await form.locator('[name=email]').fill('ready@example.invalid');
    const trigger = page.locator('header [data-site-menu] > summary:visible').first();
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(trigger.locator('..')).not.toHaveAttribute('open', '');
    await expect(form.locator('[name=email]')).toHaveValue('ready@example.invalid');
  } finally { release(); }
});
