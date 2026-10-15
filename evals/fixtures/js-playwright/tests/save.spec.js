import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('save button has the expected label', async ({ page }) => {
  await page.setContent(readFileSync(new URL('../src/index.html', import.meta.url), 'utf8'));
  await expect(page.getByRole('button', { name: '储存', exact: true })).toBeVisible();
});
