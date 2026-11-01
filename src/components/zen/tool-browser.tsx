"use client";
import { mcpCopy } from "@/lib/zen/integration-copy";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { artifactSchema, type Artifact } from "@/lib/zen/schema";
import { McpArtifactView, zernioRequest } from "./mcp-actions";
type Tool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: {
    properties?: Record<
      string,
      { type?: string; default?: unknown; description?: string }
    >;
    required?: string[];
  };
};
export default function ToolBrowser({
  open,
  onOpenChange,
  conversationId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
}) {
  const [query, setQuery] = useState("");
  const queryRef = useRef("");
  const catalogRequest = useRef(0);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState<Tool | null>(null);
  const [args, setArgs] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultConversationId, setResultConversationId] =
    useState(conversationId);
  const [result, setResult] = useState<Artifact | null>(null);
  const [activity, setActivity] = useState<{
    limitCents: number;
    committedCents: number;
    operations: {
      id: string;
      conversationId: string;
      tool: string;
      status: string;
      at: string;
      costCents: number | null;
    }[];
  } | null>(null);
  async function search(value = query) {
    const requestId = ++catalogRequest.current;
    setBusy(true);
    setError("");
    try {
      const data = await zernioRequest({ action: "catalog", query: value });
      if (requestId === catalogRequest.current) setTools(data.tools);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Catalog unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function refreshActivity() {
    try {
      setActivity(await zernioRequest({ action: "activity" }));
    } catch {
      setError("The local action history could not be read.");
    }
  }
  useEffect(() => {
    if (!open) return;
    const requestId = ++catalogRequest.current;
    const abort = new AbortController();
    let active = true;
    void Promise.all([
      fetch("/api/chat?operation=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "catalog", query: queryRef.current }),
        signal: abort.signal,
      }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Catalog unavailable.");
        return data;
      }),
      zernioRequest({ action: "activity" }),
    ])
      .then(([catalog, log]) => {
        if (active) {
          if (requestId === catalogRequest.current) setTools(catalog.tools);
          setActivity(log);
        }
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error ? error.message : "Catalog unavailable.",
          );
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [open]);
  async function prepare() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await zernioRequest({
        action: "prepare",
        conversationId,
        tool: selected.name,
        args: JSON.parse(args),
      });
      setResultConversationId(conversationId);
      setResult(artifactSchema.parse(data.artifact));
      await refreshActivity();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workspace tools</DialogTitle>
          <DialogDescription>
            {mcpCopy(
              "Mock catalog and tool search. Reads return sample results. Other tools prepare simulated actions.",
              "Live core catalog and full-catalog search. Reads return real results. Other tools prepare reviewed actions.",
            )}{" "}
            A chat message never confirms an action.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <Field>
              <FieldLabel htmlFor="tool-query">
                Search the full MCP catalog
              </FieldLabel>
              <Input
                id="tool-query"
                value={query}
                onChange={(e) => {
                  queryRef.current = e.target.value;
                  setQuery(e.target.value);
                }}
                placeholder="Phone numbers, profiles, calls…"
              />
            </Field>
            <Button disabled={busy}>{busy ? <Spinner /> : "Search"}</Button>
          </form>
          <div className="mcp-tool-layout">
            <div className="mcp-tool-list">
              {tools.map((tool) => (
                <Button
                  key={tool.name}
                  variant={selected?.name === tool.name ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => {
                    setSelected(tool);
                    setResult(null);
                    const values: Record<string, unknown> = {};
                    for (const [name, p] of Object.entries(
                      tool.inputSchema.properties || {},
                    )) {
                      if (p.default !== undefined && p.default !== null)
                        values[name] = p.default;
                      else if (tool.inputSchema.required?.includes(name))
                        values[name] =
                          p.type === "boolean"
                            ? false
                            : p.type === "integer" || p.type === "number"
                              ? 0
                              : p.type === "array"
                                ? []
                                : p.type === "object"
                                  ? {}
                                  : "";
                    }
                    setArgs(JSON.stringify(values, null, 2));
                  }}
                >
                  {tool.title || tool.name}
                </Button>
              ))}
            </div>
            <div>
              {selected ? (
                <FieldGroup>
                  <Field>
                    <FieldLabel>{selected.title || selected.name}</FieldLabel>
                    <p className="text-sm text-muted-foreground">
                      {selected.description}
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="tool-args">
                      Exact arguments (JSON)
                    </FieldLabel>
                    <Textarea
                      id="tool-args"
                      rows={7}
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      maxLength={24000}
                    />
                  </Field>
                  <details>
                    <summary>Input schema</summary>
                    <pre className="mcp-json">
                      {JSON.stringify(selected.inputSchema, null, 2)}
                    </pre>
                  </details>
                  <Button disabled={busy} onClick={() => void prepare()}>
                    {busy && <Spinner />}
                    {mcpCopy(
                      "Prepare / read mock tool",
                      "Prepare / read real tool",
                    )}
                  </Button>
                </FieldGroup>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose a tool. Only the supported sample tools are available.
                </p>
              )}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {result &&
            [
              "mcp-operation",
              "mcp-result",
              "live-phone",
              "live-calls",
            ].includes(result.kind) && (
              <McpArtifactView
                artifact={
                  result as Extract<
                    Artifact,
                    {
                      kind:
                        | "mcp-operation"
                        | "mcp-result"
                        | "live-phone"
                        | "live-calls";
                    }
                  >
                }
                conversationId={resultConversationId}
                onReplace={(a) => {
                  setResult(a);
                  void refreshActivity();
                }}
              />
            )}
          <div>
            <div className="flex items-center justify-between gap-2">
              <strong>Zen action budget</strong>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshActivity()}
              >
                Refresh activity
              </Button>
            </div>
            <p className="text-sm">
              ${((activity?.committedCents || 0) / 100).toFixed(2)} committed /
              $5.00 total.{" "}
              {mcpCopy(
                "This temporary sample ledger records simulated approvals. No real charges occur.",
                "Provider-side changes appear when you refresh a real read; this ledger records Zen approvals.",
              )}
            </p>
            <ul className="mt-3 text-sm">
              {activity?.operations
                .slice(-10)
                .reverse()
                .map((o) => (
                  <li key={o.id}>
                    <Button
                      variant="link"
                      onClick={() => {
                        void zernioRequest({
                          action: "status",
                          id: o.id,
                          conversationId: o.conversationId,
                        })
                          .then((data) => {
                            setResultConversationId(o.conversationId);
                            setResult(artifactSchema.parse(data.artifact));
                          })
                          .catch((error) =>
                            setError(
                              error instanceof Error
                                ? error.message
                                : "Action status unavailable.",
                            ),
                          );
                      }}
                    >
                      {o.tool} · {o.status} ·{" "}
                      {new Date(o.at).toLocaleTimeString("en-GB")}
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
