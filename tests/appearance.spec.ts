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
      await appearance.selectOption("dark");
      for (const [path, brand] of [["/", "works"], ["/agents", "agents"], ["/objects", "objects"], ["/workforce", "workforce"], ["/docs", "works"]]) {
        await page.goto(`${base}${path}`);
        await expect(page.locator("html")).toHaveAttribute("data-brand", brand!);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await expect(appearance).toHaveValue("dark");
        await expect(appearance).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await expect(page.getByRole("button", { name: lang === "zh" ? "搜索" : "Search" })).toBeVisible();
      await page.reload();
      await expect(appearance).toHaveValue("dark");
      await page.screenshot({ path: `test-results/appearance-docs-${lang}-${width}.png`, fullPage: true });
      await appearance.selectOption("system");
      await page.emulateMedia({ colorScheme: "light" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      expect(errors).toEqual([]);
    });
  }
}
