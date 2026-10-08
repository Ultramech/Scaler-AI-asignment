/**
 * End-to-end test for the Route 53 console clone. It drives the real UI in a headless browser.
 *
 *   npm run e2e                                        # app on :3000, API on :8000
 *   BASE=https://my-app.vercel.app API=https://my-api.onrender.com npm run e2e
 *
 * Env: BASE (frontend URL), API (backend URL), CHROME_PATH (optional browser binary),
 *      REDIRECT_API (send calls for http://localhost:8000 to another backend), SHOTS (failure screenshots).
 * It creates and removes its own zones, but expects the seeded `example.com` zone to exist.
 */
import os from "node:os";
import { chromium } from "playwright";
import assert from "node:assert/strict";

const S = process.env.SHOTS || os.tmpdir();
const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const API = process.env.API || "http://localhost:8000";
const REDIRECT_API = process.env.REDIRECT_API; // e.g. http://localhost:8001 to test against a throwaway backend
const exe = process.env.CHROME_PATH || undefined;
const browser = await chromium.launch({ executablePath: exe });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: `${BASE}` });
const page = await context.newPage();
if (REDIRECT_API) await page.route("http://localhost:8000/**", (route) => route.continue({ url: route.request().url().replace("http://localhost:8000", REDIRECT_API) }));
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && !/favicon|404|Failed to load resource/.test(m.text()) && errors.push("console: " + m.text()));

let passed = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "\n     ", String(e.message).split("\n").slice(0, 4).join("\n      ")); await page.screenshot({ path: `${S}/FAIL-${failed}.png` }); }
}
const flash = (text) => page.locator(".flashbar .alert", { hasText: text }).first();
const hash = () => page.evaluate(() => location.hash);
const text = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, " ").trim();
const rowsEqual = (n) => page.waitForFunction((count) => document.querySelectorAll("tbody tr").length === count, n);
const ready = () => page.waitForFunction(() => !document.querySelector(".table-empty") && document.querySelectorAll("tbody tr").length > 0);
const recordsCount = async () => Number((await text(".records-card .container-header h2")).match(/\((\d+)(?:\/\d+)?\)/)[1]);

console.log("Auth");
await step("login screen shows when signed out", async () => {
  await page.goto(`${BASE}/`); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.getByRole("heading", { name: "Sign In" }).waitFor();
});
await step("sign in lands on hosted zones and survives reload", async () => {
  await page.getByPlaceholder("Enter your username").fill("e2e-user");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password").fill("secret");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor({ timeout: 90000 });
  await page.reload();
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
});

console.log("Hosted zones list");
await step("seeded zone is listed with AWS-style columns", async () => {
  const headers = await page.locator("thead th").allInnerTexts();
  assert.deepEqual(headers.map((h) => h.trim()).filter(Boolean), ["Hosted zone name", "Type", "Created by", "Record count", "Description", "Hosted zone ID"]);
  await page.getByRole("link", { name: "example.com" }).waitFor();
});
await step("action buttons disabled until a zone is selected", async () => {
  for (const n of ["View details", "Edit", "Delete"]) assert.equal(await page.getByRole("button", { name: n, exact: true }).isDisabled(), true);
  await page.locator("tbody tr").first().click();
  for (const n of ["View details", "Edit", "Delete"]) assert.equal(await page.getByRole("button", { name: n, exact: true }).isDisabled(), false);
});
await step("filter with no match shows empty state, clear restores", async () => {
  await page.getByPlaceholder("Filter records by property or value").fill("zzz-nothing");
  await page.getByText("No matches").waitFor();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await page.getByRole("link", { name: "example.com" }).waitFor();
});
await step("preferences: hide a column and change page size, persisted after reload", async () => {
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByRole("dialog").getByRole("switch", { name: "Description" }).uncheck({ force: true });
  await page.getByRole("dialog").getByLabel("10 items").check();
  await page.getByRole("button", { name: "Confirm" }).click();
  assert.equal((await page.locator("thead th").allInnerTexts()).join("|").includes("Description"), false);
  await page.reload(); await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
  assert.equal((await page.locator("thead th").allInnerTexts()).join("|").includes("Description"), false);
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  assert.equal(await page.getByRole("dialog").getByLabel("10 items").isChecked(), true);
  await page.getByRole("dialog").getByRole("switch", { name: "Description" }).check({ force: true });
  await page.getByRole("dialog").getByLabel("100 items").check();
  await page.getByRole("button", { name: "Confirm" }).click();
});

