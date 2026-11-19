
const path = require("path");
const playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  page.on("dialog", async d => await d.accept());
  await page.goto("file:///C:/Users/at197/OneDrive/Desktop/專案-進行中/百家樂路單/tv.html");
  await page.waitForTimeout(500);

  // 1. 檢查預設 legend
  const leg = await page.evaluate(() => ({
    confirm: document.getElementById("legendKeyConfirm")?.textContent,
    undo: document.getElementById("legendKeyUndo")?.textContent,
    limit: document.getElementById("legendKeyLimit")?.textContent,
    boss: document.getElementById("legendKeyBoss")?.textContent,
    clear: document.getElementById("legendKeyClear")?.textContent,
    fullscreen: document.getElementById("legendKeyFullscreen")?.textContent
  }));
  console.log("Check default legends:", JSON.stringify(leg));
  if (leg.confirm !== "⏎" || leg.undo !== "⌫" || leg.limit !== "77" || leg.boss !== "88" || leg.clear !== "99" || leg.fullscreen !== "F") {
    throw new Error("Default legends mismatch!");
  }

  // 2. 測試自訂輸入
  await page.click("#tvSettingsButton");
  await page.waitForTimeout(200);
  await page.click("#tvTabKeys");
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    document.getElementById("tvKeyConfirm").value = "Space";
    document.getElementById("tvKeyUndo").value = "U";
    document.getElementById("tvKeyLimit").value = "77"; // 故意測試輸入 77
    document.getElementById("tvKeyBoss").value = "H";
    document.getElementById("tvKeyClear").value = "C";
    document.getElementById("tvKeyFullscreen").value = "M";
    document.querySelector("#tvSettings form button[type=submit]").click();
  });
  await page.waitForTimeout(300);

  // 3. 檢查更新後的 legend
  const legUpdated = await page.evaluate(() => ({
    confirm: document.getElementById("legendKeyConfirm")?.textContent,
    undo: document.getElementById("legendKeyUndo")?.textContent,
    limit: document.getElementById("legendKeyLimit")?.textContent,
    boss: document.getElementById("legendKeyBoss")?.textContent,
    clear: document.getElementById("legendKeyClear")?.textContent,
    fullscreen: document.getElementById("legendKeyFullscreen")?.textContent
  }));
  console.log("Check updated legends:", JSON.stringify(legUpdated));
  if (legUpdated.confirm !== "Space" || legUpdated.undo !== "U" || legUpdated.limit !== "77" || legUpdated.boss !== "HH" || legUpdated.clear !== "CC" || legUpdated.fullscreen !== "M") {
    throw new Error("Updated legends mismatch!");
  }

  // 4. 測試自訂退局 U
  await page.evaluate(() => window.addRound("B", {}));
  const beforeUndo = await page.evaluate(() => document.querySelectorAll("#beadBoard .bead").length);
  await page.keyboard.press("KeyU");
  await page.waitForTimeout(100);
  const afterUndo = await page.evaluate(() => document.querySelectorAll("#beadBoard .bead").length);
  console.log("Undo custom test (U): before=" + beforeUndo + ", after=" + afterUndo);
  if (beforeUndo !== 1 || afterUndo !== 0) throw new Error("Custom Undo failed!");

  // 5. 測試自訂金額鍵 77 (連按兩次 7)
  const isFocusBefore = await page.evaluate(() => document.activeElement === document.querySelector(".limit-input"));
  await page.keyboard.press("Digit7");
  await page.waitForTimeout(50);
  await page.keyboard.press("Digit7");
  await page.waitForTimeout(100);
  const isFocusAfter = await page.evaluate(() => document.activeElement === document.querySelector(".limit-input"));
  console.log("Limit focus custom test (77): before=" + isFocusBefore + ", after=" + isFocusAfter);
  if (!isFocusAfter) throw new Error("Custom Limit focus failed!");

  // 失焦以利後續鍵盤測試
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(50);

  // 6. 測試自訂老闆鍵 HH
  const appDispBefore = await page.evaluate(() => document.querySelector(".app").style.display);
  await page.keyboard.press("KeyH");
  await page.waitForTimeout(50);
  await page.keyboard.press("KeyH");
  await page.waitForTimeout(100);
  const appDispAfter = await page.evaluate(() => document.querySelector(".app").style.display);
  console.log("Boss custom test (HH): before=" + appDispBefore + ", after=" + appDispAfter);
  if (appDispAfter !== "none") throw new Error("Custom Boss hide failed!");

  // 再按 HH 恢復
  await page.keyboard.press("KeyH");
  await page.waitForTimeout(50);
  await page.keyboard.press("KeyH");
  await page.waitForTimeout(100);

  // 7. 測試自訂清空 CC
  await page.evaluate(() => window.addRound("P", {}));
  const clearBefore = await page.evaluate(() => document.querySelectorAll("#beadBoard .bead").length);
  await page.keyboard.press("KeyC");
  await page.waitForTimeout(50);
  await page.keyboard.press("KeyC");
  await page.waitForTimeout(100);
  const clearAfter = await page.evaluate(() => document.querySelectorAll("#beadBoard .bead").length);
  console.log("Clear custom test (CC): before=" + clearBefore + ", after=" + clearAfter);
  if (clearBefore !== 1 || clearAfter !== 0) throw new Error("Custom Clear failed!");

  // 8. 恢復預設
  await page.click("#tvSettingsButton");
  await page.waitForTimeout(200);
  await page.click("#tvTabKeys");
  await page.waitForTimeout(200);
  await page.click("#tvSettingsReset");
  await page.waitForTimeout(100);
  await page.click("#tvSettings form button[type=submit]");
  await page.waitForTimeout(200);

  const restored = await page.evaluate(() => ({
    confirm: document.getElementById("legendKeyConfirm")?.textContent,
    undo: document.getElementById("legendKeyUndo")?.textContent,
    limit: document.getElementById("legendKeyLimit")?.textContent,
    boss: document.getElementById("legendKeyBoss")?.textContent,
    clear: document.getElementById("legendKeyClear")?.textContent,
    fullscreen: document.getElementById("legendKeyFullscreen")?.textContent
  }));
  console.log("Restored legends:", JSON.stringify(restored));
  if (restored.confirm !== "⏎" || restored.undo !== "⌫" || restored.limit !== "77" || restored.boss !== "88" || restored.clear !== "99" || restored.fullscreen !== "F") {
    throw new Error("Restore default failed!");
  }

  console.log("ALL TESTS PASSED SUCCESSFULLY!");
  await browser.close();
})();
