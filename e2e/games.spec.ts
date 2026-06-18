import { test, expect, type Page } from "@playwright/test";
import { GAME_IDS } from "./games";

/**
 * Light interaction smoke per game: open the board, click the first interactive
 * control, and assert no uncaught JS error fired. This is intentionally generic
 * — every game renders real <button> elements (cells, tiles, pads, keys) inside
 * the GameHost board container, so a single click exercises that game's click
 * handler / state update without needing game-specific selectors.
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

for (const id of GAME_IDS) {
  test(`${id}: reacts to a click without page errors`, async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);

    await page.goto(`/play/${id}`);
    await expect(page.getByRole("link", { name: /Today/ }).first()).toBeVisible();

    // Find an interactive control that isn't the nav chrome (Settings / Menu /
    // back link). Prefer a board control: any visible enabled button after the
    // header. We click the first such button and confirm the UI stays alive.
    const buttons = page.locator("button:visible");
    await expect(buttons.first()).toBeVisible();
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    // Click a candidate control. Skip the global Settings / Menu buttons. Some
    // games show a "Start"/instructions overlay over the board, so a board cell
    // may be occluded — give each click a short timeout and keep trying the next
    // candidate until one actually lands (e.g. the overlay's Start button).
    let clicked = false;
    for (let i = 0; i < count && !clicked; i++) {
      const btn = buttons.nth(i);
      const label = (await btn.getAttribute("aria-label")) ?? "";
      if (label === "Settings" || label === "Menu") continue;
      try {
        await btn.click({ timeout: 2000 });
        clicked = true;
      } catch {
        // occluded or unstable — try the next candidate
      }
    }
    expect(clicked, "found a clickable game control").toBe(true);

    // Give any state update / animation a tick, then verify the page is intact:
    // we stayed on the game route (no unexpected navigation) and nothing threw.
    // (Re-querying a specific element is flaky on games that start an animation
    // loop on first interaction, so we assert the route + error-free instead.)
    await page.waitForTimeout(200);
    expect(page.url()).toContain(`/play/${id}`);
    await expect(page.locator("button").first()).toBeVisible();
    assertNoErrors();
  });
}
