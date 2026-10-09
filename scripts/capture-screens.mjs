// Captures 390x844 mobile screenshots into docs/screens/ (Arabic, then English via the in-app toggle).
// Start the app first, e.g. `DEMO_MODE=true npm run dev`, then:
//   node scripts/capture-screens.mjs [baseUrl]
// Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium instead of Playwright's download.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "docs/screens";
const TRUCK_ID = "20000000-0000-4000-8000-000000000001"; // برجر الحارة (busy, has a sold-out item)
const VENDOR_PHONE = "0500000002"; // owner of that truck

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const errors = [];

async function newContext() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 24.7136, longitude: 46.6753 }, // central Riyadh
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}

async function expectDir(page, dir) {
  await page.waitForFunction((d) => document.documentElement.dir === d, dir, { timeout: 10_000 });
}

async function signIn(page, phone, next) {
  await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`);
  await page.fill("#phone", phone);
  await page.click('button[type="submit"]');
  await page.fill("#code", "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}${next}`);
}

async function capture(locale) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const { context, page } = await newContext();
  const shots = [];
  const shot = async (name) => {
    const path = `${OUT}/${locale}-${name}.png`;
    // Hide the Next.js dev-mode indicator so screenshots show only the app.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.waitForTimeout(400); // let transitions settle
    await page.screenshot({ path });
    shots.push(path);
  };

  // 1. Login (switching language here also proves the toggle works)
  await page.goto(`${BASE}/login`);
  await expectDir(page, "rtl");
  if (locale === "en") {
    await page.click('button[aria-label="غيّر اللغة"]');
    await expectDir(page, "ltr");
  }
  await shot("1-login");

  // 2. Map home with the truck list expanded
  await page.goto(`${BASE}/`);
  await expectDir(page, dir);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="truck-row"]').length >= 6);
  await page.click('button[aria-controls="truck-list"]');
  await shot("2-map");

  // 3. Truck page with menu
  await page.goto(`${BASE}/truck/${TRUCK_ID}`);
  await page.waitForSelector('[data-testid="menu-item"]');
  await shot("3-truck");

  // 4. Vendor dashboard: online toggle + crowd mode
  await signIn(page, VENDOR_PHONE, "/vendor");
  await expectDir(page, dir);
  await page.waitForSelector('[data-testid="online-switch"]');
  await shot("4-vendor-dashboard");

  await context.close();
  return shots;
}

const shots = [...(await capture("ar")), ...(await capture("en"))];
await browser.close();
console.log(shots.join("\n"));
if (errors.length) {
  console.error("Page errors:\n" + errors.join("\n"));
  process.exit(1);
}
