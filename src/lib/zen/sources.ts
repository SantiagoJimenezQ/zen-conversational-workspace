import type { SourceId } from "./schema";

export const sources: Record<
  SourceId,
  { title: string; url: string; excerpt: string }
> = {
  numbers: {
    title: "Phone Numbers",
    url: "https://docs.zernio.com/platforms/phone-numbers",
    excerpt:
      "Buy or port a number, then use voice, SMS or WhatsApp where supported. Telephony requires usage-based billing and a payment method. Capabilities, availability and price vary by country and number type. Do not assume Poland has stock.",
  },
  voice: {
    title: "Voice API",
    url: "https://zernio.com/voice-api",
    excerpt:
      "Workspace supports inbound and outbound PSTN calling, call control, recordings and routing. Voice can support app-triggered alert calls beyond marketing. A production implementation must verify current account prerequisites and destination restrictions.",
  },
  calls: {
    title: "Call history",
    url: "https://docs.zernio.com/calls/list-calls",
    excerpt:
      "GET /v1/calls returns unified WhatsApp and PSTN call history, including direction, timestamps, duration and status. It supports direction/channel filters and cursor pagination. A live yesterday total needs all relevant pages and an explicit account timezone. Demo labels completed/unanswered are derived display categories, not API status enum values.",
  },
  agents: {
    title: "Workspace for agents",
    url: "https://zernio.com/agents",
    excerpt:
      "Workspace already supports external assistants through MCP, plus REST and CLI. An embedded, in-dashboard guided workflow is the hypothesis behind this unofficial prototype. MCP embedding, account permissions and auth are not verified here.",
  },
  provisioning: {
    title: "Buying a number",
    url: "https://docs.zernio.com/platforms/phone-numbers/provisioning",
    excerpt:
      "Search inventory with GET /v1/phone-numbers/available; check monthly prices with GET /v1/phone-numbers/countries. Purchase uses POST /v1/phone-numbers/purchase. A profile, usage-based billing and payment method are prerequisites. Some countries/types require KYC. Stock, exact Polish prerequisites and prices have not been checked. Zen only simulates a setup and never calls purchase.",
  },
};
export const documentationContext = Object.entries(sources)
  .map(([id, s]) => `[${id}] ${s.title} (${s.url})\n${s.excerpt}`)
  .join("\n\n");
export function isOfficialUrl(url: string) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      ["docs.zernio.com", "zernio.com"].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
