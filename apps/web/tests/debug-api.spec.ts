import { test } from "@playwright/test";

test("debug API data structure", async ({ page }) => {
  await page.goto("http://localhost:3001/vacancies");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // Check what the React app is receiving
  const apiData = await page.evaluate(async () => {
    // Try to access the React Query data directly
    const response = await fetch("http://localhost:3000/api/v1/vacancies?page=1&limit=20&sortBy=updatedAt&order=desc");
    const data = await response.json();
    
    return {
      status: response.status,
      success: data.success,
      dataType: typeof data.data,
      dataLength: Array.isArray(data.data) ? data.data.length : "not array",
      firstItem: data.data?.[0] || null,
      pagination: data.pagination || null,
      fullResponse: JSON.stringify(data).substring(0, 500)
    };
  });
  
  console.log("API Data Structure:", JSON.stringify(apiData, null, 2));
});
