import { mkdtemp, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { agentCases, DATASET_VERSION } from "../evals/cases";
import { evaluationFetch, newTrace } from "../evals/mock-mcp";
import { grade } from "../evals/score";
import { safeOutput } from "../src/lib/zen/mcp-payload";
import type { StreamEvent } from "../src/lib/zen/schema";

async function main() {
  if (process.env.CI && process.env.ALLOW_LIVE_AGENT_EVAL !== "true")
    throw new Error("Live evals are opt-in in CI.");
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* Existing environment also works. */
  }
  if (!process.env.OPENROUTER_API_KEY?.trim())
    throw new Error("Configure the server OpenRouter key first.");
  const filter = process.argv
    .find((arg) => arg.startsWith("--case="))
    ?.slice(7);
  const selected = filter
    ? agentCases.filter((entry) => entry.id === filter)
    : agentCases;
  if (!selected.length) throw new Error("Unknown evaluation case.");
  // Replace account credentials BEFORE importing the production agent. This process never uses the real account key.
  process.env.ZERNIO_MCP_MOCK = "false";
  process.env.ZERNIO_API_KEY = `synthetic-eval-${randomUUID()}`;
  process.env.ZERNIO_ACCOUNT_MCP_ENABLED = "true";
  process.env.ZERNIO_DOCS_MCP_ENABLED = "true";
  const stateRoot = await mkdtemp(path.join(tmpdir(), "zen-model-eval-"));
  process.env.ZEN_STATE_DIR = stateRoot;
  const { runOpenRouter, providerConfig } =
    await import("../src/lib/zen/openrouter");
  const { scopeConfig } = await import("../src/lib/zen/agent-policy");
  const modelFetch = globalThis.fetch;
  const budget = { remaining: 150 };
  const results = [];
  const hash = createHash("sha256");
  for (const file of [
    "evals/cases.ts",
    "evals/score.ts",
    "evals/mock-mcp.ts",
    "tests/fixtures/scope-cases.ts",
    "scripts/eval-agent.ts",
    ...(await readdir("src/lib/zen"))
      .filter((file) => file.endsWith(".ts"))
      .sort()
      .map((file) => `src/lib/zen/${file}`),
  ])
    hash.update(await readFile(file));
  const sourceHash = hash.digest("hex");
  try {
    for (const entry of selected) {
      process.env.ZEN_STATE_DIR = await mkdtemp(path.join(stateRoot, "case-"));
      const trace = newTrace();
      const events: StreamEvent[] = [];
      const start = performance.now();
      globalThis.fetch = evaluationFetch(
        entry,
        trace,
        modelFetch,
        new Date(),
        budget,
      );
      let error: string | undefined;
      try {
        await runOpenRouter(
          entry.messages,
          (event) => events.push(event),
          AbortSignal.timeout(60000),
          [],
          0,
          randomUUID(),
          entry.pending
            ? [
                {
                  tool: "profiles_create",
                  status: "pending",
                  result:
                    "Exact profile proposal awaits UI approval. Nothing has been executed.",
                },
              ]
            : [],
        );
      } catch {
        error =
          "The model run failed, timed out, or exceeded its request budget.";
      }
      const scored = grade(entry, events, trace, error);
      const latencyMs = Math.round(performance.now() - start);
      results.push({
        id: entry.id,
        fixture: entry.fixture,
        expected: entry.expected,
        ...scored,
        trace,
        latencyMs,
        error,
      });
      console.log(
        `${scored.passed ? "PASS" : "FAIL"} ${entry.id} (${latencyMs} ms)${
          scored.passed
            ? ""
            : ": " +
              scored.checks
                .filter((c) => !c.passed)
                .map((c) => c.name)
                .join(", ")
        }`,
      );
    }
  } finally {
    globalThis.fetch = modelFetch;
    await rm(stateRoot, { recursive: true, force: true });
  }
  const passed = results.filter((result) => result.passed).length;
  const report = {
    datasetVersion: DATASET_VERSION,
    sourceHash,
    at: new Date().toISOString(),
    models: { chat: providerConfig().model, scope: scopeConfig().model, scopeFallback: scopeConfig().fallbackModel || null },
    isolation:
      "All Zernio requests mocked; temporary action ledger; no confirmation calls; only the two fixed OpenRouter model endpoints can reach the network.",
    modelRequests: 150 - budget.remaining,
    passed,
    taskPassed: results.filter((result) =>
      result.checks
        .filter((check) => !check.name.startsWith("style-"))
        .every((check) => check.passed),
    ).length,
    stylePassed: results.filter((result) =>
      result.checks
        .filter((check) => check.name.startsWith("style-"))
        .every((check) => check.passed),
    ).length,
    total: results.length,
    results,
  };
  const safe = safeOutput(report) as typeof report;
  // safeOutput bounds arrays/strings, but this dataset has fewer than 200 items and bounded response text.
  const dir = path.join("artifacts", "evals", filter || "latest");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "report.json"), JSON.stringify(safe, null, 2));
  const markdown = [
    `# Zen agent evaluation`,
    ``,
    `Dataset: ${DATASET_VERSION}`,
    ``,
    `**${passed}/${results.length} passed** · Chat: ${report.models.chat} · Scope: ${report.models.scope}`,
    ``,
    `Task checks: ${report.taskPassed}/${results.length}. Basic style checks: ${report.stylePassed}/${results.length}.`,
    ``,
    report.isolation,
    ``,
    `This is a synthetic model-behavior evaluation, not proof of live Zernio acceptance or full STE compliance. Prose checks are lexical heuristics; inspect transcripts for semantic claims.`,
    ``,
    `| Case | Result | Failed checks | Latency |`,
    `| --- | --- | --- | --- |`,
    ...results.map(
      (result) =>
        `| ${result.id} | ${result.passed ? "PASS" : "FAIL"} | ${
          result.checks
            .filter((check) => !check.passed)
            .map((check) => check.name)
            .join(", ") || "—"
        } | ${result.latencyMs} ms |`,
    ),
    ``,
    ...safe.results.flatMap((result) => [
      `## ${result.id}`,
      ``,
      result.text,
      ``,
      ...(result.style.longSentences.length
        ? [
            `Sentence-length findings:`,
            ...result.style.longSentences.map(
              (sentence) =>
                `- ${sentence.words}/${sentence.limit} words: ${sentence.text}`,
            ),
            ``,
          ]
        : []),
    ]),
  ].join("\n");
  await writeFile(path.join(dir, "report.md"), markdown);
  console.log(`${passed}/${results.length} passed. Report: ${dir}/report.md`);
  if (passed !== results.length) process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    "Evaluation could not finish. Check the key, case name and local file access.",
  );
  process.exitCode = 1;
});
