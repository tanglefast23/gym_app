import { test, expect } from '@playwright/test';

test('core pages load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible();

  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});
