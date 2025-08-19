import { test } from "@playwright/test";

test("debug all console logs", async ({ page }) => {
  const consoleLogs: string[] = [];
  
  page.on("console", (msg) => {
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });

  await page.goto("http://localhost:3001/vacancies");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  console.log("All Console Logs:");
  consoleLogs.forEach(log => console.log(log));
});
