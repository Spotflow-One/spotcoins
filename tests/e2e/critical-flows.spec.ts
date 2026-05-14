import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /Continue/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30_000 });
}

test.describe("Critical product flows", () => {
  test("Employee sends a recognition (web)", async ({ page }) => {
    await login(page, "employee-a@test.com", "password123");
    await page.goto("/dashboard/recognise");

    await page.getByLabel("Recipient").selectOption({ label: "Employee B (employee-b@test.com)" });
    await page.getByRole("button", { name: /ownership|collaboration|innovation|customer/i }).first().click();
    await page.getByPlaceholder("Share what they did well...").fill("Great teamwork and support today.");
    await page.getByRole("button", { name: "2" }).click();
    await page.getByRole("button", { name: "Send Spotcoin 🪙" }).click();

    await expect(page.getByText(/Spotcoin sent to/i)).toBeVisible();

    await page.goto("/dashboard/feed");
    await expect(page.getByText(/Great teamwork and support today\./i)).toBeVisible();
  });

  test("Admin invites a new user", async ({ page }) => {
    await login(page, "admin@test.com", "password123");
    await page.goto("/admin");

    await page.getByRole("button", { name: "Invite" }).click();
    await page.getByPlaceholder("name@company.com").fill("new.user@test.com");
    await page.getByRole("button", { name: "Send invite" }).click();

    await expect(page.getByText(/Invite sent successfully/i)).toBeVisible();
    await expect(page.getByText(/new\.user@test\.com/i)).toBeVisible();
  });

  test("Admin wallet shows disabled download approved payout", async ({ page }) => {
    await login(page, "admin@test.com", "password123");
    await page.goto("/admin/wallet");

    const downloadBtn = page.getByRole("button", { name: /download approved payout/i });
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toBeDisabled();
  });
});
