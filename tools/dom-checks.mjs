/**
 * What counts as a broken screen, run inside the page.
 *
 * Shared by tools/sweep.mjs and tools/sweep-calendar.mjs so there is one
 * definition of "this cannot be right" rather than two that drift.
 */
export function domProblems() {
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
}
