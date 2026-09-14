/**
 * Payroll and My Payroll pick a month rather than following the header range,
 * so they get their own pass: every month the picker offers, plus every row of
 * My Payroll's month list, at both widths.
 *
 *   node tools/sweep-payroll.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { domProblems } from "./dom-checks.mjs";

const OUT = ".shots/sweep";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
let checks = 0;
const found = [];

const record = async (p, tag, errs) => {
  const problems = await p.evaluate(domProblems);
  checks++;
  if (problems.length || errs.length) {
    found.push({ tag, problems, errs: [...new Set(errs)].slice(0, 2) });
    await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  }
  errs.length = 0;
};

for (const [label, width, height] of [["desktop", 1440, 1100], ["phone", 390, 844]]) {
  const p = await b.newPage({ viewport: { width, height } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message)));
  p.on("console", (m) => { if (m.type() === "error" && !/hydrat/i.test(m.text())) errs.push(m.text()); });

  // ── Payroll: every month the picker offers, and every row expanded.
  await p.goto("http://127.0.0.1:3007/payroll", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const months = p.locator("main button").filter({ hasText: /^[A-Z][a-z]{2} \d{4}$/ });
  const n = await months.count();
  for (let i = 0; i < n; i++) {
    await months.nth(i).click();
    await p.waitForTimeout(900);
    const label2 = (await months.nth(i).innerText()).replace(/\s+/g, "");
    await record(p, `payroll-${label}-${label2}`, errs);

    // open every person's detail on the first month only — it is the same shape
    if (i === 0) {
      const chevrons = p.locator("main svg.lucide-chevron-down");
      const c = await chevrons.count();
      for (let k = 0; k < Math.min(c, 8); k++) {
        await chevrons.nth(k).click({ force: true });
        await p.waitForTimeout(250);
      }
      await p.waitForTimeout(500);
      await record(p, `payroll-${label}-${label2}-expanded`, errs);
    }
  }
  await p.close();

  // ── My Payroll: every month in the list.
  const q = await b.newPage({ viewport: { width, height } });
  const qerrs = [];
  q.on("pageerror", (e) => qerrs.push(String(e.message)));
  q.on("console", (m) => { if (m.type() === "error" && !/hydrat/i.test(m.text())) qerrs.push(m.text()); });
  await q.goto("http://127.0.0.1:3007/my-payroll", { waitUntil: "networkidle" });
  await q.waitForTimeout(1500);
  const rows = q.locator("main button").filter({ hasText: /^[A-Z][a-z]{2} \d{4}/ });
  const m = await rows.count();
  for (let i = 0; i < m; i++) {
    await rows.nth(i).click();
    await q.waitForTimeout(800);
    await record(q, `mypayroll-${label}-${i}`, qerrs);
  }
  await q.close();
}

console.log(`payroll + my-payroll: ${checks} views checked`);
if (found.length === 0) console.log("clean");
for (const f of found) console.log(`  ${f.tag}\n    ${[...f.problems, ...f.errs].join("\n    ")}`);
await b.close();
process.exit(found.length ? 1 : 0);
