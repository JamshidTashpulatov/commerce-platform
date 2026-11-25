import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import { chromium } from "playwright";

// Run against the local disposable database seeded by staff-api.integration.mjs.
test("Mini App login, logout and catalog navigation at mobile and desktop widths", async () => {
  assert.equal(process.env.COMMERCE_TEST_MODE, "1");
  const origin = "http://127.0.0.1:3100";
  assert.equal(process.env.APP_ORIGIN, origin);
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: randomUUID(),
    user: JSON.stringify({ id: 1000001 })
  });
  const key = createHmac("sha256", "WebAppData").update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const check = [...fields].map(([name, value]) => name + "=" + value).join("\n");
  fields.set("hash", createHmac("sha256", key).update(check).digest("hex"));

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 740 } });
    const fragment = new URLSearchParams({ tgWebAppData: fields.toString() });
    await page.goto(origin + "/login#" + fragment);
    await page.getByRole("button", { name: "Telegram orqali kirish" }).click();
    await page.waitForURL("**/investor");
    await page.getByRole("button", { name: "Hisobdan chiqish" }).click();
    await page.waitForURL("**/login");
    assert.equal((await page.request.get(origin + "/api/investor/summary")).status(), 403);

    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(origin + "/catalog");
      await page.getByRole("button", { name: "Keyingi sahifa" }).click();
      await page.getByRole("button", { name: "Oldingi sahifa" }).waitFor();
      await page.getByLabel("Qidirish").fill("Rare colour");
      await page.getByRole("heading", { name: "Test phone" }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      // Catalog cards link to the product page, which lists every stored variant.
      await page.getByRole("link", { name: /Test phone/ }).click();
      await page.getByRole("heading", { level: 1, name: "Test phone" }).waitFor();
      assert.equal(await page.locator("main select option").count(), 206);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
  } finally {
    await browser.close();
  }
});
