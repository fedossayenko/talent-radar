import { test } from "@playwright/test";

test("debug React Query data", async ({ page }) => {
  await page.goto("http://localhost:3001/vacancies");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5000); // Give more time for React Query

  // Inject script to access React DevTools or component state
  const debugInfo = await page.evaluate(() => {
    // Try to find any global debugging info
    const app = window as any;
    const rootElement = document.getElementById("root");
    
    return {
      hasReactDevTools: !!app.__REACT_DEVTOOLS_GLOBAL_HOOK__,
      rootChildren: rootElement?.children.length || 0,
      rootHTML: rootElement?.innerHTML?.substring(0, 300) || "no root",
      consoleErrors: [],
      networkErrors: []
    };
  });
  
  console.log("Debug Info:", JSON.stringify(debugInfo, null, 2));
  
  // Check the page content more thoroughly
  const pageContent = await page.textContent("body");
  console.log("Full page content:", pageContent);
  
  // Check if there are any error boundaries triggered
  const errorElements = await page.locator("text=Something went wrong").count();
  console.log("Error boundary elements:", errorElements);
  
  // Check if loading states
  const loadingElements = await page.locator("text=Loading").count();
  console.log("Loading elements:", loadingElements);
});
