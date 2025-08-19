import { test, expect } from "@playwright/test";

test("basic vacancy test", async ({ page }) => {
  await page.goto("http://localhost:3001/vacancies");
  await page.waitForLoadState("networkidle");
  
  // Take a screenshot
  await page.screenshot({ path: "test-results/vacancy-list.png", fullPage: true });
  
  console.log("Page title:", await page.title());
  console.log("Page URL:", page.url());
  
  // Check if we have some content
  const bodyText = await page.textContent("body");
  console.log("Page content length:", bodyText?.length);
  
  expect(bodyText).toBeTruthy();
});
