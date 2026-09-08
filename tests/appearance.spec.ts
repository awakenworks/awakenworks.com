import { expect, test } from "@playwright/test";

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
