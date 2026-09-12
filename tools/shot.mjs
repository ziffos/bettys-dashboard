/**
 * Screenshots dashboard routes in a browser on the server.
 *
 * The point is feedback that does not need a human holding a laptop: layout,
 * spacing, typography, columns that break, text that clips and empty gaps all
 * show up here. What does NOT show up is anything that needs a real pointer —
 * hover states, the ⌘K palette, native date pickers.
 *
 *   node tools/shot.mjs <route> <outfile> [width] [height]
 *
 * SHOT_CLICK=<selector> presses something before the picture is taken, so the
 * states that only exist after a tap — open side panels, expanded rows,
 * selected filters — are reachable too.
 *
 * The server it points at is expected to be running in demo mode
 * (NEXT_PUBLIC_DEMO=1). Real Supabase data stops in August 2026 and half the
 * tables are RLS-locked from here, so demo mode is the only source that fills
 * every screen. See src/lib/demo/README.md.
 */
import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3007";

const [, , route = "/", outfile = "/tmp/shot.png", width = "1440", height = "1000"] =
  process.argv;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 1,
});

const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(m.text());
});
page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));

await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });

// The pages fetch on mount and render a skeleton until the promises land, so
// networkidle alone still catches the skeleton on the slower screens.
await page
  .waitForFunction(() => !document.querySelector("[data-loading]"), { timeout: 5000 })
  .catch(() => {});
await page.waitForTimeout(2500);

if (process.env.SHOT_CLICK) {
  await page.click(process.env.SHOT_CLICK, { timeout: 5000 });
  await page.waitForTimeout(800);
}

await page.screenshot({ path: outfile, fullPage: true });

// Console errors are reported but do not fail the run: a screenshot of a broken
// page is more useful than no screenshot and a stack trace.
if (problems.length) {
  console.log(`SHOT_OK ${outfile} (${problems.length} console errors)`);
  for (const p of problems.slice(0, 5)) console.log(`  ! ${p.slice(0, 160)}`);
} else {
  console.log(`SHOT_OK ${outfile}`);
}

await browser.close();
