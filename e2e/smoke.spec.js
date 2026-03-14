import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('swiss-tracker-onboarding-done', 'true');
    window.localStorage.setItem('onboarding-dismissed', 'true');
  });

  await page.goto('/');
  await expect(page.locator('.world-map')).toBeVisible();
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

  const targetCountry = page.locator('[data-game-target="true"]').first();
  await expect(targetCountry).toBeVisible();
  await targetCountry.dispatchEvent('click');

  await expect(page.getByText(/Correct!/)).toBeVisible();
});

test('shape quiz keeps wrong-answer feedback visible before advancing', async ({ page }) => {
  await page.getByTestId('open-geography-games').click();

  const shapeCard = page.locator('.game-card').filter({
    has: page.locator('.game-card-title', { hasText: 'Shape Quiz' }),
  });

  await shapeCard.getByRole('button', { name: 'Play' }).click();
  await page.getByTestId('map-config-start').click();

  const answerInput = page.getByPlaceholder('Type your answer...');
  await answerInput.fill('zzzz-not-a-country');
  await page.getByRole('button', { name: 'Submit' }).click();

  const wrongFeedback = page.getByTestId('shape-quiz-feedback');
  await expect(wrongFeedback).toBeVisible();

  await page.waitForTimeout(1500);
  await expect(wrongFeedback).toBeVisible();

  await page.waitForTimeout(1500);
  await expect(wrongFeedback).not.toBeVisible();
});

test('flag quiz shows the flag prompt and keeps wrong-answer feedback visible', async ({ page }) => {
  await page.getByTestId('open-geography-games').click();

  const flagCard = page.locator('.game-card').filter({
    has: page.locator('.game-card-title', { hasText: 'Flag Quiz' }),
  });

  await flagCard.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('flag-quiz-prompt')).toBeVisible();

  const answerInput = page.getByPlaceholder('Type your answer...');
  await answerInput.fill('zzzz-not-a-country');
  await page.getByRole('button', { name: 'Submit' }).click();

  const feedback = page.getByTestId('flag-quiz-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText('✗');

  await page.waitForTimeout(1500);
  await expect(feedback).toBeVisible();
});
