const { chromium } = require("playwright");
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

const FAKE_STATS = {
  videos_watched: 12,
  concepts_mastered: 8,
  hours_learned: 4.5,
  courses_started: 2,
  total_watch_time_seconds: 16200,
};

const PAGES = [
  { name: "08-authed-landing", path: "/", expectRedirect: "/dashboard" },
  { name: "09-authed-dashboard", path: "/dashboard" },
  { name: "10-authed-explore", path: "/explore" },
  { name: "11-authed-course-detail", path: "/courses/photosynthesis-101" },
  { name: "12-authed-course-detail-ml", path: "/courses/neural-networks-foundations" },
  { name: "13-authed-settings", path: "/settings" },
];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Pre-seed localStorage so useAuth's bootstrap finds a token
  await ctx.addInitScript((token) => {
    try {
      localStorage.setItem("access_token", token);
    } catch (e) { /* ignore */ }
  }, FAKE_TOKEN);

  // Intercept API calls to return fake data
  await ctx.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_USER) }),
  );
  await ctx.route("**/api/progress/stats", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_STATS) }),
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

  const page = await ctx.newPage();

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

  const report = [];
  for (const p of PAGES) {
    const url = SITE + p.path;
    const start = Date.now();
    let status = "?";
    let finalUrl = "";
    let title = "";
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      status = resp ? resp.status() : "no-response";
      await page.waitForTimeout(2000); // let useEffect redirects + data fetches settle
      finalUrl = page.url();
      title = await page.title();
      await page.screenshot({
        path: path.join(SHOTS, `${p.name}.png`),
        fullPage: true,
      });
    } catch (e) {
      status = `ERROR: ${e.message}`;
    }
    const elapsed = Date.now() - start;
    report.push({ name: p.name, path: p.path, status, finalUrl, title, ms: elapsed });
    console.log(`${p.name.padEnd(32)} ${String(status).padEnd(20)} ${elapsed}ms  → ${finalUrl}`);
  }

  await browser.close();

  fs.writeFileSync(
    path.join(__dirname, "report-authed.json"),
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log("\n--- ERRORS COLLECTED ---");
  console.log(JSON.stringify(errors, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