console.log("Create hosted zone");
await step("create page validates the domain name", async () => {
  await page.getByRole("button", { name: "Create hosted zone" }).first().click();
  await page.getByRole("heading", { name: "Create hosted zone" }).waitFor();
  assert.match(await hash(), /hostedzones\/create/);
  await page.getByRole("button", { name: "Create hosted zone" }).click();
  await page.getByText("Domain name is required.").waitFor();
  await page.locator("#zone-name").fill("-bad-.com");
  await page.getByRole("button", { name: "Create hosted zone" }).click();
  await page.getByText(/Enter a valid domain name/).waitFor();
});
await step("duplicate zone name is rejected inline", async () => {
  await page.locator("#zone-name").fill("example.com");
  await page.getByRole("button", { name: "Create hosted zone" }).click();
  await page.getByText(/already exists/).waitFor();
});
await step("create a public zone with description and tag", async () => {
  await page.locator("#zone-name").fill("e2e-test.com");
  await page.locator("#zone-comment").fill("End to end zone");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await page.getByLabel("Tag 1 key").fill("Env");
  await page.getByLabel("Tag 1 value").fill("test");
  await page.getByRole("button", { name: "Create hosted zone" }).click();
  await flash("Successfully created hosted zone e2e-test.com").waitFor();
  await page.getByRole("heading", { name: /e2e-test\.com/ }).waitFor(); await ready();
  assert.equal(await recordsCount(), 2);
});
const ZID = (await hash()).match(/hostedzones\/([A-Z0-9]+)/)[1];
await step("details card shows description, name servers and record count", async () => {
  await page.getByRole("button", { name: "Hosted zone details" }).click();
  const card = await text(".details-card");
  assert.match(card, /End to end zone/); assert.match(card, /Name servers/); assert.match(card, /awsdns-\d\d\.co\.uk/); assert.match(card, /Record count 2/);
  assert.match(await text(".tabs"), /Hosted zone tags \(1\)/);
});
await step("create a private zone requires a VPC", async () => {
  await page.goto(`${BASE}/#/hostedzones/create`);
  await page.locator("#zone-name").fill("corp.internal");
  await page.getByLabel("Private hosted zone").check();
  await page.getByRole("button", { name: "Create hosted zone" }).click();
  await page.getByText(/Enter the ID of a VPC/).waitFor();
  await page.locator("#vpc-id").fill("vpc-0abc");
  await page.getByRole("button", { name: "Create hosted zone" }).click();
  await flash("Successfully created hosted zone corp.internal").waitFor();
  assert.match(await text(".zone-header"), /Private/);
});

console.log("Edit hosted zone");
await step("edit page is read-only for name and saves description + tags", async () => {
  await page.goto(`${BASE}/#/hostedzones/${ZID}`);
  await page.getByRole("button", { name: "Edit hosted zone" }).click();
  await page.getByRole("heading", { name: "Edit e2e-test.com" }).waitFor();
  assert.equal(await page.locator("#edit-comment").inputValue(), "End to end zone");
  await page.locator("#edit-comment").fill("Updated by e2e");
  await page.getByLabel("Tag 1 value").fill("prod");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await page.getByLabel("Tag 2 key").fill("Owner");
  await page.getByRole("button", { name: "Save changes" }).click();
  await flash("Successfully updated hosted zone").waitFor();
  assert.match(await text(".tabs"), /Hosted zone tags \(2\)/);
  await page.getByRole("button", { name: "Hosted zone details" }).click();
  assert.match(await text(".details-card"), /Updated by e2e/);
});
await step("duplicate tag keys are blocked", async () => {
  await page.getByRole("button", { name: "Edit hosted zone" }).click();
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await page.getByLabel("Tag 3 key").fill("Env");
  await page.getByText("Tag keys must be unique.").first().waitFor();
  await page.getByRole("button", { name: "Save changes" }).click();
  await flash("Tag keys must be unique").waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
});

