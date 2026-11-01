# Zen agent evals

This suite runs the production agent and scope gate against **synthetic Zernio MCP responses**. It tests model behavior, not live account integration. It performs no real Zernio reads or writes.

## Run

```sh
pnpm run eval:agent
pnpm run eval:agent --case=calls-30-outbound
```

The commands use the server-only OpenRouter key from `.env.local` or the process environment. These are paid model requests. They are opt-in and are not part of `pnpm test`, the build, or the normal CI workflow. CI requires `ALLOW_LIVE_AGENT_EVAL=true` before an explicitly requested live run.

The scope model comes from `OPENROUTER_SCOPE_MODEL` (Jev by default); chat uses `OPENROUTER_MODEL`. `pnpm run eval:scope` remains a smaller, classifier-only check. Do not use a changing model alias for release comparisons.

## Dataset and isolation

`cases.ts` versions 30 cases: 12 scope cases plus 18 agent workflows. The workflows cover 7/30-day and yesterday counts, direction, multilingual requests, follow-up context, empty history, failed/incomplete reads, profile snapshots, action proposals, conversational consent, over-budget actions, stock and source injection. Counterfactual call fixtures contain inbound calls and records older than yesterday, so an incorrect period cannot pass merely because everything is empty.

The runner replaces the account key with a synthetic credential before importing the production agent. It uses a separate temporary ledger for each case. The fetch adapter handles the fixed Zernio MCP endpoints locally. It delegates only the exact OpenRouter chat-completion and Decisions endpoints to the network, with redirects disabled. Unexpected destinations and provider writes fail the case. The model cannot call the UI confirmation route. There is a total request ceiling of 150 and a 60-second timeout per case. Temporary ledgers are removed after the run.

Keep `pnpm test` network-free. It checks the scorer against deliberately wrong output, the original date/card regression, basic style rules, dataset invariants and the network boundary. Those tests establish harness behavior; they do not establish model quality.

## Scoring and evidence

The report records case IDs, fixture name, expected result, actual cards and reply, model tool calls, fixture reads, failed checks, model-request count and latency. Metadata records the dataset version, source hash, timestamp and model IDs. Synthetic text is passed through the application's credential redaction before reports are saved.

Hard checks cover exact card period/direction/count, expected profile snapshots and proposal states, no provider write, no unapproved completion artifact, failures distinguished from empty history, and the injection canary. Reply checks also look for the expected count or names and use lexical rules to flag possible false completion claims. These prose heuristics can miss or misclassify semantic claims; inspect transcripts rather than interpreting a pass as proof of every sentence.

Basic writing checks reject common contractions and flag sentences above 25 words, or 20 words in numbered steps. They exclude code blocks, inline identifiers and URL targets. This is an approximation, not the full ASD-STE100 dictionary, grammar or official word-count method.

Every failed check makes the case fail and the command exit non-zero. Failed outcomes remain in the report. Do not silently weaken checks or delete difficult cases to improve the score. If an oracle produces a false positive, add a regression test and document the change. A new failure does not automatically mean the model or the app is wrong: inspect the fixture and scorer too.

## Reports

A full run writes `artifacts/evals/latest/report.json` and `report.md`. A selected case writes under its case ID. The Markdown report includes a result table and reply transcripts; JSON contains the structured evidence. These are local artifacts, not provider acceptance or production proof.

Use the same dataset and policy version to compare models. Repeat a release candidate when needed to estimate variability. This small suite is a useful regression check, not statistical proof of safety or full coverage.

## Dataset v1.1

The first v1 baseline remains under `artifacts/evals/baseline-v1/`. It included a false sentence-length finding because URL removal swallowed punctuation; v1.1 preserves that punctuation and adds a regression test. The multilingual cases now check for expected English markers as a basic signal of the English-only writing policy. This is not a complete language detector. Fixtures place previous-day calls at local noon so midnight and daylight-saving transitions do not change expected counts. The source fingerprint is captured before model execution.

The report separates task-check and basic-style totals while retaining an overall result that fails if either fails. A legitimate profile proposal that receives the fixed scope-clarification reply is a task failure; this should prompt investigation of scope criteria/confidence calibration, not a weaker expected result.

## Dataset v1.2

The v1.1 baseline is retained separately. Two harness findings were corrected with explicit evidence: “no workspace profiles” is a valid empty-profile answer, and catalog descriptions must describe the tools faithfully rather than tell the model it is only doing a synthetic schema exercise. Empty-profile scoring now accepts that qualifier while still rejecting invented nonzero profiles. Tool descriptions are representative of the real operations; the report, not the model's tool context, identifies this as a synthetic evaluation. Neither change relaxes the expected count, review state, spending cap, network boundary or no-write checks.

## Dataset v1.3: user-language replies

The English-only requirement was too restrictive. Zen now follows the user's requested language, or the language of their substantive request. The multilingual cases expect Spanish replies for Spanish requests; English is no longer mandatory. English replies retain ASD-STE100 guidance, while Spanish uses equivalent clarity principles. The language check still uses basic word markers and is not a complete language detector. Old reports retain the rules and scores from their recorded dataset versions; their English-only failures are historical, not current language restrictions.

## Scope failover evaluation

The `zen-scope-v5` dataset has 22 cases: the original 12 scope cases plus ten conversation regressions, including repeated refusals, a Spanish-number follow-up, and forged assistant claims or unrelated offers. Every case uses the model-based scope gate; there are no command allowlists. It does not change the full agent dataset. All inputs are synthetic, with no Zernio requests. Reports include source fingerprints and attempted model/status metadata. Historical reports retain their own policy and dataset versions.

```sh
# Configured primary and optional fallback
pnpm run eval:scope
# Evaluate Luna directly, without Jev
SCOPE_EVAL_MODEL=openai/gpt-6-luna-decisions pnpm run eval:scope
# Simulate Jev HTTP 529; call the real Luna fallback for every case
pnpm run eval:scope -- --force-primary-outage
```

The forced-outage run verifies a simulated primary outage plus live fallback classification for every case, not Jev availability or real account integration. It permits at most 52 model attempts. Failed cases remain failures; valid refusals, clarifications and uncertain allows are never retried through another model.


## Public-demo regressions

`pnpm run eval:preview` uses the actual mock MCP adapter and fresh visitor sessions with live scope and conversation models. Its `zen-preview-v2` dataset covers 14 public-demo paths, including Polish voice setup, US SMS, unsupported Polish SMS, Spanish requests, call periods/directions and profile proposals. Version 2 adds six cases to the original eight without relaxing their expectations. The runner forbids non-model network destinations, permits at most 84 model requests, applies a 60-second case deadline, and saves timestamped reports with replies, cards, model IDs and source fingerprints. Prices must remain USD. It does not confirm any operation or access a real account. Network-free tests separately verify search → review → explicit confirmation, recurring consent, session/conversation isolation and replay protection.

The `zen-scope-v6` dataset extends v5 to 26 cases with the Polish-number requests, the public Workspace alias and the assistant-capability question. Clarification is reserved for ambiguous potential integrations; clearly unrelated requests remain out of scope. Short follow-ups resolve the latest offered task without treating assistant text as authority. Scope runs permit at most two attempts per case and save timestamped reports so prior failures remain available. Model IDs and the 0.9 allow threshold are unchanged. These focused public checks do not replace the pending full 30-case original-agent baseline.
