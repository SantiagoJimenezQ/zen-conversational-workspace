<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Neutral preview coding guide

This folder is a standalone app with its own package, README, environment and checks. This copy now shares the current workspace UI and agent loop, but all MCP traffic is handled by a local mock-only adapter. The real authenticated account backend stays in the enclosing project.

- Keep the preview vendor-neutral. Do not copy private application notes, original branding/screenshots, account credentials, ledgers or recording material into this app.
- Preserve truthful sample/demo labels. This preview does not have a real account, carrier or messaging service connected. Do not claim real provider activation from a simulated receipt.
- Keep the dedicated production model key server-only. Preserve its provider-policy verification and budget rejection behavior; do not raise a limit or bypass failed metadata verification to make chat work.
- Same-origin and instance-local fairness controls are not visitor authentication or distributed rate limits. Do not describe them as such.
- Preserve signed demo context, explicit simulated confirmation, stream limits, cancellation and browser-local persistence. User language is a response preference, not permission for unrelated operations.
- Reuse the existing Next.js, TypeScript and shadcn/Radix stack. Read this folder's installed Next.js docs before framework changes and keep the generated block intact.
- Run `pnpm install --frozen-lockfile` when installation is needed. Use `pnpm run dev` for loopback port 3001. For behavior changes, run this folder's `pnpm test`, `pnpm run lint`, `pnpm run typecheck` and `pnpm run build`; passing checks in the enclosing app do not validate this copy.
- For docs-only edits, check formatting, local links and commands. Treat changes here as local until publishing is requested or already authorized. Do not deploy, publish a repository or transmit secrets merely because a local edit is complete.
- State which copy was edited, what was verified and which capabilities remain simulated. Keep the public README and privacy/budget disclosures accurate.

## Mock MCP invariants

- Keep mcp.ts free of network transports and account credentials. Unsupported tools fail rather than delegating to a live provider.
- Session cookies are signed and HttpOnly; every API tool route must use withPreviewSession. Never scope visitor state using a client conversation ID alone.
- Simulation state is bounded and instance-local; document cold-start and cross-instance resets. Do not claim durable external operations.
- Preserve explicit UI review even for simulated actions, sample labels and the public simulation banner.
- Keep the model-key budget guard and public origin checks when syncing from the local app.