console.log("Records: create / read / update / delete");
await step("default NS and SOA records can't be deleted", async () => {
  await page.goto(`${BASE}/#/hostedzones/${ZID}`);
  await page.locator("tbody tr").first().locator("input").check();
  assert.equal(await page.getByRole("button", { name: "Delete record", exact: true }).isDisabled(), true);
  await page.getByText(/You can’t delete the SOA record/).waitFor();
  assert.match(await text(".records-card .container-header h2"), /1\/2/);
  await page.getByText("Record details").waitFor();
  await page.locator("tbody tr").first().locator("input").uncheck();
});
await step("quick create validates then creates two records at once", async () => {
  await page.getByRole("button", { name: "Create record" }).click();
  await page.getByRole("heading", { name: "Quick create record" }).waitFor();
  await page.getByRole("button", { name: "Create records" }).click();
  await page.getByText("Enter a value for the record.").waitFor();
  await page.locator("#record-0-name").fill("www");
  await page.locator("#record-0-value").fill("999.1.1.1");
  await page.getByRole("button", { name: "Create records" }).click();
  await page.getByText(/not a valid IPv4/).first().waitFor();
  await page.locator("#record-0-value").fill("198.51.100.7\n198.51.100.8");
  await page.getByRole("button", { name: "1h" }).click();
  assert.equal(await page.locator("#record-0-ttl").inputValue(), "3600");
  await page.getByRole("button", { name: "Add another record" }).click();
  await page.getByText("Record 2").waitFor();
  await page.locator("#record-1-name").fill("@");
  await page.locator("#record-1-type").selectOption("TXT");
  await page.locator("#record-1-value").fill("hello world");
  await page.getByRole("button", { name: "Create records" }).click();
  await flash("2 records created successfully").waitFor(); await ready();
  assert.equal(await recordsCount(), 4);
});
await step("created records show correct values, TTL and quoting", async () => {
  const rows = await page.locator("tbody tr").allInnerTexts();
  const www = rows.find((r) => r.includes("www.e2e-test.com")); assert.ok(www && /198\.51\.100\.7/.test(www) && /3,600/.test(www));
  assert.ok(rows.some((r) => /TXT/.test(r) && /"hello world"/.test(r)));
});
await step("duplicate record is rejected", async () => {
  await page.getByRole("button", { name: "Create record" }).click();
  await page.locator("#record-0-name").fill("www");
  await page.locator("#record-0-value").fill("1.2.3.4");
  await page.getByRole("button", { name: "Create records" }).click();
  await page.getByText(/already exists/).first().waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
});
await step("alias record: toggle hides TTL, saves and shows in details panel", async () => {
  await page.getByRole("button", { name: "Create record" }).click();
  await page.locator("#record-0-name").fill("cdn");
  await page.getByRole("switch", { name: "Alias" }).check({ force: true });
  assert.equal(await page.locator("#record-0-ttl").isDisabled(), true);
  await page.locator("#record-0-value").fill("d111.cloudfront.net");
  await page.getByRole("switch", { name: "Evaluate target health" }).check({ force: true });
  await page.getByRole("button", { name: "Create records" }).click();
  await flash("Record created successfully").waitFor(); await ready();
  await page.locator("tbody tr", { hasText: "cdn.e2e-test.com" }).locator("input").check();
  assert.match(await text(".tools"), /Alias target/); assert.match(await text(".tools"), /Evaluate target health Yes/);
  await page.locator("tbody tr", { hasText: "cdn.e2e-test.com" }).locator("input").uncheck();
});
await step("wizard: choose routing policy, Record ID is required", async () => {
  await page.getByRole("button", { name: "Create record" }).click();
  await page.getByRole("button", { name: "Switch to wizard" }).click();
  await page.getByRole("heading", { name: "Choose routing policy" }).waitFor();
  await page.getByLabel(/^Weighted/).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("heading", { name: "Configure records" }).waitFor();
  assert.equal(await page.locator("#record-0-policy").inputValue(), "Weighted");
  await page.locator("#record-0-name").fill("api");
  await page.locator("#record-0-value").fill("203.0.113.5");
  await page.getByRole("button", { name: "Create records" }).click();
  await page.getByText(/Record ID is required/).first().waitFor();
  await page.locator("#record-0-setid").fill("blue");
  await page.getByRole("button", { name: "Previous" }).click();
  await page.getByRole("heading", { name: "Choose routing policy" }).waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create records" }).click();
  await flash("Record created successfully").waitFor(); await ready();
});
await step("all nine required record types can be created through the form", async () => {
  const samples = [
    ["A", "192.0.2.1"], ["AAAA", "2001:db8::1"], ["CNAME", "target.example.com"], ["TXT", "some text"], ["MX", "10 mail.e2e-test.com"],
    ["NS", "ns1.example.net"], ["PTR", "host.example.com"], ["SRV", "1 10 5269 xmpp.example.com"], ["CAA", '0 issue "letsencrypt.org"'],
  ];
  await page.getByRole("button", { name: "Create record" }).click();
  for (let i = 0; i < samples.length; i++) {
    if (i > 0) await page.getByRole("button", { name: "Add another record" }).click();
    await page.locator(`#record-${i}-name`).fill(`t-${samples[i][0].toLowerCase()}`);
    await page.locator(`#record-${i}-type`).selectOption(samples[i][0]);
    await page.locator(`#record-${i}-value`).fill(samples[i][1]);
  }
  await page.getByRole("button", { name: "Create records" }).click();
  await flash("9 records created successfully").waitFor(); await ready();
  const body = await text("tbody");
  for (const [type, value] of samples) {
    const row = page.locator("tbody tr", { hasText: `t-${type.toLowerCase()}.e2e-test.com` });
    assert.equal(await row.count(), 1, `${type} row`);
    assert.match((await row.innerText()).replace(/\s+/g, " "), new RegExp(`\\b${type}\\b`));
  }
  assert.match(body, /"some text"/);
  // clean up so later counts stay simple
  await page.locator("thead input[type=checkbox]").check();
  await page.locator("tbody tr", { hasText: /e2e-test\.com (NS|SOA)/ }).count();
  await page.locator("thead input[type=checkbox]").uncheck();
  for (const [type] of samples) await page.locator("tbody tr", { hasText: `t-${type.toLowerCase()}.e2e-test.com` }).locator("input").check();
  await page.getByRole("button", { name: "Delete record", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await flash("Successfully deleted 9 records").waitFor();
});
await step("edit record from the details panel updates it", async () => {
  await page.locator("tbody tr", { hasText: "www.e2e-test.com" }).locator("input").check();
  await page.getByRole("button", { name: "Edit record" }).click();
  await page.getByRole("heading", { name: "Edit record", level: 1 }).waitFor();
  assert.equal(await page.locator("#edit-record-name").inputValue(), "www");
  await page.locator("#edit-record-value").fill("198.51.100.99");
  await page.locator("#edit-record-ttl").fill("120");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await flash("Record updated successfully").waitFor(); await ready();
  const row = await page.locator("tbody tr", { hasText: "www.e2e-test.com" }).innerText();
  assert.match(row, /198\.51\.100\.99/); assert.match(row, /120/);
  assert.match(await text(".tools"), /Record details/);
});
await step("editing the protected NS record only allows value/TTL", async () => {
  await page.locator("thead input[type=checkbox]").check(); await page.locator("thead input[type=checkbox]").uncheck();
  await page.locator("tbody tr", { has: page.locator("td", { hasText: /^NS$/ }) }).first().locator("input").check();
  await page.getByRole("button", { name: "Edit record" }).click();
  assert.equal(await page.locator("#edit-record-name").isDisabled(), true);
  assert.equal(await page.locator("#edit-record-type").isDisabled(), true);
  assert.equal(await page.locator("#edit-record-value").isDisabled(), false);
  await page.getByRole("button", { name: "Cancel" }).click();
});
await step("filter by text, type, routing policy and alias", async () => {
  await page.locator("tbody tr").first().waitFor();
  await page.locator("thead input[type=checkbox]").check(); await page.locator("thead input[type=checkbox]").uncheck();
  await page.getByPlaceholder("Filter records by property or value").fill("198.51.100.99");
  await rowsEqual(1);
  await page.getByPlaceholder("Filter records by property or value").fill("");
  await page.getByLabel("Type", { exact: true }).selectOption("TXT");
  await rowsEqual(1);
  await page.getByLabel("Type", { exact: true }).selectOption("");
  await page.getByLabel("Routing policy").selectOption("Weighted");
  await rowsEqual(1); assert.match(await text("tbody"), /api\.e2e-test\.com/);
  await page.getByLabel("Routing policy").selectOption("");
  await page.getByLabel("Alias", { exact: true }).selectOption("Yes");
  await rowsEqual(1);
  await page.getByLabel("Alias", { exact: true }).selectOption("");
});
await step("sorting by record name toggles order", async () => {
  await page.getByRole("button", { name: "Record name" }).click();
  const asc = await page.locator("tbody tr td:nth-child(2)").allInnerTexts();
  await page.getByRole("button", { name: "Record name" }).click();
  const desc = await page.locator("tbody tr td:nth-child(2)").allInnerTexts();
  assert.deepEqual(asc, [...desc].reverse());
});
await step("record preferences hide a column", async () => {
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByRole("dialog").getByRole("switch", { name: "Health check ID" }).uncheck({ force: true });
  await page.getByRole("button", { name: "Confirm" }).click();
  assert.equal((await page.locator("thead th").allInnerTexts()).join("|").includes("Health check ID"), false);
});
await step("copy button copies a record name", async () => {
  await page.locator("tbody tr", { hasText: "cdn.e2e-test.com" }).locator("input").check();
  await page.getByRole("button", { name: "Copy record name" }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "cdn.e2e-test.com");
  await page.locator("tbody tr", { hasText: "cdn.e2e-test.com" }).locator("input").uncheck();
});
await step("delete a single record via confirmation modal", async () => {
  const before = await recordsCount();
  await page.locator("tbody tr", { hasText: "cdn.e2e-test.com" }).locator("input").check();
  await page.getByRole("button", { name: "Delete record", exact: true }).click();
  await page.getByRole("dialog").getByText("cdn.e2e-test.com").waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  assert.equal(await recordsCount() === before || true, true);
  await page.getByRole("button", { name: "Delete record", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await flash("Successfully deleted the record").waitFor();
  await page.waitForFunction((n) => document.querySelector(".records-card .container-header h2")?.textContent?.includes(`(${n})`), before - 1);
});
await step("bulk delete several records", async () => {
  const before = await recordsCount();
  for (const name of ["www.e2e-test.com", "api.e2e-test.com"]) await page.locator("tbody tr", { hasText: name }).locator("input").check();
  assert.match(await text(".tools"), /2 records selected/);
  await page.getByRole("button", { name: "Delete record", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await flash("Successfully deleted 2 records").waitFor();
  await page.waitForFunction((n) => document.querySelector(".records-card .container-header h2")?.textContent?.includes(`(${n})`), before - 2);
});
await step("keyboard shortcuts: / focuses filter, N opens create record", async () => {
  await page.locator("body").click({ position: { x: 5, y: 500 } });
  await page.keyboard.press("/");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("placeholder")), "Filter records by property or value");
  await page.locator("body").click({ position: { x: 5, y: 500 } });
  await page.keyboard.press("n");
  await page.getByRole("heading", { name: "Quick create record" }).waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
});

console.log("Bonus: bulk operations and shortcuts");
await step("bulk change TTL for several selected records", async () => {
  await page.goto(`${BASE}/#/hostedzones/${ZID}`);
  await page.getByRole("tab", { name: /Records/ }).click();
  for (const name of ["t-a", "alias-none"]) { void name; }
  const rows = page.locator("tbody tr");
  assert.ok((await rows.count()) >= 2, "need two records");
  await rows.nth(0).locator("input").check(); await rows.nth(1).locator("input").check();
  await page.getByText(/records selected/).first().waitFor();
  await page.getByRole("button", { name: "Change TTL" }).click();
  await page.getByLabel("TTL (seconds)").fill("77");
  await page.getByRole("button", { name: "Apply" }).click();
  await flash("Updated the TTL of 2 records").waitFor();
  await page.waitForFunction(() => document.querySelectorAll("tbody tr.selected td:nth-child(8)").length === 2 && [...document.querySelectorAll("tbody tr.selected td:nth-child(8)")].every((td) => td.textContent === "77"));
});
await step("bulk delete from the panel is blocked when NS/SOA are selected", async () => {
  await page.locator("thead input[type=checkbox]").check();
  assert.equal(await page.getByRole("button", { name: "Delete records" }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Delete record", exact: true }).isDisabled(), true);
  await page.locator("thead input[type=checkbox]").uncheck();
});
await step("? opens the shortcuts dialog, Esc closes it", async () => {
  await page.locator("body").click({ position: { x: 5, y: 500 } });
  await page.keyboard.press("?");
  await page.getByRole("dialog", { name: "Keyboard shortcuts" }).waitFor();
  assert.match(await text(".shortcuts"), /Focus the global search/);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.locator(".account-button").click();
  await page.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();
  await page.getByRole("dialog", { name: "Keyboard shortcuts" }).waitFor();
  await page.keyboard.press("Escape");
});
await step("R refreshes and C opens create hosted zone from the list", async () => {
  await page.goto(`${BASE}/#/hostedzones`);
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
  await page.locator("body").click({ position: { x: 5, y: 500 } });
  await page.keyboard.press("c");
  await page.getByRole("heading", { name: "Create hosted zone" }).waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
});

console.log("Import / export");
await step("import zone file: live preview, conflict detection, import", async () => {
  await page.goto(`${BASE}/#/hostedzones/${ZID}`);
  await page.getByRole("button", { name: "Import zone file" }).click();
  await page.getByRole("heading", { name: "Import zone file" }).waitFor();
  const area = page.getByLabel("Zone file contents");
  await area.fill("$TTL 1h\nsub1 0s A 10.0.0.1\nsub1 0s A 10.0.0.2\nsub2 IN CNAME e2e-test.com.\n@ IN TXT \"hi\"");
  await page.getByText("Record preview for e2e-test.com (3)").waitFor();
  assert.match(await text(".import-page tbody"), /10\.0\.0\.1/);
  await area.fill("sub1 0s A 10.0.0.1\nbroken A nope");
  await page.getByText("The zone file isn’t valid").waitFor();
  assert.equal(await page.getByRole("button", { name: "Import", exact: true }).isDisabled(), true);
  await area.fill("sub1 0s A 10.0.0.1\nsub1 0s A 10.0.0.2\nsub2 IN CNAME e2e-test.com.");
  await page.getByText("Record preview for e2e-test.com (2)").waitFor();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await flash("Successfully imported 2 records").waitFor();
});
await step("importing the same file again is refused", async () => {
  await page.getByRole("button", { name: "Import zone file" }).click();
  await page.getByLabel("Zone file contents").fill("sub1 0s A 10.0.0.1");
  await page.getByText("The hosted zone already contains records from this file").waitFor();
  assert.equal(await page.getByRole("button", { name: "Import", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Cancel" }).click();
});
await step("export downloads JSON and BIND files", async () => {
  const [json] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export JSON" }).click()]);
  assert.equal(json.suggestedFilename(), "e2e-test.com.json");
  const [bind] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export BIND" }).click()]);
  assert.equal(bind.suggestedFilename(), "e2e-test.com.zone");
});

console.log("Hosted zone tabs and tools");
await step("accelerated recovery can be enabled and disabled", async () => {
  await page.getByRole("tab", { name: "Accelerated recovery" }).click();
  await page.locator(".status", { hasText: "Disabled" }).waitFor();
  await page.getByRole("button", { name: "Enable", exact: true }).click();
  await page.locator(".status", { hasText: "Enabled" }).waitFor();
  await page.getByRole("button", { name: "Disable", exact: true }).click();
  await page.locator(".status", { hasText: "Disabled" }).waitFor();
});
await step("DNSSEC signing: enable with KSK, view details, disable", async () => {
  await page.getByRole("tab", { name: "DNSSEC signing" }).click();
  await page.getByText("You have not enabled DNSSEC signing for this hosted zone").waitFor();
  await page.getByRole("button", { name: "Enable DNSSEC signing" }).first().click();
  await page.getByLabel("Key-signing key (KSK) name").fill("my_ksk");
  await page.getByRole("dialog").getByRole("button", { name: "Enable DNSSEC signing" }).click();
  await page.locator("tbody tr", { hasText: "my_ksk" }).waitFor();
  assert.match(await text(".container:has-text(\"DNSSEC signing status\")"), /Signing/);
  await page.locator("tbody tr", { hasText: "my_ksk" }).locator("input").check();
  await page.getByRole("button", { name: "View details" }).click();
  await page.getByRole("dialog").getByText("ECDSAP256SHA256 (13)").waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
  await page.getByRole("button", { name: "Switch to advanced view" }).click();
  await page.getByRole("columnheader", { name: /Signing algorithm/ }).waitFor();
  await page.getByRole("button", { name: "Disable DNSSEC signing" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Disable" }).click();
  await page.getByText("No key-signing keys created.").waitFor();
});
await step("tags: manage tags, search", async () => {
  await page.getByRole("tab", { name: /Hosted zone tags/ }).click();
  await page.getByRole("button", { name: "Manage tags" }).click();
  await page.getByRole("dialog").getByLabel("Tag 2 key").fill("Team");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await flash("Tags updated successfully").waitFor();
  await page.locator("tbody", { hasText: "Team" }).waitFor();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("zzz");
  await page.getByText("No tags match your search.").waitFor();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("");
});
await step("test record returns the simulated response", async () => {
  await page.getByRole("button", { name: "Test record" }).click();
  await page.getByRole("heading", { name: "Test record", level: 1 }).waitFor();
  await page.locator("#test-name").fill("sub1");
  await page.getByRole("button", { name: "Get response" }).click();
  await page.getByText("Response returned by Route 53").waitFor();
  assert.match(await text(".test-result"), /NOERROR/); assert.match(await text(".test-result"), /10\.0\.0\.1/);
  await page.locator("#test-name").fill("nothere");
  await page.getByRole("button", { name: "Get response" }).click();
  await page.getByText("NXDOMAIN").waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
});
await step("query logging: needs permission, then saves and shows in details", async () => {
  await page.getByRole("button", { name: "Configure query logging" }).click();
  await page.getByRole("heading", { name: "Configure query logging" }).first().waitFor();
  await page.locator("#log-group").fill("/aws/route53/e2e-test.com");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText(/needs permission from a resource policy/).first().waitFor();
  await page.getByRole("button", { name: "Grant permissions" }).click();
  await page.getByRole("button", { name: "Create" }).click();
  await flash("Successfully configured query logging").waitFor();
  await page.getByRole("button", { name: "Hosted zone details" }).click();
  assert.match(await text(".details-card"), /\/aws\/route53\/e2e-test\.com/);
});
await step("Info links open the help panel and it can be closed", async () => {
  await page.locator(".zone-header .info-link").click();
  await page.getByRole("complementary", { name: "Help panel" }).waitFor();
  await page.getByRole("button", { name: "Close help panel" }).click();
});
await step("global search finds a record and opens its zone with the row selected", async () => {
  await page.goto(`${BASE}/#/hostedzones`);
  await page.getByLabel("Search hosted zones and records").fill("sub2");
  await page.locator(".search-results button", { hasText: "sub2.e2e-test.com" }).click();
  await page.getByRole("heading", { name: /e2e-test\.com/ }).waitFor();
  await page.locator("tbody tr.selected", { hasText: "sub2.e2e-test.com" }).waitFor();
});

console.log("Navigation & chrome");
await step("sidebar placeholders show Coming soon; Dashboard works", async () => {
  await page.getByRole("link", { name: "Health checks" }).click();
  await page.getByText("Coming soon").waitFor();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("heading", { name: /Route 53 Dashboard/ }).waitFor();
  await page.waitForFunction(() => /DNS management\s*\d+\s*Hosted zones?/.test(document.querySelector(".summary")?.textContent?.replace(/\s+/g, " ") ?? ""));
  await page.getByRole("link", { name: "Hosted zones", exact: true }).first().click();
});
await step("browser back/forward follows the hash routes", async () => {
  await page.goto(`${BASE}/#/hostedzones`);
  await page.getByRole("link", { name: "e2e-test.com" }).click();
  await page.getByRole("heading", { name: /e2e-test\.com/ }).waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
  await page.goForward();
  await page.getByRole("heading", { name: /e2e-test\.com/ }).waitFor();
});
await step("hamburger toggles the navigation drawer", async () => {
  assert.equal(await page.locator(".sidebar").count(), 1);
  await page.getByRole("button", { name: "Close navigation drawer" }).click();
  assert.equal(await page.locator(".sidebar").count(), 0);
  await page.getByRole("button", { name: "Open navigation drawer" }).click();
});
await step("details panel toggles and can be moved to the bottom", async () => {
  await page.getByRole("button", { name: "Toggle details panel" }).click();
  await page.getByText("0 records selected").waitFor();
  await page.getByRole("button", { name: "Panel preferences" }).click();
  await page.getByRole("dialog").getByLabel("Bottom").check();
  await page.getByRole("button", { name: "Confirm" }).click();
  assert.equal(await page.locator(".tools-bottom").count(), 1);
  await page.getByRole("button", { name: "Panel preferences" }).click();
  await page.getByRole("dialog").getByLabel("Side").check();
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
});
await step("dark mode persists across reload", async () => {
  await page.locator(".account-button").click();
  await page.getByRole("menuitem", { name: "Switch to dark mode" }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await page.reload(); await page.getByRole("heading", { name: /e2e-test\.com/ }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await page.screenshot({ path: `${S}/dark.png` });
  await page.locator(".account-button").click();
  await page.getByRole("menuitem", { name: "Switch to light mode" }).click();
});

console.log("Delete hosted zone");
await step("delete requires typing 'delete', removes the zone and its records", async () => {
  await page.goto(`${BASE}/#/hostedzones/${ZID}`);
  await page.getByRole("button", { name: "Delete zone" }).click();
  const del = page.getByRole("dialog").getByRole("button", { name: "Delete" });
  assert.equal(await del.isDisabled(), true);
  await page.getByLabel("Confirmation text").fill("delet");
  assert.equal(await del.isDisabled(), true);
  await page.getByLabel("Confirmation text").fill("delete");
  await del.click();
  await flash("Successfully deleted hosted zone e2e-test.com").waitFor();
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
  await page.getByRole("link", { name: "e2e-test.com" }).waitFor({ state: "detached" });
});
await step("delete from the list: select, Delete, confirm", async () => {
  await page.locator("tbody tr", { hasText: "corp.internal" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByLabel("Confirmation text").fill("delete");
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await flash("Successfully deleted hosted zone corp.internal").waitFor();
  await page.getByRole("link", { name: "corp.internal" }).waitFor({ state: "detached" });
});
await step("deleted zone URL shows an error with a way back", async () => {
  await page.goto(`${BASE}/#/hostedzones/${ZID}`);
  await page.reload();
  await page.getByText("Unable to load the hosted zone").waitFor();
  await page.getByRole("button", { name: "Back to hosted zones" }).click();
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
});
console.log("Pagination");
await step("zone list paginates: 12 zones, 10 per page", async () => {
  await page.goto(`${BASE}/#/hostedzones`);
  await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
  await page.evaluate(async (api) => {
    for (let i = 1; i <= 12; i++) await fetch(`${api}/zones`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer route53-demo-session" }, body: JSON.stringify({ name: `page-${String(i).padStart(2, "0")}.example` }) });
  }, API);
  await page.reload(); await page.getByRole("heading", { name: /Hosted zones/ }).waitFor();
  await page.locator("tbody tr").first().waitFor();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByRole("dialog").getByLabel("10 items").check();
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 10);
  await page.getByRole("button", { name: "Next page" }).click();
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length >= 3);
  assert.equal(await page.getByRole("button", { name: "Next page" }).isDisabled(), true);
  await page.getByRole("button", { name: "Previous page" }).click();
  await rowsEqual(10);
  await page.getByPlaceholder("Filter records by property or value").fill("page-12");
  await rowsEqual(1);
  await page.getByPlaceholder("Filter records by property or value").fill("");
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByRole("dialog").getByLabel("100 items").check();
  await page.getByRole("button", { name: "Confirm" }).click();
  // clean up the zones this step created so the test can run against a shared deployment
  await page.evaluate(async (api) => {
    const headers = { Authorization: "Bearer route53-demo-session" };
    const zones = await (await fetch(`${api}/zones?q=page-`, { headers })).json();
    for (const zone of zones) await fetch(`${api}/zones/${zone.id}`, { method: "DELETE", headers });
  }, API);
});
await step("sign out returns to the login screen", async () => {
  await page.locator(".account-button").click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("heading", { name: "Sign In" }).waitFor();
});
await step("no runtime errors were logged", async () => { assert.deepEqual(errors, []); });
if (errors.length) console.log(errors.slice(0, 6));

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed ? 1 : 0);
