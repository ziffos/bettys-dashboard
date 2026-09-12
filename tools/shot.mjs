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

// networkidle is not enough on its own. Pages fetch on mount, swap a skeleton
// for the real thing, and then Recharts animates its bars up from zero — a
// picture taken at network idle catches empty charts. Wait instead until the
// DOM has stopped changing for a beat.
await page
  .waitForFunction(
    () =>
      new Promise((resolve) => {
        let timer = setTimeout(() => resolve(true), 900);
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            resolve(true);
          }, 900);
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }),
    { timeout: 20000 }
  )
  .catch(() => {});
await page.waitForTimeout(600);

// Playwright's fullPage resizes the viewport to the document height and shoots
// immediately. That resize makes Recharts re-measure and replay its grow-from-
// zero animation, so the picture comes back with empty charts. Do the resize
// here instead and give the page a moment to settle at its final size.
const fullHeight = await page.evaluate(() =>
  Math.min(
    12000,
    Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
  )
);
if (fullHeight > Number(height)) {
  await page.setViewportSize({ width: Number(width), height: fullHeight });
  await page.waitForTimeout(1600);
}

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
