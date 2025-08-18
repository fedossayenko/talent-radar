import { test, expect } from "@playwright/test";

test("debug web app loading", async ({ page }) => {
  // Listen for console logs and errors
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];
  
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`Console Error: ${msg.text()}`);
    } else {
      consoleLogs.push(`Console ${msg.type()}: ${msg.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(`Page Error: ${error.message}`);
  });

  // Navigate to the page
  await page.goto("http://localhost:3001/vacancies");
  await page.waitForLoadState("networkidle");
  
  // Wait a bit more for any async operations
  await page.waitForTimeout(5000);

  // Check the page content
  const bodyHTML = await page.innerHTML("body");
  console.log("Full page HTML:", bodyHTML);
  
  // Check if React has rendered anything
  const rootContent = await page.innerHTML("#root");
  console.log("Root div content:", rootContent);
  
  // Log any console messages
  console.log("Console logs:", consoleLogs);
  console.log("Console errors:", consoleErrors);
  
  // Check if there are any network errors
  const response = await page.goto("http://localhost:3001/vacancies", { waitUntil: "networkidle" });
  console.log("Page response status:", response?.status());
  
  // Check if API is reachable from the app
  try {
    const apiResponse = await page.evaluate(async () => {
      const response = await fetch("http://localhost:3000/api/v1/vacancies");
      return {
        status: response.status,
        ok: response.ok,
        text: await response.text().then(t => t.substring(0, 200))
      };
    });
    console.log("API response from browser:", apiResponse);
  } catch (error) {
    console.log("API fetch error:", error);
  }
  
  // Take a screenshot for debugging
  await page.screenshot({ path: "test-results/debug-page.png", fullPage: true });
});
