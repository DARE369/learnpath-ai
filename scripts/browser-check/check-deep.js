const { chromium, devices } = require("playwright");
const path = require("path");
const fs = require("fs");

const SITE = "https://learnpath-ai-eight.vercel.app";
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

const FAKE_TOKEN = "fake.dev.token";
const FAKE_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "test@example.com",
  full_name: "Test Learner",
  tier: "free",
  email_verified: true,
  created_at: "2026-01-01T00:00:00",
  updated_at: "2026-01-01T00:00:00",
};

async function seedAuth(ctx) {
  await ctx.addInitScript((token) => {
    try { localStorage.setItem("access_token", token); } catch (e) { /* ignore */ }
  }, FAKE_TOKEN);

  await ctx.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_USER) }),
  );
  await ctx.route("**/api/progress/stats", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      videos_watched: 12, concepts_mastered: 8, hours_learned: 4.5, courses_started: 2, total_watch_time_seconds: 16200,
    }) }),
  );
  await ctx.route("**/api/progress/streak", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ streak_days: 7 }) }),
  );
  await ctx.route("**/api/progress/weekly-activity", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await ctx.route("**/api/progress/heatmap", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await ctx.route("**/api/progress/concepts", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  // Stub a session start so the learning page proceeds
  await ctx.route("**/api/sessions/start", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      session_id: "fake-session-123",
    }) }),
  );
  await ctx.route("**/api/sessions/progress/*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

const collectErrors = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push({ type: "pageerror", message: String(e) }));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push({ type: "console", message: msg.text() });
  });
  page.on("response", (resp) => {
    const url = resp.url();
    if (url.includes("/api/") && resp.status() >= 400) {
      errors.push({ type: "api", status: resp.status(), url });
    }
  });
  return errors;
};

// ─── Pass 1: Learning page (desktop, mocked) ─────────────────────────────
async function passLearning(browser) {
  console.log("\n=== Pass 1: /learning page ===");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await seedAuth(ctx);
  const page = await ctx.newPage();
  const errors = collectErrors(page);

  const url = `${SITE}/learning/photosynthesis-101/0`;
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SHOTS, "14-learning-page.png"), fullPage: true });
    console.log(`/learning  ${resp ? resp.status() : "?"}  → ${page.url()}`);
  } catch (e) {
    console.log(`/learning  ERROR: ${e.message}`);
  }
  console.log("errors:", JSON.stringify(errors));
  await ctx.close();
}

// ─── Pass 2: Mobile (iPhone) ────────────────────────────────────────────
async function passMobile(browser) {
  console.log("\n=== Pass 2: mobile viewport (iPhone 13) ===");
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  await seedAuth(ctx);
  const page = await ctx.newPage();
  const errors = collectErrors(page);

  const mobilePages = [
    ["15-mobile-landing", "/"],
    ["16-mobile-login", "/auth/login"],
    ["17-mobile-dashboard", "/dashboard"],
    ["18-mobile-explore", "/explore"],
    ["19-mobile-course-detail", "/courses/photosynthesis-101"],
    ["20-mobile-settings", "/settings"],
  ];

  for (const [name, p] of mobilePages) {
    const url = SITE + p;
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
      console.log(`${name.padEnd(30)} ${resp ? resp.status() : "?"}  → ${page.url()}`);
    } catch (e) {
      console.log(`${name.padEnd(30)} ERROR: ${e.message}`);
    }
  }
  console.log("errors:", JSON.stringify(errors));
  await ctx.close();
}

// ─── Pass 3: Real search submission (no mock on /api/search) ─────────────
async function passRealSearch(browser) {
  console.log("\n=== Pass 3: real end-to-end search ===");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // NOTE: we still mock /api/auth/me with FAKE_USER, but the backend will 401
  // on /api/search/build-path because our fake JWT isn't valid. That's the
  // expected and useful signal — it proves the search route is wired up.
  await seedAuth(ctx);
  const page = await ctx.newPage();
  const errors = collectErrors(page);

  try {
    await page.goto(`${SITE}/explore`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOTS, "21-search-before.png"), fullPage: false });

    // Fill the search box and click Build my path
    const input = page.locator('input[type="search"]').first();
    await input.fill("Calculus basics");
    await page.screenshot({ path: path.join(SHOTS, "22-search-typed.png"), fullPage: false });

    await page.locator('button:has-text("Build my path")').click();
    // Give it up to 90 seconds for a real build, but also capture the loader state at 3s
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SHOTS, "23-search-loading.png"), fullPage: false });

    // Wait for either a result card or an error message
    try {
      await page.waitForSelector('text=/Built for you|build a learning path|Could not|Something went wrong|Search endpoint not available|Search service is starting|We couldn|Please sign in/', { timeout: 90000 });
    } catch (e) { /* timeout — capture whatever state we're in */ }
    await page.screenshot({ path: path.join(SHOTS, "24-search-result.png"), fullPage: true });
    console.log(`Search final URL: ${page.url()}`);
  } catch (e) {
    console.log(`search ERROR: ${e.message}`);
  }
  console.log("errors:", JSON.stringify(errors));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await passLearning(browser);
    await passMobile(browser);
    await passRealSearch(browser);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
