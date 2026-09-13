// Check where each real employee lands, against production's permission rows.
import { landingSlugFor, SLUG_TO_PATH } from "../src/lib/access.js";

const CASES = [
  ["Test Employee (production)", ["calendar", "my-payroll", "reviews"]],
  ["Maria Test (production)", []],
  ["only reviews", ["reviews"]],
  ["only marketing — parked", ["marketing"]],
  ["only payroll — admin-only", ["payroll"]],
  ["only settings — admin-only", ["settings"]],
  ["marketing + menu", ["marketing", "menu"]],
];

let bad = 0;
for (const [label, perms] of CASES) {
  const slug = landingSlugFor(perms);
  const path = slug ? SLUG_TO_PATH[slug] : null;
  // The landing page must itself be one they can open, or be null.
  const ok = slug === null || perms.includes(slug);
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(30)} → ${path ?? "(nowhere — show the empty state)"}`);
}
console.log(bad === 0 ? "\nno case lands somewhere it cannot open" : `\n${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
