import { test } from "@playwright/test";

test("debug component state", async ({ page }) => {
  const consoleLogs: string[] = [];
  
  page.on("console", (msg) => {
    if (msg.text().includes("Debug -")) {
      consoleLogs.push(msg.text());
    }
  });

  await page.goto("http://localhost:3001/vacancies");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5000);

  console.log("Component Debug Logs:");
  consoleLogs.forEach(log => console.log(log));
});
