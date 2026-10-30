"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { artifactSchema, type Artifact } from "@/lib/zen/schema";
export async function zernioRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/chat?operation=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The provider request failed.");
  return data;
}
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
type McpArtifact = Extract<
  Artifact,
  { kind: "mcp-operation" | "mcp-result" | "live-phone" | "live-calls" }
>;
export function McpArtifactView({
  artifact,
  conversationId,
  disabled = false,
  onReplace,
}: {
  artifact: McpArtifact;
  conversationId: string;
  disabled?: boolean;
  onReplace: (a: Artifact) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [country, setCountry] = useState(
    artifact.kind === "live-phone" ? artifact.country : "US",
  );
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const data = await zernioRequest(body);
      onReplace(artifactSchema.parse(data.artifact));
      setReview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The provider request failed.");
    } finally {
      setBusy(false);
    }
  }
  const fetched =
    "fetchedAt" in artifact ? artifact.fetchedAt : artifact.updatedAt;
  const feedback = error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
  const footer = (
    <p className="live-evidence-time">
      Mock MCP ·{" "}
      {new Date(fetched).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </p>
  );
  if (artifact.kind === "mcp-operation")
    return (
      <>
        <Card className="artifact-card">
          <CardHeader>
            <CardTitle>{artifact.title}</CardTitle>
            <CardDescription>
              Sample account action · {artifact.tool}
            </CardDescription>
            <CardAction>
              <Badge
                variant={
                  artifact.status === "blocked" || artifact.status === "unknown"
                    ? "destructive"
                    : "outline"
                }
              >
                {artifact.status}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p>
              {artifact.costCents === null
                ? "No verified cost estimate"
                : `${money(artifact.costCents)} ${artifact.recurringCents ? "initial charge" : "estimated charge"}`}{" "}
              · {money(artifact.remainingCents)} remaining in the Zen action
              budget
            </p>
            {artifact.recurringCents > 0 && (
              <p className="mt-2 text-sm">
                Recurring: {money(artifact.recurringCents)}/month until released
                in the simulation. No real subscription or charge is created.
              </p>
            )}
            {artifact.reason && (
              <p className="mt-3 text-sm">{artifact.reason}</p>
            )}
            <details className="mt-3">
              <summary>Exact arguments</summary>
              <pre className="mcp-json">{artifact.argsJson}</pre>
            </details>
            {artifact.output && (
              <pre className="mcp-json">{artifact.output}</pre>
            )}
            {feedback}
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            {artifact.status === "pending" ? (
              <>
                <Button
                  disabled={busy || disabled}
                  onClick={() => {
                    setReview(true);
                    setRecurring(false);
                  }}
                >
                  Review simulated action
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || disabled}
                  onClick={() =>
                    void run({
                      action: "cancel",
                      id: artifact.operationId,
                      conversationId,
                    })
                  }
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run({
                    action: "status",
                    id: artifact.operationId,
                    conversationId,
                  })
                }
              >
                <RefreshCw />
                Refresh action status
              </Button>
            )}
            {footer}
          </CardFooter>
        </Card>
        <Dialog open={review} onOpenChange={setReview}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{artifact.title}</DialogTitle>
              <DialogDescription>
                This changes the sample account only. No external action or
                charge occurs.
              </DialogDescription>
            </DialogHeader>
            <pre className="mcp-json">{artifact.argsJson}</pre>
            <p>
              {artifact.costCents === null
                ? "Estimate unavailable"
                : `Estimated initial charge: ${money(artifact.costCents)}`}
              . Zen’s cumulative action cap is $5.
            </p>
            {artifact.recurringCents > 0 && (
              <Field orientation="horizontal">
                <Checkbox
                  id={`recurring-${artifact.operationId}`}
                  checked={recurring}
                  onCheckedChange={(v) => setRecurring(v === true)}
                />
                <div>
                  <FieldLabel htmlFor={`recurring-${artifact.operationId}`}>
                    I authorize {money(artifact.recurringCents)}/month until I
                    release this number
                  </FieldLabel>
                  <FieldDescription>
                    Simulated renewal illustrates a subscription, not a one-time
                    demo fee.
                  </FieldDescription>
                </div>
              </Field>
            )}
            {feedback}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReview(false)}
                disabled={busy}
              >
                Go back
              </Button>
              <Button
                disabled={
                  busy ||
                  disabled ||
                  artifact.costCents === null ||
                  (artifact.recurringCents > 0 && !recurring)
                }
                onClick={() =>
                  void run({
                    action: "confirm",
                    id: artifact.operationId,
                    conversationId,
                    confirmed: true,
                    approveRecurring: recurring,
                  })
                }
              >
                {busy && <Spinner />}Run simulated action
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  if (artifact.kind === "mcp-result")
    return (
      <Card className="artifact-card">
        <CardHeader>
          <CardTitle>{artifact.title}</CardTitle>
          <CardDescription>Sample result · {artifact.tool}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="mcp-json">{artifact.output}</pre>
          {feedback}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || disabled}
            onClick={() =>
              void run({
                action: "read",
                tool: artifact.tool,
                args: JSON.parse(artifact.argsJson),
              })
            }
          >
            {busy ? <Spinner /> : <RefreshCw />}Refresh from Workspace
          </Button>
          {footer}
        </CardFooter>
      </Card>
    );
  if (artifact.kind === "live-calls")
    return (
      <Card className="artifact-card insight-card">
        <CardHeader>
          <CardTitle>
            {
              {
                yesterday: "Yesterday",
                last_7_days: "Last 7 days",
                last_30_days: "Last 30 days",
              }[artifact.period]
            }{" "}
            ·{" "}
            {artifact.direction === "all"
              ? "All calls"
              : `${artifact.direction === "inbound" ? "Inbound" : "Outbound"} calls`}
          </CardTitle>
          <CardDescription>
            {new Date(artifact.since).toLocaleString("en-GB", {
              timeZone: artifact.timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            –{" "}
            {new Date(artifact.until).toLocaleString("en-GB", {
              timeZone: artifact.timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · {artifact.timeZone}
          </CardDescription>
          <CardAction>
            <Badge variant="outline">Sample account</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="call-total">
            <strong>{artifact.total}</strong>
            <span>Total attempts</span>
          </div>
          {artifact.statuses.map((s) => (
            <p key={s.status}>
              {s.status}: {s.count}
            </p>
          ))}
          <p className="live-evidence-time">
            All returned call attempts in this period were counted.
          </p>
          <details className="mt-3 text-sm">
            <summary>How this total was calculated</summary>
            <p>
              Filtered by the displayed time window and direction.{" "}
              {artifact.pages} provider page(s) checked. Duplicate records were
              counted once.
            </p>
          </details>
          {feedback}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || disabled}
            onClick={() =>
              void run({
                action: "calls",
                period: artifact.period,
                direction: artifact.direction,
              })
            }
          >
            {busy ? <Spinner /> : <RefreshCw />}Refresh sample calls
          </Button>
          {footer}
        </CardFooter>
      </Card>
    );
  return (
    <Card className="artifact-card">
      <CardHeader>
        <CardTitle>Phone number · {artifact.country}</CardTitle>
        <CardDescription>
          Live {artifact.numberType} inventory · {money(artifact.monthlyCents)}
          /month
        </CardDescription>
        <CardAction>
          <Badge variant="outline">Mock provider</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>
          {artifact.needsKyc
            ? "Identity/address verification is required before activation."
            : "This type does not currently require end-user KYC."}
        </p>
        <p className="mt-2">
          {artifact.numbers.length
            ? `${artifact.numbers.length} exact numbers returned.`
            : artifact.inStock
              ? "The catalog reports stock; no exact-number options were returned. An auto-assigned purchase may require verification."
              : "No current stock. No sample numbers are substituted."}
        </p>
        <div className="flex flex-wrap items-end gap-2 mt-4">
          <Field>
            <FieldLabel htmlFor="phone-country">Country (ISO code)</FieldLabel>
            <Input
              id="phone-country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={2}
            />
          </Field>
          <Button
            variant="outline"
            disabled={busy || disabled || country.length !== 2}
            onClick={() =>
              void run({
                action: "phone-search",
                country,
                capability: artifact.capability,
              })
            }
          >
            {busy ? <Spinner /> : <RefreshCw />}Check sample stock
          </Button>
        </div>
        {feedback}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {artifact.numbers.map((number) => (
          <Button
            key={number}
            variant="outline"
            disabled={busy || disabled}
            onClick={() =>
              void run({
                action: "phone-review",
                conversationId,
                country: artifact.country,
                capability: artifact.capability,
                numberType: artifact.numberType,
                phoneNumber: number,
              })
            }
          >
            Review {number}
          </Button>
        ))}
        {artifact.inStock && !artifact.numbers.length && (
          <Button
            disabled={busy || disabled}
            onClick={() =>
              void run({
                action: "phone-review",
                conversationId,
                country: artifact.country,
                capability: artifact.capability,
                numberType: artifact.numberType,
              })
            }
          >
            Review simulated purchase
          </Button>
        )}
        {footer}
      </CardFooter>
    </Card>
  );
}
