import { createHash } from "node:crypto";
const windows = new Map<
  string,
  { minuteStart: number; minute: number; dayStart: number; day: number }
>();
let inFlight = 0;
// Best-effort per-instance fairness; the provider key's verified lifetime cap is the financial boundary.
export function admitPreview(
  request: Request,
  now = Date.now(),
): { release: () => void } | Response {
  const address =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "local";
  const ip = createHash("sha256")
    .update(address.split(",")[0].trim())
    .digest("hex")
    .slice(0, 24);
  for (const [id, w] of windows)
    if (now - w.dayStart >= 86400000) windows.delete(id);
  const w = windows.get(ip) ?? {
    minuteStart: now,
    minute: 0,
    dayStart: now,
    day: 0,
  };
  if (now - w.minuteStart >= 60000) {
    w.minute = 0;
    w.minuteStart = now;
  }
  if (windows.size >= 5000 || w.minute >= 5 || w.day >= 30 || inFlight >= 2)
    return Response.json(
      {
        error:
          "This preview is busy or has reached its usage limit. Please wait a minute, or try the offline demo.",
      },
      {
        status: 429,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      },
    );
  w.minute++;
  w.day++;
  windows.set(ip, w);
  inFlight++;
  let released = false;
  return {
    release() {
      if (!released) {
        inFlight = Math.max(0, inFlight - 1);
        released = true;
      }
    },
  };
}
