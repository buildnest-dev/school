import { expect, test } from "@playwright/test";

test("home page renders the hero and key sections without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One platform.");
  for (const id of [
    "concept",
    "features",
    "showcase",
    "roles",
    "academic-year",
    "campuses",
    "trust",
    "demo",
  ]) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  expect(errors).toEqual([]);
});

test("placeholder destinations resolve instead of 404ing", async ({ page }) => {
  for (const path of ["/sign-in", "/get-started", "/placeholder/privacy"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
  }
});

test("reduced motion keeps all content visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(page.locator("#show-title")).toBeVisible();
});

test("teacher can mark attendance end to end and is kept out of school admin", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.waitForURL("**/teacher");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kavita");
  await page.goto("/teacher/attendance/8A");
  await page
    .getByRole("radiogroup")
    .first()
    .getByRole("radio", { name: /Absent/ })
    .click();
  await page.getByRole("button", { name: "Submit attendance" }).click();
  await page.getByRole("button", { name: "Yes, submit" }).click();
  await expect(page.getByText("Attendance has been recorded.")).toBeVisible();
  await page.goto("/school");
  await expect(page.getByRole("heading", { name: /don’t have access/ })).toBeVisible();
});

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/teacher");
  await page.waitForURL("**/sign-in");
});
