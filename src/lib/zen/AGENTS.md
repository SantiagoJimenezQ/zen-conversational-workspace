# Backend and runtime-agent changes

Follow the root guide and read the relevant implementation before changing an invariant. These modules define the model/tool boundary; application prompts are not authorization controls.

## Boundaries to preserve

- `agent-policy.ts`: keep scope classification separate from the conversational model. Invalid, unavailable or uncertain decisions must not silently become permission to use tools. Keep model IDs independently configurable; do not change thresholds or models just to improve a score.
- Follow the user's requested language. Apply STE guidance to English and clarity principles to Spanish/other languages. Language changes do not authorize unrelated requests or bypass scope.
- `openrouter.ts`: preserve the bounded loop, output limits, validated tool definitions, cancellation and safe error mapping. Do not add a model-callable confirmation tool or send server credentials/raw secret-bearing data to the model.
- `mcp.ts`: dispatch only from the server-owned feature flag; Vercel must always mock. `mcp-live.ts`: fixed HTTPS destinations, no redirects, per-operation clients, deadlines, response bounds and cleanup. Any new destination or exposed capability needs explicit design and validation; do not accept arbitrary model-supplied servers.
- `mcp-catalog.ts`: resolve exact catalog names and validate arguments against their JSON Schemas. Provider `readOnlyHint` is not permission. Do not expose generic nested dispatch as a bypass.
- `mcp-payload.ts`: parse provider literals as data without `eval` or code execution. Preserve redaction and output bounds. Resource IDs can be needed for actions; they are not permission or proof of ownership.

## Actions and money

- Keep proposal creation separate from execution. Confirmation reads the exact stored arguments; do not trust replacement arguments, costs or claimed consent supplied by the client/model.
- Check conversation/account scope, expiry, schema, current price and prerequisites again at confirmation. Preserve provider idempotency fields where supported.
- Reserve the quoted amount atomically before network I/O. Do not hold a file lock during a provider request. Repeated/concurrent confirmations must not replay the write or exceed the budget.
- Preserve pending/blocked/running/succeeded/accepted/failed/unknown meanings. A KYC/pending reply is not activation. Reconcile an uncertain result before another attempt; do not blindly retry or release its reservation.
- Unknown or unbounded paid operations stay blocked. Do not infer that a tool is free from a name or untrusted annotation. A recurring subscription needs its explicit UI acknowledgement.
- Use an isolated `ZEN_STATE_DIR` for tests/evals. Never truncate, reseed or remove the user's real ledger as part of validation.

## Facts and time windows

- Reuse `call-window.ts` and the Temporal-based calendar rules. Keep the timezone and exact boundaries visible; do not make the model perform date arithmetic or relabel UTC clocks as local time.
- Preserve requested period and direction through tool schema, adapter, calculation, card, persistence and refresh request. Keep older saved artifacts compatible with their actual historical meaning.
- Count complete provider data, deduplicate records, and distinguish outbound attempts from completed calls. Malformed timestamps, stalled pagination and page-limit exhaustion cannot produce a complete total.
- Failed reads do not become empty histories, fixture records or simulated stock. Curated documentation fallback is dated evidence, not live provider state.

## Validate changes

Use `pnpm test`, `pnpm run lint`, `pnpm run typecheck` and `pnpm run build` from the root for behavior changes. Relevant regressions include date boundaries/DST, multi-page non-empty histories, provider failure, schema rejection, account/conversation mismatch, quote changes, expiry, cancellation, repeated approval, concurrency and unknown outcomes.

For model-facing changes, select authorized live eval cases from the root runner. Keep real account traffic mocked. Inspect both the requested tool arguments and the resulting card/reply; a correct number with the wrong period is a failure. Follow `evals/AGENTS.md` when changing eval infrastructure.
