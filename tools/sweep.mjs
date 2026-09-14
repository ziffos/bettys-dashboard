/**
 * Step a screen through every range, filter and interval at both widths and
 * report anything that cannot be right: NaN in the text or in an SVG path, a
 * chart with no height, content wider than the viewport, a page error.
 *
 *   node tools/sweep.mjs /sales
 *
 * Screenshots of anything it flags land in .shots/sweep/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const route = process.argv[2] || "/";
// Which toggle group to exercise, if the screen has one. Products has category
// chips as well as a channel picker, so the caller says which.
const chipPattern = new RegExp(process.argv[3] || "^(Wolt|Foody|Bolt|POS)");
// A second control the sweep does not step, but should be held in its other
// position for a whole pass — Payouts' Fee % / Net payout, for instance.
const holdButton = process.argv[4] || null;
const BASE = "http://127.0.0.1:3007";
const OUT = ".shots/sweep";
mkdirSync(OUT, { recursive: true });

const RANGES = ["Today", "Last 7 days", "Last 28 days", "This month", "This quarter"];
const INTERVALS = ["Daily", "Weekly", "Monthly"];

const audit = () => {
  const problems = [];
  const text = document.body.innerText;
  for (const bad of ["NaN", "Infinity", "undefined", "[object Object]"]) {
    if (text.includes(bad)) problems.push(`text contains ${bad}`);
  }
  for (const el of document.querySelectorAll("svg path, svg line, svg rect, svg circle")) {
    for (const attr of ["d", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "cx", "cy", "r"]) {
      const v = el.getAttribute(attr);
      if (v && /NaN|Infinity/.test(v)) {
        problems.push(`<${el.tagName}> ${attr}="${v.slice(0, 60)}"`);
        break;
      }
    }
  }
  // charts that rendered with no height
  for (const el of document.querySelectorAll("svg")) {
    const r = el.getBoundingClientRect();
    if (r.width > 40 && r.height === 0) problems.push("an svg has zero height");
  }
  // a series drawn outside its own plot — a fixed axis that the data escaped
  for (const svg of document.querySelectorAll("svg[viewBox]")) {
    const box = svg.viewBox.baseVal;
    if (!box || !box.height) continue;
    for (const c of svg.querySelectorAll("circle")) {
      const cy = Number(c.getAttribute("cy"));
      if (Number.isFinite(cy) && (cy < -0.5 || cy > box.height + 0.5)) {
        problems.push(`a point sits at cy=${cy.toFixed(1)} outside a 0–${box.height} plot`);
        break;
      }
    }
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    problems.push(`content is ${document.documentElement.scrollWidth}px wide in a ${window.innerWidth}px viewport`);
  }
  return problems;
};

const b = await chromium.launch();
let checks = 0;
const found = [];

for (const [label, width, height] of [["desktop", 1440, 1000], ["phone", 390, 844]]) {
  const p = await b.newPage({ viewport: { width, height } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message)));
  p.on("console", (m) => { if (m.type() === "error" && !/hydrat/i.test(m.text())) errs.push(m.text()); });
  await p.goto(BASE + route, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  if (holdButton) {
    const hold = p.getByRole("button", { name: new RegExp(`^${holdButton}$`) }).first();
    if (await hold.count()) {
      await hold.click();
      await p.waitForTimeout(900);
    }
  }

  for (const range of RANGES) {
    // The trigger shows the current range, so scope the option to the popup.
    const picker = p.locator("header button").filter({ hasText: /Today|Last 7 days|Last 28 days|This month|This quarter/ }).first();
    if (await picker.count()) {
      const popup = p.locator("header div.absolute").first();
      if (!(await popup.isVisible().catch(() => false))) await picker.click();
      await popup.waitFor({ state: "visible", timeout: 4000 });
      await popup.locator("button", { hasText: new RegExp(`^${range}`) }).first().click();
      await popup.waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(1400);
    }

    const intervals = [];
    for (const i of INTERVALS) {
      if (await p.getByRole("button", { name: new RegExp(`^${i}$`) }).count()) intervals.push(i);
    }
    for (const interval of intervals.length ? intervals : [null]) {
      if (interval) {
        await p.getByRole("button", { name: new RegExp(`^${interval}$`) }).first().click();
        await p.waitForTimeout(900);
      }

      // A radio-style channel picker (Products) is stepped option by option;
      // toggle chips (Sales) are exercised all on, one on, and none on — the
      // last being the one worth checking, since a chart with every series
      // switched off still has to draw something honest.
      const radio = p.locator("main button").filter({ hasText: /^All$/ }).first();
      const isRadio = (await radio.count()) > 0;
      // Read the options off the control rather than assuming them — Reviews
      // carries Google, Products does not, and Payouts has its own pair.
      const radioOptions = isRadio
        ? await radio.evaluate((el) =>
            [...el.parentElement.querySelectorAll("button")]
              .map((b) => b.innerText.trim())
              .filter((t) => t && t.length < 20)
          )
        : [];
      const chipBar = p.locator("main button").filter({ hasText: chipPattern });
      const chipCount = isRadio ? 0 : await chipBar.count();
      const chipStates = isRadio
        ? radioOptions
        : chipCount
          ? ["all", "one", "none"]
          : ["all"];

      for (const chips of chipStates) {
        if (isRadio) {
          const opt = radio.locator("xpath=..").locator("button", { hasText: new RegExp(`^${chips}$`) }).first();
          if (await opt.count()) {
            await opt.click();
            await p.waitForTimeout(900);
          }
        } else if (chipCount) {
          // reset to all on
          for (let i = 0; i < chipCount; i++) {
            const pressed = await chipBar.nth(i).evaluate((el) => !el.className.includes("text-subtle"));
            if (!pressed) await chipBar.nth(i).click();
          }
          await p.waitForTimeout(400);
          if (chips === "one") {
            for (let i = 1; i < chipCount; i++) await chipBar.nth(i).click();
          } else if (chips === "none") {
            for (let i = 0; i < chipCount; i++) await chipBar.nth(i).click();
          }
          await p.waitForTimeout(900);
        }

      errs.length = 0;
      const problems = await p.evaluate(audit);
      checks++;
      const tag = `${route.replace(/\//g, "") || "overview"}-${label}-${range.replace(/ /g, "")}${interval ? "-" + interval : ""}${isRadio || chipCount ? "-" + chips.replace(/\s+/g, "") : ""}`;
      if (problems.length || errs.length) {
        found.push({ tag, problems, errs: [...new Set(errs)].slice(0, 2) });
        await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
      }
      }
    }
  }
  await p.close();
}

console.log(`${route} [${chipPattern.source}${holdButton ? " · " + holdButton : ""}]: ${checks} combinations checked`);
if (found.length === 0) console.log("clean");
for (const f of found) console.log(`  ${f.tag}\n    ${[...f.problems, ...f.errs].join("\n    ")}`);
await b.close();
process.exit(found.length ? 1 : 0);
