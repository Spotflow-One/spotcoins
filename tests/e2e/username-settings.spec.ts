import { expect, test, type Page } from "@playwright/test";

async function loginEmployeeA(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill("employee-a@test.com");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: /Continue/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("Account feed username", () => {
  test("save michaelk then dashboard greeting shows it", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedResponses: { url: string; status: number }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("response", (res) => {
      const u = res.url();
      if (res.status() >= 400 && (u.includes("/api/") || u.includes("Next-Action"))) {
        failedResponses.push({ url: u, status: res.status() });
      }
    });

    await loginEmployeeA(page);

    await page.goto("/dashboard/settings");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible({ timeout: 15_000 });

    await page.locator("#username").fill("michaelk");
    await page.getByRole("button", { name: /Save username/i }).click();

    await expect(page.getByText("Profile updated")).toBeVisible({ timeout: 15_000 });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: /Hey michaelk/i })).toBeVisible({
      timeout: 15_000,
    });

    if (consoleErrors.length) {
      throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
    }
    if (failedResponses.length) {
      throw new Error(`HTTP errors: ${JSON.stringify(failedResponses, null, 2)}`);
    }
  });
});
