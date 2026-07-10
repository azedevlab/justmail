import { expect, test } from "@playwright/test";

const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "";

test.describe("admin smoke", () => {
  test.skip(!PASSWORD, "SMOKE_PASSWORD not set");

  test("login shows the overview", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/Overview/)).toBeVisible({ timeout: 10_000 });
  });

  test("command palette opens with Cmd+K", async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.keyboard.press("Meta+K");
    await expect(
      page.getByPlaceholder(/type a command/i),
    ).toBeVisible();
  });
});
