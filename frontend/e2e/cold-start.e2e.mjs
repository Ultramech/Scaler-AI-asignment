/**
 * Cold-start test. Simulates a hosted API that is asleep (refusing connections or answering 503) and checks the app
 * shows a "waking up" message and recovers by itself instead of hanging on "Signing in…". It also checks that a local
 * API that simply is not running gets a clear "start the backend" message rather than a fake wake-up wait.
 *
 * Needs a real API on TARGET and two running copies of the app:
 *   REMOTE_BASE  built with NEXT_PUBLIC_API_URL=http://api.example.test   (e.g. NEXT_PUBLIC_API_URL=http://api.example.test npm run dev -- -p 3100)
 *   LOCAL_BASE   built with the default API URL (http://localhost:8000)    (e.g. npm run dev -- -p 3101)
 *   REMOTE_BASE=http://localhost:3100/ LOCAL_BASE=http://localhost:3101/ TARGET=http://localhost:8000 npm run e2e:cold-start
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const BASE = process.env.REMOTE_BASE || "http://localhost:3100/";
const LOCAL_BASE = process.env.LOCAL_BASE || "http://localhost:3101/";
const APP_API = process.env.APP_API || "http://api.example.test";
const TARGET = process.env.TARGET || "http://localhost:8000";
const exe = process.env.CHROME_PATH || undefined;
const b = await chromium.launch({ executablePath: exe });
const ok = (m) => console.log("  ✓", m);

// A "sleeping" API: every request fails until `wakeAt`, then it is forwarded to the real backend.
async function sleepingApi(page, secondsAsleep, mode = "refuse") {
  const wakeAt = Date.now() + secondsAsleep * 1000;
  await page.route(`${APP_API}/**`, (route) => {
    if (Date.now() < wakeAt) return mode === "refuse" ? route.abort("connectionrefused") : route.fulfill({ status: 503, body: "Service Unavailable" });
    return route.continue({ url: route.request().url().replace(APP_API, TARGET) });
  });
}
const fresh = async (page) => { await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.getByRole("heading", { name: "Sign In" }).waitFor(); };

// A) user opens the sign-in page while the API sleeps (7 s), signs in straight away
{
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await sleepingApi(page, 7);
  await fresh(page);
  await page.getByPlaceholder("username@example.com").fill("sleepy@example.com"); await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("x"); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByText("Waking up the demo server").waitFor({ timeout: 10000 }); ok("A: shows a 'waking up' message instead of a frozen 'Signing in…'");
  assert.equal(await page.getByRole("button", { name: "Signing in…" }).count(), 1);
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor({ timeout: 60000 }); ok("A: signs in automatically once the server is awake (no need to open the API link)");
  await page.close();
}
// B) signed-in user opens the app while the API sleeps (7 s)
{
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE); await page.evaluate(() => localStorage.setItem("r53-session", JSON.stringify({ token: "route53-demo-session", user: { email: "x", name: "Demo Administrator" } })));
  await sleepingApi(page, 7);
  await page.goto(BASE + "#/hostedzones"); await page.reload();
  await page.getByText("Waking up the demo server").first().waitFor({ timeout: 12000 }); ok("B: signed-in user sees the 'waking up' notice");
  await page.getByRole("link", { name: "example.com" }).waitFor({ timeout: 60000 }); ok("B: zones load by themselves once the server is up");
  await page.getByText("Waking up the demo server").waitFor({ state: "detached", timeout: 10000 }); ok("B: the notice disappears on its own");
  await page.close();
}
// C) the proxy answers 503 while the instance starts (5 s): requests retry instead of failing
{
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE); await page.evaluate(() => localStorage.setItem("r53-session", JSON.stringify({ token: "route53-demo-session", user: { email: "x", name: "Demo Administrator" } })));
  await sleepingApi(page, 5, "503");
  await page.goto(BASE + "#/hostedzones"); await page.reload();
  await page.getByRole("link", { name: "example.com" }).waitFor({ timeout: 60000 }); ok("C: 503 'service starting' responses are retried until the API answers");
  assert.equal(await page.getByText("Unable to load hosted zones").count(), 0); ok("C: no error banner was shown");
  await page.close();
}
// D) API genuinely down: a clear message, not an endless spinner
{
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await sleepingApi(page, 100000);
  await fresh(page);
  await page.getByPlaceholder("username@example.com").fill("a@b.co"); await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("x"); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByText("Waking up the demo server").waitFor({ timeout: 10000 }); ok("D: waking message appears while the API is unreachable");
  await page.close();
}
// E) normal case: awake API, no message and sign-in is quick
{
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(`${APP_API}/**`, (r) => r.continue({ url: r.request().url().replace(APP_API, TARGET) }));
  await fresh(page);
  await page.getByPlaceholder("username@example.com").fill("a@b.co"); await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("x");
  const t0 = Date.now(); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
  assert.equal(await page.getByText("Waking up the demo server").count(), 0);
  ok(`E: awake API signs in in ${Date.now() - t0} ms with no extra message`);
  await page.close();
}
// F) LOCAL app, API not running: a clear instruction within seconds, and no misleading "waking up" message
{
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("http://localhost:8000/**", (route) => route.abort("connectionrefused"));
  await page.goto(LOCAL_BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.getByRole("heading", { name: "Sign In" }).waitFor();
  await page.getByPlaceholder("username@example.com").fill("a@b.co"); await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("x"); const t0 = Date.now(); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByText(/Can't reach the API at http:\/\/localhost:8000/).waitFor({ timeout: 15000 });
  assert.equal(await page.getByText("Waking up the demo server").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Sign in", exact: true }).isEnabled(), true);
  ok(`F: local API down -> clear "start the backend" message in ${((Date.now() - t0) / 1000).toFixed(1)} s, no fake wake-up message, button usable again`);
  await page.close();
}
// G) LOCAL app, API running: normal sign-in
{
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("http://localhost:8000/**", (r) => r.continue({ url: r.request().url().replace("http://localhost:8000", TARGET) }));
  await page.goto(LOCAL_BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.getByRole("heading", { name: "Sign In" }).waitFor();
  await page.getByPlaceholder("username@example.com").fill("a@b.co"); await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("x"); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
  ok("G: local API running -> signs in normally");
  await page.close();
}
await b.close();
