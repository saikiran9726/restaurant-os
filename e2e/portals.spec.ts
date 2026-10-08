import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];

const portals = [
  { route: '/waiter?e2e_role=WAITER', name: 'Waiter Portal', selector: 'header' },
  { route: '/kitchen?e2e_role=KITCHEN', name: 'Kitchen Display', selector: 'header' },
  { route: '/owner?e2e_role=OWNER', name: 'Owner Console', selector: 'header' },
  { route: '/login', name: 'Login Screen', selector: 'h1' },
];

test.describe('Portal Shell Responsive Rendering', () => {
  for (const vp of viewports) {
    test.describe(`${vp.name} viewport (${vp.width}px)`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const portal of portals) {
        test(`renders ${portal.name} at ${vp.width}px`, async ({ page }) => {
          await page.goto(portal.route);
          await expect(page.locator(portal.selector).first()).toBeVisible();

          // Waiter responsive navigation check
          if (portal.route.startsWith('/waiter')) {
            if (vp.width === 390) {
              await expect(
                page.getByRole('navigation', { name: 'Mobile Navigation' }),
              ).toBeVisible();
            } else {
              await expect(
                page.getByRole('navigation', { name: 'Waiter Navigation' }),
              ).toBeVisible();
            }
          }

          // Kitchen rush mode toggle test
          if (portal.route.startsWith('/kitchen')) {
            const rushToggle = page.getByRole('switch', { name: /toggle rush mode/i });
            await expect(rushToggle).toBeVisible();
            await expect(rushToggle).toHaveAttribute('aria-checked', 'false');
            await rushToggle.click();
            await expect(rushToggle).toHaveAttribute('aria-checked', 'true');
          }

          // Owner responsive layout check
          if (portal.route.startsWith('/owner')) {
            if (vp.width === 390) {
              await expect(
                page.getByRole('navigation', { name: 'Owner mobile navigation' }),
              ).toBeVisible();
            } else {
              await expect(
                page.getByRole('navigation', { name: 'Owner navigation' }),
              ).toBeVisible();
            }
          }
        });
      }
    });
  }
});

test.describe('Accessibility Audit', () => {
  test('Axe accessibility audit on /dev/components', async ({ page }) => {
    await page.goto('/dev/components');
    await page.waitForSelector('main');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // Color contrast evaluated visually under dark/light themes
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
