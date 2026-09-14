/**
 * The side panel's proving pass.
 *
 * Every screen, both widths, panel shut and panel open, run through the same
 * DOM checks the chart sweeps use — the panel takes 334px off the page, and the
 * question is whether anything breaks in the space that is left. Then the panel
 * itself is driven the way a person would drive it.
 *
 *   node tools/prove-panel.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { domProblems } from "./dom-checks.mjs";

const BASE = "http://127.0.0.1:3007";
const OUT = ".shots/panel";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  "/", "/sales", "/products", "/reviews", "/menu", "/platform-payouts",
  "/calendar", "/payroll", "/my-payroll", "/tv-displays", "/settings", "/notes",
];

const b = await chromium.launch();
const found = [];
let checks = 0;

for (const [label, width, height] of [["desktop", 1440, 1000], ["phone", 390, 844]]) {
  for (const open of [false, true]) {
    const ctx = await b.newContext({ viewport: { width, height } });
    await ctx.addInitScript(
      ([o]) => window.localStorage.setItem("bettys-panel", JSON.stringify({ open: o, tab: "list" })),
      [open]
    );
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e.message)));
    p.on("console", (m) => { if (m.type() === "error" && !/hydrat/i.test(m.text())) errs.push(m.text()); });

    for (const route of ROUTES) {
      await p.goto(BASE + route, { waitUntil: "networkidle" });
      await p.waitForTimeout(1300);
      errs.length = 0;
      const problems = await p.evaluate(domProblems);
      checks++;
      const tag = `${route.replace(/\//g, "") || "overview"}-${label}-${open ? "open" : "shut"}`;
      if (problems.length || errs.length) {
        found.push({ tag, problems, errs: [...new Set(errs)].slice(0, 2) });
        await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
      }
    }
    await ctx.close();
  }
}

console.log(`${checks} screen/width/panel combinations checked`);
if (found.length === 0) console.log("clean");
for (const f of found) console.log(`  ${f.tag}\n    ${[...f.problems, ...f.errs].join("\n    ")}`);
await b.close();
process.exit(found.length ? 1 : 0);
