"use client";

import { useId, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Info,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { artifactSchema, type Artifact, type Insight } from "@/lib/zen/schema";
import { cn } from "@/lib/utils";

import { McpArtifactView } from "./mcp-actions";
import { DocumentationEvidence, AccountReadCard } from "./live-evidence";

export const capabilityLabel = {
  voice: "Outbound voice",
  sms: "SMS",
  both: "Voice and SMS",
};
type Props = {
  artifact: Artifact;
  conversationId: string;
  disabled: boolean;
  onReplace: (artifact: Artifact) => void;
  onSend: (text: string) => Promise<void>;
};
export function ArtifactView({
  artifact,
  conversationId,
  disabled,
  onReplace,
  onSend,
}: Props) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pending = pendingAction !== null;
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCapability, setEditCapability] = useState(
    "capability" in artifact ? artifact.capability : "voice",
  );
  const [failNext, setFailNext] = useState(false);
  const confirmId = useId();
  const failId = useId();
  async function action(body: Record<string, unknown>) {
    setPendingAction(typeof body.action === "string" ? body.action : "update");
    setError(null);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, conversationId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "The demo action failed.");
      onReplace(artifactSchema.parse(result.artifact));
      setReview(false);
      setEditing(false);
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The demo action failed.");
    } finally {
      setPendingAction(null);
      setFailNext(false);
    }
  }
  const errorNotice = error && (
    <Alert variant="destructive">
      <Info />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  if (
    artifact.kind === "mcp-result" ||
    artifact.kind === "mcp-operation" ||
    artifact.kind === "live-phone" ||
    artifact.kind === "live-calls"
  )
    return (
      <McpArtifactView
        artifact={artifact}
        conversationId={conversationId}
        disabled={disabled}
        onReplace={onReplace}
      />
    );
  if (artifact.kind === "account-read")
    return <AccountReadCard snapshot={artifact} />;
  if (artifact.kind === "documentation")
    return (
      <Card className="artifact-card">
        <CardHeader>
          <CardTitle>Official documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentationEvidence
            references={artifact.references}
            fetchedAt={artifact.fetchedAt}
          />
        </CardContent>
      </Card>
    );
  if (artifact.kind === "insight") return <InsightCard insight={artifact} />;
  if (artifact.kind === "discovery")
    return (
      <Card className="artifact-card discovery-card">
        <CardHeader>
          <CardTitle>{artifact.title}</CardTitle>
          <CardDescription>
            {artifact.fetchedAt
              ? "Capability + live documentation"
              : "Documented capability"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>{artifact.description}</p>
          {artifact.references && artifact.fetchedAt && (
            <DocumentationEvidence
              references={artifact.references}
              fetchedAt={artifact.fetchedAt}
            />
          )}
          {artifact.topic === "voice" && (
            <div className="workflow-path">
              <span>Your app</span>
              <ArrowRight />
              <span>Workspace Voice</span>
              <ArrowRight />
              <span>Your user</span>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <span>Explore the next step</span>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              void onSend(
                artifact.topic === "voice"
                  ? "Help me set up a Polish number for outbound voice calls."
                  : "How do I connect an account?",
              )
            }
          >
            {artifact.topic === "voice" ? "Set up a number" : "Explore setup"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    );
  if (artifact.kind === "result")
    return (
      <Card className="artifact-card result-card">
        <CardHeader>
          <CardTitle>
            <CircleCheck /> Demo setup completed
          </CardTitle>
          <CardDescription>
            No real number was purchased and no charge was made.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="artifact-properties">
            <div>
              <dt>Country</dt>
              <dd>Poland (+48)</dd>
            </div>
            <div>
              <dt>Capability</dt>
              <dd>{capabilityLabel[artifact.capability]}</dd>
            </div>
            <div>
              <dt>Demo reference</dt>
              <dd className="mono">{artifact.reference}</dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter>
          <span>Want to explore your account activity?</span>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              void onSend("How many calls did my account make yesterday?")
            }
          >
            View yesterday’s calls
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    );
  if (artifact.kind === "cancelled")
    return (
      <Card className="artifact-card">
        <CardHeader>
          <CardTitle>Setup cancelled</CardTitle>
          <CardDescription>Nothing changed in your account.</CardDescription>
        </CardHeader>
        {errorNotice && <CardContent>{errorNotice}</CardContent>}
        <CardFooter>
          <Button
            variant="outline"
            disabled={disabled || pending}
            onClick={() =>
              void action({
                action: "prepare",
                country: "PL",
                capability: artifact.capability,
              })
            }
          >
            <RotateCcw data-icon="inline-start" />
            Restart setup
          </Button>
        </CardFooter>
      </Card>
    );
  const cancel = () => {
    setReview(false);
    if (artifact.kind === "quote") {
      void action({ action: "cancel", token: artifact.token });
      return;
    }
    void action({
      action: "dismiss",
      country: "PL",
      capability: artifact.capability,
    });
  };
  return (
    <div className="artifact-stack">
      <Card className="artifact-card">
        <CardHeader>
          <CardTitle>
            {artifact.kind === "setup"
              ? "Phone number search"
              : "One illustrative option"}
          </CardTitle>
          <CardAction>
            {artifact.kind === "setup" ? (
              <Button
                variant="link"
                size="sm"
                disabled={disabled || pending}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            ) : (
              <Badge variant="secondary">Simulated inventory</Badge>
            )}
          </CardAction>
          {artifact.kind === "quote" && (
            <CardDescription>
              Example inventory and price · Not a live offer
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <dl className="artifact-properties">
            <div>
              <dt>Country</dt>
              <dd>Poland (+48)</dd>
            </div>
            <div>
              <dt>Capability</dt>
              <dd>{capabilityLabel[artifact.capability]}</dd>
            </div>
            {artifact.kind === "quote" && (
              <>
                <div>
                  <dt>Demo option</dt>
                  <dd>Auto-assigned sample number</dd>
                </div>
                <div>
                  <dt>Illustrative price</dt>
                  <dd>${(artifact.monthlyCents / 100).toFixed(2)} / month</dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
        <CardFooter>
          <span>
            {artifact.kind === "setup"
              ? "Pricing and requirements are checked next."
              : "Real stock and Polish requirements are unverified."}
          </span>
          {artifact.kind === "setup" ? (
            <Button
              variant="brand"
              size="lg"
              disabled={disabled || pending}
              onClick={() =>
                void action({
                  action: "search",
                  country: "PL",
                  capability: artifact.capability,
                  simulateFailure: failNext,
                })
              }
            >
              {pendingAction === "search" ? <Spinner /> : null}
              {pendingAction === "search"
                ? "Checking availability…"
                : "Check availability"}
              {pendingAction !== "search" && (
                <ArrowRight data-icon="inline-end" />
              )}
            </Button>
          ) : (
            <Button
              variant="brand"
              size="lg"
              disabled={disabled || pending}
              onClick={() => {
                setReview(true);
                setConfirmed(false);
              }}
            >
              Review demo setup
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </CardFooter>
      </Card>
      {errorNotice}
      <div className="artifact-utilities">
        <Button
          variant="ghost"
          size="sm"
          onClick={cancel}
          disabled={pending || disabled}
        >
          {pendingAction === "cancel" || pendingAction === "dismiss" ? (
            <Spinner />
          ) : (
            <X data-icon="inline-start" />
          )}
          {pendingAction === "cancel" || pendingAction === "dismiss"
            ? "Cancelling…"
            : "Cancel setup"}
        </Button>
        {artifact.kind === "setup" ? (
          <details className="scenario-options">
            <summary>Scenario options</summary>
            <Field orientation="horizontal">
              <Checkbox
                id={failId}
                checked={failNext}
                onCheckedChange={(v) => setFailNext(v === true)}
              />
              <FieldLabel htmlFor={failId}>
                Fail the next inventory check
              </FieldLabel>
            </Field>
          </details>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || disabled}
            onClick={() =>
              void action({
                action: "prepare",
                country: "PL",
                capability: artifact.capability,
              })
            }
          >
            Check again
          </Button>
        )}
      </div>
      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!pending) setEditing(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit phone number search</DialogTitle>
            <DialogDescription>
              The guided simulation covers Poland. Use the official catalog to
              check other countries.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Country</FieldLabel>
              <p>Poland (+48)</p>
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-capability">Capability</FieldLabel>
              <Select
                value={editCapability}
                onValueChange={(v) =>
                  setEditCapability(v as typeof editCapability)
                }
              >
                <SelectTrigger id="setup-capability">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="voice">Outbound voice</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="both">Voice and SMS</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {errorNotice}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                void action({
                  action: "prepare",
                  country: "PL",
                  capability: editCapability,
                });
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={review}
        onOpenChange={(v) => {
          if (!pending) {
            setReview(v);
            setConfirmed(false);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review demo setup</DialogTitle>
            <DialogDescription>
              This only completes a simulation. No real number will be purchased
              and no payment will be made.
            </DialogDescription>
          </DialogHeader>
          <dl className="review-properties">
            <div>
              <dt>Country</dt>
              <dd>Poland (+48)</dd>
            </div>
            <div>
              <dt>Capability</dt>
              <dd>{capabilityLabel[artifact.capability]}</dd>
            </div>
            <div>
              <dt>Illustrative recurring price</dt>
              <dd>$8.00 / month</dd>
            </div>
          </dl>
          <Alert>
            <Info />
            <AlertDescription>
              In a live flow, you’d verify stock, the actual price, billing and
              any country-specific identity or address requirements before
              purchasing. These have not been checked here.
            </AlertDescription>
          </Alert>
          <FieldGroup>
            <Field orientation="horizontal">
              <Checkbox
                id={confirmId}
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                disabled={pending}
              />
              <div>
                <FieldLabel htmlFor={confirmId}>
                  I understand this is a demo setup
                </FieldLabel>
                <FieldDescription>
                  The $8 price is sample data, not a Workspace quote.
                </FieldDescription>
              </div>
            </Field>
          </FieldGroup>
          {errorNotice}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setReview(false);
                setConfirmed(false);
              }}
            >
              Go back
            </Button>
            <Button
              variant="brand"
              disabled={!confirmed || pending || artifact.kind !== "quote"}
              onClick={() =>
                artifact.kind === "quote" &&
                void action({
                  action: "confirm",
                  token: artifact.token,
                  confirmed: true,
                })
              }
            >
              {pending && <Spinner />}Complete demo setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const [view, setView] = useState<"status" | "channel" | "failures">("status");
  const rows =
    view === "channel"
      ? [
          { label: "PSTN", value: insight.pstn },
          { label: "WhatsApp", value: insight.whatsapp },
        ]
      : [
          { label: "Completed", value: insight.completed },
          { label: "Unanswered", value: insight.unanswered },
          { label: "Failed", value: insight.failed },
        ];
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(insight.date + "T12:00:00Z"));
  return (
    <Card className="artifact-card insight-card">
      <CardHeader>
        <CardTitle>Outbound calls</CardTitle>
        <CardAction>
          <Badge variant="secondary">Sample data</Badge>
        </CardAction>
        <CardDescription>
          {date} · 00:00–24:00 · {insight.timeZone}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="call-total">
          <strong>{insight.total}</strong>
          <span>Total attempts</span>
        </div>
        {view === "failures" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insight.calls
                .filter((c) => c.status === "failed")
                .map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {new Intl.DateTimeFormat("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: insight.timeZone,
                      }).format(new Date(c.at))}
                    </TableCell>
                    <TableCell>
                      {c.channel === "pstn" ? "PSTN" : "WhatsApp"}
                    </TableCell>
                    <TableCell>{c.reason}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <dl className="call-breakdown">
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  <span
                    className={cn(
                      "breakdown-track",
                      row.label === "Failed" && "is-failed",
                    )}
                  >
                    <span
                      style={{
                        width: `${insight.total ? (row.value / insight.total) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <strong>{row.value}</strong>
                </dd>
              </div>
            ))}
          </dl>
        )}
        <details className="calculation-details">
          <summary>View calculation and sources</summary>
          <p>
            Count outbound attempts with timestamps ≥ the start and &lt; the end
            of the account’s previous calendar day. Includes failed and
            unanswered calls. Sample fixtures are calculated by code.
          </p>
          <code>
            {insight.since}
            <br />
            to {insight.until} (exclusive)
          </code>
          <a
            href="https://docs.zernio.com/calls/list-calls"
            target="_blank"
            rel="noreferrer"
          >
            Official call-history reference
          </a>
        </details>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          aria-pressed={view === "failures"}
          onClick={() => setView(view === "failures" ? "status" : "failures")}
        >
          {view === "failures" ? <Check data-icon="inline-start" /> : null}Show
          failed calls
        </Button>
        <Button
          variant="outline"
          aria-pressed={view === "channel"}
          onClick={() => setView(view === "channel" ? "status" : "channel")}
        >
          Break down by channel
        </Button>
      </CardFooter>
    </Card>
  );
}
