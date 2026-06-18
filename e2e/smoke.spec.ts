import { test, expect, type Page } from "@playwright/test";
import { GAME_IDS } from "./games";

/**
 * Mark the player as onboarded before each test so the first-run onboarding
 * modal (correct behaviour for new visitors) doesn't intercept nav clicks.
 * Onboarding itself is covered separately.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "braintap-progress-v1",
        JSON.stringify({
          state: {
            settings: { zen: false, sound: true },
            onboarded: true,
            results: {},
            states: {},
            currentStreak: 0,
            longestStreak: 0,
            lastPlayedISO: null,
          },
          version: 0,
        }),
      );
    } catch {
      /* ignore */
    }
  });
});

/**
 * Attach a pageerror listener and return a function that throws if any
 * uncaught JS error was seen on the page. We collect rather than fail
 * immediately so a single assertion can report the offending error message.
 */
function trackPageErrors(page: Page) {
  const errors: Error[] = [];
  page.on("pageerror", (err) => errors.push(err));
  return () => {
    expect(
      errors,
      `uncaught page errors:\n${errors.map((e) => e.stack ?? e.message).join("\n\n")}`,
    ).toHaveLength(0);
  };
}

test.describe("home", () => {
  test("loads and shows the 15 game cards", async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);

    await page.goto("/");

    // Every game card is an anchor pointing at /play/<id>.
    await expect(page.locator('a[href^="/play/"]').first()).toBeVisible();

    for (const id of GAME_IDS) {
      await expect(
        page.locator(`a[href="/play/${id}"]`).first(),
        `card link for ${id}`,
      ).toBeVisible();
    }

    // All 15 + the weekly-rotation links resolve to one of the 15 ids; assert
    // the distinct set of card destinations covers exactly the 15 games.
    const hrefs = await page.locator('a[href^="/play/"]').evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href")),
    );
    const ids = new Set(hrefs.map((h) => h?.replace("/play/", "")));
    for (const id of GAME_IDS) {
      expect(ids.has(id), `home links to ${id}`).toBe(true);
    }

    assertNoErrors();
  });
});

test.describe("play routes", () => {
  for (const id of GAME_IDS) {
    test(`/play/${id} renders a board with no page errors`, async ({ page }) => {
      const assertNoErrors = trackPageErrors(page);

      await page.goto(`/play/${id}`);

      // The GameHost header always renders a "← Today" back link, and the
      // board sits inside an interactive region — assert both are present.
      await expect(page.getByRole("link", { name: /Today/ }).first()).toBeVisible();
      await expect(page.locator("main, body").first()).toBeVisible();

      // A board should mount at least one interactive control (button / grid).
      await expect(page.locator("button").first()).toBeVisible();

      assertNoErrors();
    });
  }
});

test.describe("404", () => {
  test("/play/notagame is not found", async ({ page }) => {
    const res = await page.goto("/play/notagame");
    // Next returns a 404 status for unknown static params.
    expect(res?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
  });
});

test.describe("settings", () => {
  test("opens the settings modal from the nav", async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Settings")).toBeVisible();

    // Close it again via the Close button.
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();

    assertNoErrors();
  });
});

test.describe("mobile layout", () => {
  test("home has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator('a[href^="/play/"]').first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      // Allow a 1px rounding fudge.
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow, "horizontal scroll overflow in px").toBeLessThanOrEqual(1);
  });
});
