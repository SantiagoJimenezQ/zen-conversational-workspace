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
