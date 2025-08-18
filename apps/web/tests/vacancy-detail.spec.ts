import { test, expect } from "@playwright/test";

test.describe("Vacancy Detail Page E2E Tests", () => {
  test("should navigate from vacancy list to detail page and verify content", async ({ page }) => {
    console.log("Starting vacancy detail page test...");

    // 1. Navigate to vacancy list page
    await page.goto("http://localhost:3001/vacancies");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000); // Wait for API data to load

    // Take screenshot of vacancy list page
    await page.screenshot({ 
      path: "test-results/vacancy-list-page.png", 
      fullPage: true 
    });

    console.log("Page title:", await page.title());
    console.log("Page URL:", page.url());
    
    // Check page content
    const bodyText = await page.textContent("body");
    console.log("Page content length:", bodyText?.length);
    console.log("Page content preview:", bodyText?.substring(0, 200));

    // 2. Look for vacancy cards with more flexible selectors
    const vacancySelectors = [
      "[data-testid=\"vacancy-card\"]",
      ".vacancy-card", 
      ".bg-white.rounded-lg.shadow-md",
      ".border.rounded-lg",
      ".card",
      "article",
      "[role=\"article\"]",
      "a[href*=\"/vacancies/\"]"
    ];

    let vacancyCards;
    let foundSelector = "";
    
    for (const selector of vacancySelectors) {
      vacancyCards = page.locator(selector);
      const count = await vacancyCards.count();
      console.log(`Checking selector "${selector}": found ${count} elements`);
      
      if (count > 0) {
        foundSelector = selector;
        break;
      }
    }

    if (!foundSelector) {
      console.log("No vacancy cards found with standard selectors. Checking page HTML structure...");
      const pageHTML = await page.innerHTML("body");
      console.log("Page HTML snippet:", pageHTML.substring(0, 500));
      
      // Try to find any clickable elements that might be vacancies
      const allLinks = page.locator("a");
      const linkCount = await allLinks.count();
      console.log(`Found ${linkCount} links on the page`);
      
      if (linkCount > 0) {
        for (let i = 0; i < Math.min(linkCount, 5); i++) {
          const linkHref = await allLinks.nth(i).getAttribute("href");
          const linkText = await allLinks.nth(i).textContent();
          console.log(`Link ${i}: href="${linkHref}", text="${linkText}"`);
        }
      }
      
      throw new Error("No vacancy cards found on the page");
    }

    console.log(`Found vacancy cards using selector: ${foundSelector}`);
    const cardCount = await vacancyCards.count();
    console.log(`Found ${cardCount} vacancy cards`);
    expect(cardCount).toBeGreaterThan(0);

    // 3. Examine the first card
    const firstCard = vacancyCards.first();
    await expect(firstCard).toBeVisible();
    
    const cardText = await firstCard.textContent();
    const cardHTML = await firstCard.innerHTML();
    console.log("First card text:", cardText);
    console.log("First card HTML:", cardHTML);
    
    expect(cardText).toBeTruthy();
    expect(cardText!.length).toBeGreaterThan(10);

    // 4. Click on the first vacancy card
    console.log("Clicking on first vacancy card...");
    await firstCard.click();
    
    // Wait for navigation
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 5. Verify we are on the detail page
    const newUrl = page.url();
    console.log("New URL after click:", newUrl);
    
    expect(newUrl).toMatch(/\/vacancies\/[a-zA-Z0-9]+$/);

    // Take screenshot of detail page
    await page.screenshot({ 
      path: "test-results/vacancy-detail-page.png", 
      fullPage: true 
    });

    // 6. Verify detail page content
    const detailPageText = await page.textContent("body");
    console.log("Detail page content length:", detailPageText?.length);
    console.log("Detail page content preview:", detailPageText?.substring(0, 300));
    
    expect(detailPageText).toBeTruthy();
    expect(detailPageText!.length).toBeGreaterThan(100);

    // Look for typical detail page elements
    const h1Elements = page.locator("h1");
    const h1Count = await h1Elements.count();
    console.log(`Found ${h1Count} h1 elements`);
    
    if (h1Count > 0) {
      const h1Text = await h1Elements.first().textContent();
      console.log("First h1 text:", h1Text);
    }

    // 7. Test navigation back
    console.log("Testing back navigation...");
    await page.goBack();
    await page.waitForLoadState("networkidle");
    
    const backUrl = page.url();
    console.log("URL after going back:", backUrl);
    expect(backUrl).toMatch(/\/vacancies\/?$/);

    // Take final screenshot
    await page.screenshot({ 
      path: "test-results/back-to-vacancy-list.png", 
      fullPage: true 
    });

    console.log("Test completed successfully!");
  });
});
