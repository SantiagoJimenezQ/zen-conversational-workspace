import { Temporal } from "@js-temporal/polyfill";
import { yesterdayWindow, ACCOUNT_TIMEZONE } from "./fixtures";
import type { CallPeriod } from "./schema";

/** Relative windows end now; yesterday is the complete previous local calendar day. */
export function callWindow(period: CallPeriod, now = new Date()) {
  if (period === "yesterday") return yesterdayWindow(now);
  const end = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(
    ACCOUNT_TIMEZONE,
  );
  const start = end.subtract({ days: period === "last_7_days" ? 7 : 30 });
  return {
    date: start.toPlainDate().toString(),
    timeZone: ACCOUNT_TIMEZONE,
    since: start.toInstant().toString(),
    until: end.toInstant().toString(),
  };
}

export function localCallRange(window: {
  since: string;
  until: string;
  timeZone: string;
}) {
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: window.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${format.format(new Date(window.since))} – ${format.format(new Date(window.until))} · ${window.timeZone}`;
}
