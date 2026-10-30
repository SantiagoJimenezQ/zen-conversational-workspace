import { Temporal } from "@js-temporal/polyfill";
import type { Insight } from "./schema";

export const ACCOUNT_TIMEZONE = "Europe/Madrid";
export function yesterdayWindow(now = new Date(), timeZone = ACCOUNT_TIMEZONE) {
  const today = Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO(timeZone)
    .startOfDay();
  const yesterday = today.subtract({ days: 1 }).startOfDay();
  return {
    date: yesterday.toPlainDate().toString(),
    since: yesterday.toInstant().toString(),
    until: today.toInstant().toString(),
    timeZone,
  };
}
// Deterministic rows anchored to the selected day; include decoys to exercise filtering.
export function demoCalls(now = new Date()) {
  const window = yesterdayWindow(now);
  const day = Temporal.PlainDate.from(window.date);
  const rows: Insight["calls"] = Array.from({ length: 24 }, (_, i) => ({
    id: `sample-${window.date}-${i + 1}`,
    at: day
      .toZonedDateTime({
        timeZone: window.timeZone,
        plainTime: { hour: 8 + Math.floor(i / 3), minute: (i * 17) % 60 },
      })
      .toInstant()
      .toString(),
    channel: i % 4 === 0 ? "whatsapp" : "pstn",
    status: i < 19 ? "completed" : i < 22 ? "unanswered" : "failed",
    direction: "outbound",
    ...(i >= 22
      ? {
          reason: i === 22 ? "Destination unavailable" : "Connection timed out",
        }
      : {}),
  }));
  rows.push({ ...rows[0], id: "sample-inbound", direction: "inbound" });
  rows.push({ ...rows[0], id: "sample-outside-window", at: window.until });
  return rows;
}
export function calculateInsights(
  calls: Insight["calls"],
  window: ReturnType<typeof yesterdayWindow>,
): Insight {
  const rows = calls
    .filter(
      (c) =>
        c.direction === "outbound" &&
        Date.parse(c.at) >= Date.parse(window.since) &&
        Date.parse(c.at) < Date.parse(window.until),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    kind: "insight",
    ...window,
    total: rows.length,
    completed: rows.filter((c) => c.status === "completed").length,
    unanswered: rows.filter((c) => c.status === "unanswered").length,
    failed: rows.filter((c) => c.status === "failed").length,
    pstn: rows.filter((c) => c.channel === "pstn").length,
    whatsapp: rows.filter((c) => c.channel === "whatsapp").length,
    calls: rows,
  };
}
export function getDemoInsights(now = new Date()) {
  return calculateInsights(demoCalls(now), yesterdayWindow(now));
}
