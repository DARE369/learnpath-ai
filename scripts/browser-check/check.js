const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SITE = "https://learnpath-ai-eight.vercel.app";
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

const PAGES = [
  { name: "01-landing", path: "/" },
  { name: "02-login", path: "/auth/login" },
  { name: "03-signup", path: "/auth/signup" },
  { name: "04-explore-anon", path: "/explore" },
  { name: "05-dashboard-anon", path: "/dashboard" },
  { name: "06-courses-list-anon", path: "/courses/photosynthesis-101" },
  { name: "07-settings-anon", path: "/settings" },
];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
      await page.waitForTimeout(1500); // let client-side redirects settle
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
    report.push({
      name: p.name,
      path: p.path,
      status,
      finalUrl,
      title,
      ms: elapsed,
    });
    console.log(`${p.name.padEnd(28)} ${String(status).padEnd(20)} ${elapsed}ms  → ${finalUrl}`);
  }

  await browser.close();

  fs.writeFileSync(
    path.join(__dirname, "report.json"),
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log("\n--- ERRORS COLLECTED ---");
  console.log(JSON.stringify(errors, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
