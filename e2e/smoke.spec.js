import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('swiss-tracker-onboarding-done', 'true');
    window.localStorage.setItem('onboarding-dismissed', 'true');
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

  // data-game-target="true" is set on the SVG path while a question is active
  // (the blue reveal colour is suppressed until after the user answers)
  const targetCountry = page.locator('[data-game-target="true"]').first();
  // No zoom during playing — the SVG path may be sub-pixel at world zoom,
  // so check DOM presence rather than visual size
  await expect(targetCountry).toBeAttached();

  // Leaflet's SVG renderer relies on clientX/clientY in click events.
  // Playwright's force:true synthetic click omits coordinates, so dispatch
  // a native MouseEvent with the element's centre coordinates instead.
  await page.evaluate(() => {
    const el = document.querySelector('[data-game-target="true"]');
    if (!el) throw new Error('game-target element not found');
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  });

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
  await expect(feedback).toContainText('Incorrect');

  await page.waitForTimeout(1500);
  await expect(feedback).toBeVisible();
});
