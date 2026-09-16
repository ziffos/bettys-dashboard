"use client";

import { SidePanel, PLATFORM } from "./ui";
import { euro, euro2, MONTHS, parseDay, weatherLabel } from "../lib/format";
import { dayOf, timeOf } from "../lib/salesModel";

/**
 * One day's orders, opened by clicking a bar. Shared by Overview and Sales
 * because both charts promise the same thing when you click a day.
 */
export default function DayDrawer({ day, totals, weather, deliveries, pos, onClose }) {
  if (!day) return null;

  const rows = [];
  for (const d of deliveries) {
    if (dayOf(d.order_placed) !== day) continue;
    const src = (d.delivery_partner || "").toLowerCase();
    const status = (d.delivery_status || "").toLowerCase();
    rows.push({
      time: timeOf(d.order_placed),
      items: d.items || "—",
      total: Number(d.price || 0),
      platform: PLATFORM[src]?.name ?? src,
      color: PLATFORM[src]?.color ?? "#8f8f8f",
      status:
        status === "delivered"
          ? "Delivered"
          : status === "rejected"
            ? "Rejected by kitchen"
            : "Cancelled",
      lost: status !== "delivered",
    });
  }
  for (const p of pos) {
    if (dayOf(p.order_placed) !== day) continue;
    rows.push({
      time: timeOf(p.order_placed),
      items: p.items || "—",
      total: Number(p.price || 0),
      platform: "In-store POS",
      color: PLATFORM.pos.color,
      status: "Collected",
      lost: false,
    });
  }
  rows.sort((a, b) => b.time.localeCompare(a.time));

  const date = parseDay(day);

  return (
    <SidePanel
      open
      eyebrow={weather ? `DAY DETAIL · ${weatherLabel(weather)}` : "DAY DETAIL"}
      title={`${date.toLocaleDateString("en-GB", { weekday: "long" })} ${date.getDate()} ${MONTHS[date.getMonth()]}`}
      onClose={onClose}
    >
      <div className="grid grid-cols-3 border-b border-line">
        {[
          ["GROSS", euro(totals.gross), "text-ink"],
          ["FEES", euro(totals.fees), "text-muted"],
          ["NET", euro(totals.net), "text-ink"],
        ].map(([label, value, tone], i) => (
          <div key={label} className={`px-4 py-3 ${i < 2 ? "border-r border-line" : ""}`}>
            <div className="font-mono text-[10px] tracking-[0.06em] text-subtle">{label}</div>
            <div className={`text-[18px] font-semibold tracking-[-0.02em] mt-[3px] ${tone}`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 font-mono text-[10px] tracking-[0.06em] text-subtle border-b border-line">
        <span>{rows.length} ORDERS</span>
        <span>NEWEST FIRST</span>
      </div>

      {rows.length === 0 && (
        <p className="px-4 py-6 text-[13px] text-muted text-center">
          No orders logged for this day.
        </p>
      )}

      {rows.map((o, i) => (
        <div
          key={i}
          className="px-4 py-2.5 border-b border-wash flex items-center gap-2.5 hover:bg-wash-light"
        >
          <span className="font-mono text-[12px] text-subtle w-[38px] shrink-0">{o.time}</span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: o.color }} />
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] truncate ${o.lost ? "line-through text-subtle" : ""}`}>
              {o.items}
            </div>
            <div
              className="text-[11px]"
              style={{ color: o.lost ? "var(--color-danger)" : "var(--color-subtle)" }}
            >
              {o.platform} · {o.status}
            </div>
          </div>
          <span
            className={`font-mono text-[13px] tabular-nums shrink-0 ${o.lost ? "text-subtle" : ""}`}
          >
            {euro2(o.total)}
          </span>
        </div>
      ))}
    </SidePanel>
  );
}
