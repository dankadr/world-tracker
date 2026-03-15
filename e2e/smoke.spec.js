import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('swiss-tracker-onboarding-done', 'true');
  });

  await page.goto('/');
  await expect(page.getByTestId('world-map-container')).toBeVisible();
  await expect(page.locator('[data-country-id="ch"]').first()).toBeVisible();
});

test('marks a country visited and opens geography games', async ({ page }) => {
  const switzerland = page.locator('[data-country-id="ch"]').first();

  await expect(switzerland).toHaveAttribute('data-visited', 'false');
  await switzerland.click({ force: true });
  await expect(switzerland).toHaveAttribute('data-visited', 'true');

  await page.getByTestId('open-geography-games').click();
  await expect(page.getByTestId('games-panel')).toBeVisible();
});

test('starts map quiz and answers the highlighted target', async ({ page }) => {
  await page.getByTestId('open-geography-games').click();
  await page.getByTestId('play-map-quiz').click();
  await page.getByTestId('map-config-start').click();

  await expect(page.getByTestId('map-quiz-prompt')).toBeVisible();

  // Read the target country ID from the hidden metadata element (no visual highlight)
  const targetMeta = page.getByTestId('map-quiz-target');
  await expect(targetMeta).toBeAttached();
  const targetId = await targetMeta.getAttribute('data-quiz-country-id');

  const targetCountry = page.locator(`[data-country-id="${targetId}"]`).first();
  await targetCountry.click({ force: true });

  await expect(page.getByText(/Correct!/)).toBeVisible();
});
