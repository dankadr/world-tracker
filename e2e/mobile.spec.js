import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('swiss-tracker-onboarding-done', 'true');
    window.localStorage.setItem('onboarding-dismissed', 'true');
    window.localStorage.setItem('swiss-tracker-guest', 'true');
  });

  await page.goto('/');
  await expect(page.locator('.world-map')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Explore' })).toBeVisible();
});

test('mobile map games entry opens games and quit returns to the games home', async ({ page }) => {
  await page.getByRole('button', { name: /games/i }).click();
  await expect(page.getByTestId('games-panel')).toBeVisible();

  await page.getByTestId('play-map-quiz').click();
  await page.getByTestId('map-config-start').click();
  await expect(page.getByTestId('map-quiz-prompt')).toBeVisible();

  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByTestId('games-panel')).toBeVisible();
});

