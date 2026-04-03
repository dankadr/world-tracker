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

test('mobile country visit toast stays compact above the tab bar', async ({ page }) => {
  const switzerland = page.locator('[data-country-id="ch"]').first();

  await expect(switzerland).toHaveAttribute('data-visited', 'false');
  await switzerland.click({ force: true });
  await expect(switzerland).toHaveAttribute('data-visited', 'true');

  const toast = page.locator('.xp-toast').first();
  await expect(toast).toBeVisible();

  const toastBox = await toast.boundingBox();
  const viewport = page.viewportSize();

  expect(toastBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(toastBox.width).toBeLessThan(viewport.width - 20);

  const toastBottom = toastBox.y + toastBox.height;
  expect(toastBottom).toBeLessThan(viewport.height - 60);
});
