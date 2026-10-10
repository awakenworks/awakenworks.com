import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

// Site integration decision table: language en/zh x desktop/narrow, across all
// four route identities and the documentation shell. Legacy stored light wins
// over OS dark; explicit dark survives route changes/refresh; system resumes OS.
// Product routes must never reset brightness, duplicate persistence, or hide the
// native theme selector. Chinese 390px previously overflowed by 11px: the docs
// chrome must wrap into available rows; search retains its name with hidden text.
// Runtime failure combinations live in @awaken/ui tests.
for (const lang of ["en", "zh"]) {
  for (const width of [1280, 390]) {
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
      for (const [path, brand] of [["/", "works"], ["/agents", "agents"], ["/objects", "objects"], ["/workforce", "workforce"], ["/docs", "works"]]) {
        await page.goto(`${base}${path}`);
        await expect(page.locator("html")).toHaveAttribute("data-brand", brand!);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await expect(appearance).toHaveValue("dark");
        await expect(appearance).toBeVisible();
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
    await expect(actions.nth(0)).toHaveAttribute("href", `${base}/enterprise`);
    await expect(actions.nth(1)).toHaveAttribute("href", `${base}/docs/agents/get-started`);
    await expect(page.locator("#home-products [data-product-role]")).toHaveCount(2);
    await expect(page.locator(`header a[href="${base}/objects"]`)).toHaveCount(0);
    await expect(page.locator(`footer a[href="${base}/objects"]`)).toHaveCount(0);
    const graph = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? "{}")["@graph"]);
    expect(graph.filter((entity: { "@type": string }) => entity["@type"] === "SoftwareApplication").map((entity: { name: string }) => entity.name).sort()).toEqual(["Awaken Agents", "Awaken Workforce"]);
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
    const sourceAction = page.locator('[data-awaken-event="case_source_access_selected"]');
    await sourceAction.click();
    await expect(page.locator('form input[name="reference_case"]')).toHaveValue("design");
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
}
