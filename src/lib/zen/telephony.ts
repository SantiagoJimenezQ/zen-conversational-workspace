import "server-only";
import { invokeCatalogTool } from "./mcp-catalog";
import { providerPayload } from "./mcp-payload";
import { callWindow } from "./call-window";
import { prepareOperation } from "./operations";
import type { Artifact, CallPeriod, CallDirection } from "./schema";
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
async function read(
  name: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
) {
  const r = await invokeCatalogTool(name, args, signal);
  if (r.isError)
    throw new Error(
      "Zernio could not complete the telephony read. Check billing, permissions and prerequisites.",
    );
  return providerPayload(r);
}
export async function phoneSearch(
  countryInput: string,
  capability: "voice" | "sms" | "both",
  numberType: string | undefined,
  signal: AbortSignal,
): Promise<Artifact> {
  const catalog = await read(
    "phone_numbers_list_phone_number_countries",
    {},
    signal,
  );
  const countries =
    record(catalog) && Array.isArray(catalog.countries)
      ? catalog.countries
      : [];
  const row = countries.find(
    (c) =>
      record(c) &&
      (c.code === countryInput.toUpperCase() ||
        (typeof c.name === "string" &&
          c.name.toLowerCase() === countryInput.toLowerCase())),
  );
  if (!record(row) || !Array.isArray(row.types) || typeof row.code !== "string")
    throw new Error(
      "The requested country is not in the current provider catalog.",
    );
  const eligible = row.types
    .filter(
      (t) =>
        record(t) &&
        t.callsAvailable === true &&
        (capability === "voice" || t.smsAvailable === true),
    )
    .sort((a, b) => Number(a.monthlyCents) - Number(b.monthlyCents));
  const type = numberType
    ? eligible.find((t) => t.numberType === numberType)
    : eligible.find((t) => t.inStock === true) || eligible[0];
  if (
    !record(type) ||
    typeof type.numberType !== "string" ||
    typeof type.monthlyCents !== "number"
  )
    throw new Error("No documented number type matches those capabilities.");
  const inventory = await read(
    "phone_numbers_search_available_phone_numbers",
    {
      country: row.code,
      number_type: type.numberType,
      sms: capability !== "voice",
      limit: 10,
    },
    signal,
  );
  if (!record(inventory) || !Array.isArray(inventory.numbers))
    throw new Error("The live inventory could not be interpreted.");
  const numbers = inventory.numbers
    .flatMap((n) =>
      record(n) && typeof n.phoneNumber === "string" ? [n.phoneNumber] : [],
    )
    .slice(0, 10);
  return {
    kind: "live-phone",
    country: row.code,
    capability,
    numberType: type.numberType,
    monthlyCents: type.monthlyCents,
    needsKyc: type.needsKyc === true,
    inStock: type.inStock === true,
    numbers,
    fetchedAt: new Date().toISOString(),
  };
}
export async function reviewPhone(
  conversationId: string,
  country: string,
  capability: "voice" | "sms" | "both",
  numberType: string,
  phoneNumber: string | undefined,
  signal: AbortSignal,
) {
  const offer = await phoneSearch(country, capability, numberType, signal);
  if (offer.kind !== "live-phone") throw new Error("Invalid phone offer.");
  if (phoneNumber && !offer.numbers.includes(phoneNumber))
    throw new Error("That number is no longer returned by live inventory.");
  const profiles = await read("profiles_list", {}, signal);
  const lines =
    typeof profiles === "string"
      ? profiles.split("\n").filter((l) => l.startsWith("- "))
      : [];
  const selected =
    lines.find((l) => l.includes("(default)")) ||
    (lines.length === 1 ? lines[0] : undefined);
  const id = selected ? /\(ID: ([^)]+)\)/.exec(selected)?.[1] : undefined;
  if (!id)
    throw new Error(
      "Choose a profile through the MCP tool browser before purchasing.",
    );
  return prepareOperation(
    conversationId,
    "phone_numbers_purchase_phone_number",
    {
      profile_id: id,
      country,
      number_type: numberType,
      connect_whatsapp: false,
      wants_sms: capability !== "voice",
      ...(phoneNumber ? { phone_number: phoneNumber } : {}),
    },
    signal,
  );
}
export async function liveCallInsights(
  signal: AbortSignal,
  period: CallPeriod = "yesterday",
  direction: CallDirection = "outbound",
  now = new Date(),
): Promise<Artifact> {
  const window = callWindow(period, now);
  const counts = new Map<string, number>();
  const ids = new Set<string>();
  let before: string | null = window.until;
  for (let page = 1; page <= 10; page++) {
    const payload = await read(
      "calls_list_calls",
      { ...(direction === "all" ? {} : { direction }), before, limit: 100 },
      signal,
    );
    if (!record(payload) || !Array.isArray(payload.calls))
      throw new Error("The real call history could not be interpreted.");
    let older = false;
    for (const call of payload.calls) {
      if (
        !record(call) ||
        typeof call.startedAt !== "string" ||
        !Number.isFinite(Date.parse(call.startedAt)) ||
        !["inbound", "outbound"].includes(String(call.direction))
      )
        throw new Error(
          "A call has an invalid timestamp or direction; an exact total cannot be reported.",
        );
      if (Date.parse(call.startedAt) < Date.parse(window.since)) {
        older = true;
        continue;
      }
      if (
        Date.parse(call.startedAt) >= Date.parse(window.until) ||
        (direction !== "all" && call.direction !== direction)
      )
        continue;
      const id = call.id ?? call._id;
      if (
        typeof id !== "string" ||
        typeof call.status !== "string" ||
        !["inbound", "outbound"].includes(String(call.direction))
      )
        throw new Error("A call record is incomplete.");
      if (ids.has(id)) continue;
      ids.add(id);
      counts.set(call.status, (counts.get(call.status) || 0) + 1);
    }
    const next = payload.nextCursor;
    if (older || next === null || next === undefined)
      return {
        kind: "live-calls",
        period,
        direction,
        ...window,
        total: ids.size,
        statuses: [...counts].map(([status, count]) => ({ status, count })),
        pages: page,
        fetchedAt: new Date().toISOString(),
      };
    if (typeof next !== "string" || next === before)
      throw new Error(
        "Pagination did not advance; no complete call total is claimed.",
      );
    before = next;
  }
  throw new Error(
    "The call history exceeds this POC’s ten-page limit. No partial count is presented as a complete total.",
  );
}
