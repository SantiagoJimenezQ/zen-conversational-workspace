<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Unified project coding guide

This is the shared original app with a server-owned mock-MCP feature flag. Read README.md and SECURITY.md before changing mode boundaries. Backend guidance is in src/lib/zen/AGENTS.md; evaluation guidance is in evals/AGENTS.md.

- ZERNIO_MCP_MOCK defaults to true. Vercel always forces mocks. Real MCP is an explicit local opt-in with the user's own server-side key; never expose it publicly or silently fall back to mock data.
- Keep one shared agent, tool-validation layer and UI. Separate only transport and storage adapters where mode behavior differs. Client display flags are never authorization.
- Preserve scope checks, language preferences, exact call windows, explicit UI approval, ownership checks and quoted-cost constraints in both modes.
- Keep the public model-key budget check, origin validation, credential redaction, fixed endpoints and rejected redirects. No model-callable write confirmation.
- Mock state is visitor-scoped and temporary. Real local state uses the private durable ledger; never delete it to reset limits or seed a test.
- Never commit credentials, ledgers, model reports, private snapshots or Vercel metadata. Tests and evals use synthetic credentials, mocked transport and isolated state.
- pnpm test remains network-free. eval:scope and eval:agent are explicit paid model runs; never run them automatically in default CI.
- Use Node 22+ and pinned pnpm 12.16.1. Validate with pnpm test, pnpm run lint, pnpm run build and pnpm run typecheck. Confirm both display modes when editing user-facing state labels.
- Preserve unrelated changes. Public source is published without an open-source license; retain third-party license notices.
