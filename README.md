# Zen conversational workspace

The current conversational workspace UI with live DeepSeek chat and Jev scope checks, backed by a **mock-only MCP adapter**. All account data, documentation snippets, prices, phone offers and actions are synthetic. No real provider credential or network transport is present in the adapter. OpenRouter is the only paid integration.

The supported mock catalog covers profiles, connected accounts, US phone offers, simulated number purchase and paginated call history. Profile creation and purchases require the same explicit UI review used by the local prototype, but change simulation state only. Unsupported tools are unavailable rather than fabricated as successful actions.

Public source is provided for review. No open-source license is granted for this project. Third-party component and font licenses remain in `public/legal`.

See [SECURITY.md](SECURITY.md) and [the publication review](SECURITY-REVIEW.md) for the security boundaries and evidence.

## Run and validate

Use Node 22+ and pinned pnpm 12.16.1. Run `pnpm install --frozen-lockfile`, then `pnpm run dev` (127.0.0.1:3001). Configure the server-only OpenRouter key, model and DEMO_SIGNING_SECRET using .env.example. No provider account key is required or supported.

Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint` and `pnpm run build`. Tests cover scope, transport, calculations, session isolation, explicit approvals, no-network mock execution, signed history, budget verification and origin admission. Test cases migrated from the local app reflect its newer classifier and schemas.

## Public model budget

The existing dedicated OpenRouter key must have a positive remaining lifetime limit of at most $10, no reset, and BYOK usage included. The server verifies it before each live chat and fails closed. Model calls still cost money. Instance-local request limits bound concurrency and fairness; they are not distributed rate limits.

## Simulation state and privacy

An HttpOnly, SameSite signed cookie selects a visitor-specific simulation. Each server instance keeps its own state for up to an hour, with bounded sessions, actions and profiles; older sessions can be evicted at capacity. The UI routes mock operations through the chat function so agent proposals and UI confirmations can share a warm instance. There is no shared database. A cold start or another instance can reset simulated profiles, proposals and purchases; an unavailable proposal must be prepared again. This is not durable transaction processing. Visitors cannot read another session's state by supplying a conversation ID.

Chat history stays in browser storage. Prompts and selected synthetic tool outputs go to OpenRouter/model providers. Do not enter private information. No real calls, messages, charges or subscriptions are created by mock actions. A persistent DEMO_SIGNING_SECRET is required; PUBLIC_APP_ORIGIN controls allowed production origins.

The preview remains vendor-neutral. Local credentials, ledgers, design references and recording files are excluded from deployment. Component/font notices are retained. Source publication is separate from hosting.

## Recorded verification · 30 October 2026

36 tests, lint, typecheck and production build passed. Production deployment dpl_83BxWhN1jC5peYngaVuHaozC3wfX is ready at https://zen-workspace-preview.vercel.app. The in-app browser verified live AI with a 30-day sample call card. A production HTTP check verified seven catalog tools and sample profile proposal → confirmation → updated read through the shared function. A no-network test verified simulated execution and signed-session isolation. No real account or paid provider action was performed.
