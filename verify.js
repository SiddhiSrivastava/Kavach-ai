/**
 * Kavach AI — end-to-end verification suite
 *
 * Drives the real prototype in a headless browser and asserts the behaviour of
 * every layer of the safety ladder across all six scenarios.
 *
 *   npm install playwright
 *   npx playwright install chromium
 *   node tests/verify.js
 *
 * Expected result: 43 passing checks, no console errors.
 */
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const context = await browser.newContext({
    permissions: ["microphone", "geolocation"],
    geolocation: { latitude: 28.6889, longitude: 77.2094 },
    viewport: { width: 430, height: 900 },
  });
  const page = await context.newPage();

  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  const R = [];
  const check = (n, p, d) => R.push((p ? "PASS" : "FAIL") + " — " + n + (d ? " :: " + d : ""));
  const nAlerts = () => page.evaluate(() => document.querySelectorAll(".alert-card").length);
  const bodyTxt = () => page.evaluate(() => document.body.innerText);
  const cool = (ms = 6000) => page.waitForTimeout(ms);

  await page.goto("file://" + path.join(__dirname, "..", "kavach_ai_demo.html"));
  await page.waitForTimeout(400);
  await page.click("#btnStart");
  await page.waitForTimeout(1200);

  /* ---------- A: threshold cap ---------- */
  await page.click("#scenA"); await page.waitForTimeout(250);
  check("A threshold capped at 85", (await page.textContent("#threshVal")).trim() === "85");
  check("A vigilance HIGH BAR", (await page.textContent("#vigilVal")).trim() === "HIGH BAR");
  check("A cap note shown", await page.isVisible("#capNote"));

  await page.click('button:has-text("Inject argument-level")');
  await page.waitForTimeout(2600);
  check("A: argument-level suppressed", !(await page.isVisible("#sentinelCard")));
  check("A: suppression counter incremented", (await page.textContent("#ovrCount")).trim() === "1");

  await cool();
  await page.click('button:has-text("Inject extreme")');
  await page.waitForTimeout(2600);
  check("A: extreme event clears the capped threshold", await page.isVisible("#sentinelCard"));
  check("A: window scales to 60 s at HIGH BAR", /^60 s/.test((await page.textContent("#winNote")).trim()));

  /* ---------- proof-of-life channels ---------- */
  await page.click('button:has-text("Unlock phone")');
  await page.waitForTimeout(400);
  check("PoL unlock resolves safely", !(await page.isVisible("#sentinelCard")) && (await nAlerts()) === 0);
  check("PoL unlock names the channel", /phone unlock/i.test(await bodyTxt()));

  await page.click("#scenB"); await page.waitForTimeout(250);
  check("B is PRE-ARMED at floor 30",
    (await page.textContent("#vigilVal")).trim() === "PRE-ARMED" &&
    (await page.textContent("#threshVal")).trim() === "30");

  await cool();
  await page.click('button:has-text("Inject extreme")');
  await page.waitForTimeout(2600);
  check("B: window is 15 s when pre-armed", /^15 s/.test((await page.textContent("#winNote")).trim()));
  await page.click('button:has-text("Say safe word")'); await page.waitForTimeout(300);
  check("PoL safe word resolves", !(await page.isVisible("#sentinelCard")));

  await cool();
  await page.click('button:has-text("Skip to Sentinel")'); await page.waitForTimeout(300);
  await page.click('button:has-text("Shake phone")'); await page.waitForTimeout(300);
  check("PoL shake resolves", !(await page.isVisible("#sentinelCard")));

  await cool();
  await page.click('button:has-text("Skip to Sentinel")'); await page.waitForTimeout(300);
  await page.click('button:has-text("Volume sequence")'); await page.waitForTimeout(300);
  check("PoL volume sequence resolves", !(await page.isVisible("#sentinelCard")));

  /* ---------- graded escalation ---------- */
  await cool();
  await page.click('button:has-text("Skip to Sentinel")');
  await page.waitForTimeout(16500);
  check("Timeout produces a SOFT notice", /SOFT NOTICE/.test(await bodyTxt()));
  check("Soft alert created", (await nAlerts()) === 1);

  await page.click("#recallBtn"); await page.waitForTimeout(400);
  check("Recall banner shown", (await page.textContent("#safeTitle")).trim() === "Recalled");
  await page.click('.tab[data-view="guardian"]'); await page.waitForTimeout(400);
  check("Recall reaches the guardian card", /Recalled by Ananya/.test(await bodyTxt()));
  await page.click('.tab[data-view="demo"]'); await page.waitForTimeout(200);

  await cool();
  await page.click('button:has-text("Skip to Sentinel")');
  await page.waitForTimeout(16500);
  await page.waitForTimeout(21000);
  check("Soft notice auto-promotes to FULL ALERT", /FULL ALERT/.test(await bodyTxt()));

  /* ---------- D: ride mode + crash ---------- */
  await page.click("#scenD"); await page.waitForTimeout(250);
  await page.click('button:has-text("Walking")'); await page.waitForTimeout(300);
  await page.click('button:has-text("Vehicle transit")'); await page.waitForTimeout(400);
  check("D: clean entry gives RIDE MODE", (await page.textContent("#modeName")).trim() === "RIDE MODE");
  check("D: motion shown as discounted", /discounted/.test(await page.textContent("#motionDisc")));

  await cool();
  await page.click('button:has-text("Inject road bumps")');
  await page.waitForTimeout(3000);
  check("D: road bumps do not open the sentinel in ride mode", !(await page.isVisible("#sentinelCard")));

  await page.click("#btnCrash"); await page.waitForTimeout(500);
  check("D: crash signature opens the sentinel", await page.isVisible("#sentinelCard"));
  check("D: crash is labelled", /crash/i.test(await page.textContent("#sentTitle")));
  await page.click('button:has-text("Unlock phone")'); await page.waitForTimeout(300);

  /* ---------- E: abduction watch ---------- */
  const before = await nAlerts();
  await page.click("#scenE"); await page.waitForTimeout(250);
  await cool();
  await page.click('button:has-text("Inject extreme")');
  await page.waitForTimeout(2600);
  check("E: event opens the sentinel", await page.isVisible("#sentinelCard"));
  await page.waitForTimeout(16500);                       // deliberately unanswered
  await page.click('button:has-text("Vehicle transit")');
  await page.waitForTimeout(600);
  check("E: dirty entry gives ABDUCTION WATCH", (await page.textContent("#modeName")).trim() === "ABDUCTION WATCH");
  check("E: threshold drops to the floor", (await page.textContent("#threshVal")).trim() === "30");
  check("E: abduction alert raised", (await nAlerts()) > before);

  await page.waitForTimeout(7000);
  check("E: live location trail is streaming",
    await page.evaluate(() => !!document.querySelector(".trail svg polyline")));
  await page.click('.tab[data-view="guardian"]'); await page.waitForTimeout(600);
  check("E: guardian sees the abduction context", /streaming live/i.test(await bodyTxt()));

  await page.click('button:has-text("Simulate: her phone powers off")');
  await page.waitForTimeout(400);
  check("Phone going dark is flagged to the guardian", /powered off during this watch/i.test(await bodyTxt()));

  /* ---------- F: behaviour only ---------- */
  await page.click('.tab[data-view="demo"]');
  await page.click("#scenF"); await page.waitForTimeout(300);
  await page.click('button:has-text("Off expected route")');
  await page.waitForTimeout(2200);
  check("F: route anomaly opens a proof-of-life check", await page.isVisible("#sentinelCard"));
  check("F: check is labelled as a route deviation", /route/i.test(await page.textContent("#sentTitle")));
  await page.click('button:has-text("Unlock phone")'); await page.waitForTimeout(300);

  await page.click('button:has-text("Start journey")');
  await page.waitForTimeout(22000);
  check("F: a missed ETA opens a check", await page.isVisible("#sentinelCard"));
  check("F: check is labelled as ETA missed", /ETA/i.test(await page.textContent("#sentTitle")));
  await page.click('button:has-text("Unlock phone")'); await page.waitForTimeout(300);

  /* ---------- manual bypass ---------- */
  await page.click("#scenA"); await page.waitForTimeout(300);
  const beforeM = await nAlerts();
  await page.click('button:has-text("Volume-button sequence")');
  await page.waitForTimeout(500);
  check("Manual trigger bypasses the HIGH BAR context", (await nAlerts()) === beforeM + 1);
  check("Manual alert is a FULL alert", /MANUAL TRIGGER/.test(await bodyTxt()));

  /* ---------- duress ---------- */
  await cool();
  await page.click('button:has-text("Skip to Sentinel")'); await page.waitForTimeout(300);
  const beforeD = await nAlerts();
  await page.click('#tapGrid .cell[data-i="2"]');
  await page.click('#tapGrid .cell[data-i="4"]');
  await page.click('#tapGrid .cell[data-i="6"]');
  await page.waitForTimeout(500);
  check("Duress shows a convincing Cancelled screen",
    /^Cancelled/.test((await page.textContent("#safeTitle")).trim()));
  check("Duress silently sends a FULL alert", (await nAlerts()) === beforeD + 1);

  /* ---------- C: repeat-suppression override ---------- */
  await page.click("#scenC"); await page.waitForTimeout(300);
  check("C: threshold high but capped", (await page.textContent("#threshVal")).trim() === "85");
  for (let i = 0; i < 3; i++) {
    await cool(5800);
    await page.click('button:has-text("Inject argument-level")');
    await page.waitForTimeout(2600);
  }
  await page.waitForTimeout(2200);
  check("C: repeat-suppression override fires", await page.isVisible("#sentinelCard"));
  check("C: override is explained on screen", /override/i.test(await bodyTxt()));

  /* ---------- guardian confirmation ---------- */
  await page.click('.tab[data-view="guardian"]'); await page.waitForTimeout(700);
  await page.click('.alert-card button:has-text("Confirm emergency")');
  await page.waitForTimeout(400);
  check("Guardian confirmation reaches authorities", /authorities contacted/i.test(await bodyTxt()));

  /* ---------- report ---------- */
  console.log(R.join("\n"));
  const failed = R.filter((r) => r.startsWith("FAIL")).length;
  console.log("\n" + (R.length - failed) + "/" + R.length + " checks passed");
  console.log("Console errors: " + (errors.length ? JSON.stringify(errors) : "none"));

  await browser.close();
  process.exit(failed ? 1 : 0);
})();
