# Model evaluation changes

Read [README.md](README.md) in this directory and the root guide. This guidance also applies when updating the associated runners in `scripts/`.

## Keep the boundary real

- `pnpm test` stays network-free. `pnpm run eval:scope` and `pnpm run eval:agent` are explicit, paid model runs and must stay separate from default CI.
- Agent evals run the production scope gate and agent loop. Do not stub the agent's answer and label the result a live model eval.
- Replace the account credential before importing the agent. Mock every account/documentation MCP request and use a temporary ledger per case. Never read or mutate the real account to seed a fixture.
- Delegate network traffic only to the exact allowed OpenRouter model endpoints, with redirects disabled. Unexpected destinations and provider-write attempts must fail the case; there is no fallback to real MCP.
- Preserve the model-request ceiling, timeouts, cleanup and credential redaction. Never log authorization headers or environment-file contents.
- Keep cases sequential within a process while changing `globalThis.fetch` or environment variables. Restore globals in deterministic tests, including failure paths.

## Dataset and scoring

- Use stable case IDs, declared expectations and a dataset version. Version meaningful requirement/fixture changes. Keep model IDs, source fingerprints and timestamps in reports.
- Prefer counterfactual fixtures: nonzero older calls, inbound records, excluded dates, empty data, failures and pending operations. An all-zero fixture cannot detect the wrong time window.
- Use code for counts, period/direction, schema fields and operation states. Prose/language heuristics are limited signals; do not claim semantic proof or full STE compliance.
- Respect user language. A Spanish request/reply is not a failure merely because English STE guidance exists. Keep explicit language expectations aligned with the current product requirement.
- Preserve failures in reports and exit non-zero when a check fails. Do not retry until a passing output appears and report only that sample.
- Inspect whether a failure comes from policy, model behavior, fixture fidelity or the scorer. Do not remove a hard case, weaken approval/cost rules, or add an accepted answer only to make a model look better.
- A justified scorer correction needs a counterexample/regression test and a version note. Preserve prior reports as historical evidence; do not relabel old outputs as newly tested behavior.
- Compare models on the same dataset/policy. A selected case or prior-policy run is not a current full-suite baseline. Small samples and model probabilities are not accuracy guarantees.

## Commands and evidence

Run these from the app root:

```sh
pnpm test
pnpm run lint
pnpm run typecheck
pnpm run eval:agent --case=calls-30-outbound
```

Only run the last command when model validation is authorized. Use `pnpm run eval:agent` for a requested full baseline. Review `artifacts/evals/<case-id>/` or `artifacts/evals/latest/`; the Markdown transcript and JSON evidence must agree. Do not hand-edit scores. Document limits and failures in the handoff.
