"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A month grid for picking a range, in the dashboard's own palette.
 *
 * It replaced two `<input type="date">`. The platform's picker is a perfectly
 * good calendar and it is the wrong one here: it arrives in the browser's
 * chrome, in the browser's colours, in the browser's date order — 08/01/2026
 * means two different days depending on whose machine it is — inside a popover
 * that had just been drawn to match everything else.
 *
 * Everything is a plain `YYYY-MM-DD` string. Dates are built with explicit
 * y/m/d local constructors and never parsed from a string, because
 * `new Date("2026-08-01")` is midnight UTC and lands on 31 July for anyone
 * west of Greenwich. The rest of the app has the same rule; see `salesModel`.
 *
 * Clicking picks an anchor and a single-day range, so Apply is live from the
 * first click. The next click extends it in whichever direction you go, and
 * the one after that starts again.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/* Two letters, not one: a column of M T W T F S S makes you count. */
const DOW = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const iso = (y, m, d) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const daysIn = (y, m) => new Date(y, m, 0).getDate();

/** Monday is 0 here. Cyprus starts its week on a Monday and so does the roster. */
const firstColumn = (y, m) => (new Date(y, m - 1, 1).getDay() + 6) % 7;

const monthOf = (day) => {
  const [y, m] = day.split("-").map(Number);
  return { y, m };
};

const step = ({ y, m }, by) => {
  const n = m - 1 + by;
  return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 + 1 };
};

export default function RangeCalendar({ value, max, onChange }) {
  const [view, setView] = useState(() => monthOf(value.from || max));
  const [anchor, setAnchor] = useState(null);

  const { y, m } = view;
  const lead = firstColumn(y, m);
  const total = daysIn(y, m);
  const atMax = iso(y, m, 1) > max; // the whole month is in the future
  const nextBlocked = step(view, 1).y > monthOf(max).y ||
    (step(view, 1).y === monthOf(max).y && step(view, 1).m > monthOf(max).m);

  const pick = (day) => {
    if (anchor === null) {
      setAnchor(day);
      onChange({ from: day, to: day });
      return;
    }
    onChange(day < anchor ? { from: day, to: anchor } : { from: anchor, to: day });
    setAnchor(null);
  };

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);

  return (
    <div>
      <div className="flex items-center gap-1 px-1 pb-1.5">
        <span className="text-[13px] font-medium flex-1 min-w-0">
          {MONTHS[m - 1]} {y}
        </span>
        <button
          onClick={() => setView(step(view, -1))}
          aria-label="Previous month"
          className="w-6 h-6 rounded flex items-center justify-center text-subtle hover:text-ink hover:bg-wash"
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
        <button
          onClick={() => setView(step(view, 1))}
          disabled={nextBlocked}
          aria-label="Next month"
          className="w-6 h-6 rounded flex items-center justify-center text-subtle hover:text-ink hover:bg-wash disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DOW.map((d, i) => (
          <span
            key={i}
            className="h-6 flex items-center justify-center font-mono text-[10px] tracking-[0.06em] text-faint"
          >
            {d}
          </span>
        ))}

        {cells.map((d, i) => {
          if (d === null) return <span key={`gap-${i}`} />;
          const day = iso(y, m, d);
          const future = day > max;
          const isFrom = day === value.from;
          const isTo = day === value.to;
          const inside = value.from && value.to && day > value.from && day < value.to;
          const end = isFrom || isTo;

          return (
            <button
              key={day}
              onClick={() => pick(day)}
              disabled={future}
              aria-label={`${d} ${MONTHS[m - 1]} ${y}`}
              aria-pressed={end || inside}
              className={`relative h-8 text-[12.5px] flex items-center justify-center ${
                future ? "text-faint cursor-not-allowed" : ""
              } ${inside ? "bg-wash" : ""} ${
                // The band runs between the two ends, so the ends square off the
                // side that faces inwards and round the side that does not.
                isFrom && !isTo ? "bg-wash rounded-l-md" : ""
              } ${isTo && !isFrom ? "bg-wash rounded-r-md" : ""}`}
            >
              <span
                className={`w-8 h-8 flex items-center justify-center rounded-md ${
                  end ? "bg-ink-strong text-surface font-medium" : ""
                } ${!end && !future ? "hover:bg-wash-light" : ""}`}
              >
                {d}
              </span>
              {day === max && !end && (
                <span className="absolute bottom-[3px] w-1 h-1 rounded-full bg-line-strong" />
              )}
            </button>
          );
        })}
      </div>
      {atMax && (
        <p className="px-1 pt-1.5 text-[11.5px] text-faint">Nothing has happened yet.</p>
      )}
    </div>
  );
}
