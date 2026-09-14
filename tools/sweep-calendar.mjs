/**
 * Calendar does not follow the header range — it has its own Week/Month view
 * and its own navigation — so it gets its own pass: both views, walked back and
 * forward past both ends of the roster, at both widths.
 *
 *   node tools/sweep-calendar.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { domProblems } from "./dom-checks.mjs";

const OUT = ".shots/sweep";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
let checks = 0;
const found = [];

for (const [label, width, height] of [["desktop", 1440, 1100], ["phone", 390, 844]]) {
  const p = await b.newPage({ viewport: { width, height } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message)));
  p.on("console", (m) => { if (m.type() === "error" && !/hydrat/i.test(m.text())) errs.push(m.text()); });
  await p.goto("http://127.0.0.1:3007/calendar", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);

  const today = p.getByRole("button", { name: /^Today$/ });
  const nav = today.locator("xpath=..").locator("button");

  for (const view of ["Week", "Month"]) {
    await p.getByRole("button", { name: new RegExp(`^${view}$`) }).first().click();
    await p.waitForTimeout(900);

    // back to well before the roster starts, then forward past its end
    for (const [dir, steps] of [["back", 10], ["forward", 20]]) {
      const button = dir === "back" ? nav.first() : nav.last();
      for (let i = 0; i < steps; i++) {
        await button.click();
        await p.waitForTimeout(220);
        if (i % 4 !== 0) continue;          // check every fifth period
        errs.length = 0;
        const problems = await p.evaluate(domProblems);
        checks++;
        if (problems.length || errs.length) {
          const tag = `calendar-${label}-${view}-${dir}${i}`;
          found.push({ tag, problems, errs: [...new Set(errs)].slice(0, 2) });
          await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
        }
      }
      await today.click();
      await p.waitForTimeout(600);
    }
  }
  await p.close();
}

console.log(`/calendar: ${checks} periods checked`);
if (found.length === 0) console.log("clean");
for (const f of found) console.log(`  ${f.tag}\n    ${[...f.problems, ...f.errs].join("\n    ")}`);
await b.close();
process.exit(found.length ? 1 : 0);
