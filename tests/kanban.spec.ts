// tests/kanban.spec.ts
import { test, expect } from '@playwright/test';

test('Kanban page screenshot', async ({ page }) => {
  await page.goto('http://localhost:3000/kanban');
  await expect(page).toHaveTitle(/Kanban/);
  await page.screenshot({ path: 'kanban.png' });
});
