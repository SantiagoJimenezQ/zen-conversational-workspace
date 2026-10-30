"use client";
import { ChevronDown, ExternalLink } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import type { AccountRead, LiveReference } from "@/lib/zen/schema";

export function DocumentationEvidence({
  references,
  fetchedAt,
}: {
  references: LiveReference[];
  fetchedAt: string;
}) {
  return (
    <div className="live-evidence">
      <p className="live-evidence-label">Sample documentation · Mock MCP</p>
      <Collapsible className="source-disclosure">
        <CollapsibleTrigger>
          <ChevronDown />
          <span>
            {references.length} live{" "}
            {references.length === 1 ? "source" : "sources"}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul>
            {references.map((reference) => (
              <li key={reference.url}>
                <a href={reference.url} target="_blank" rel="noreferrer">
                  {reference.title}
                  <ExternalLink aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
      <p className="live-evidence-time">
        Retrieved{" "}
        <time dateTime={fetchedAt}>
          {new Date(fetchedAt).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>{" "}
        · Public documentation, not live inventory
      </p>
    </div>
  );
}
export function AccountReadCard({ snapshot }: { snapshot: AccountRead }) {
  const accounts = snapshot.resource === "accounts";
  return (
    <Card className="artifact-card">
      <CardHeader>
        <CardTitle>
          {accounts ? "Connected accounts" : "Workspace profiles"}
        </CardTitle>
        <CardDescription>Sample read from Mock MCP</CardDescription>
        <CardAction>
          <Badge variant="outline">Read-only</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {snapshot.rows.length ? (
          <ul className="account-read-list">
            {snapshot.rows.map((row, i) => (
              <li key={`${row.label}-${i}`}>
                <strong>{row.label}</strong>
                <span>{row.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>{accounts ? "No accounts connected." : "No profiles returned."}</p>
        )}
      </CardContent>
      <CardFooter>
        <div className="live-evidence-time">
          {snapshot.truncated
            ? `Showing ${snapshot.rows.length} of ${snapshot.count} returned entries`
            : `${snapshot.count} ${accounts ? (snapshot.count === 1 ? "account" : "accounts") : snapshot.count === 1 ? "profile" : "profiles"} returned`}{" "}
          · Read{" "}
          <time dateTime={snapshot.fetchedAt}>
            {new Date(snapshot.fetchedAt).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
          <p>
            Snapshot only. Ask again to refresh, or use the tool browser for
            other sample account operations.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
