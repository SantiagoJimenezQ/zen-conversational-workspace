"use client";
import { mcpCopy } from "@/lib/zen/integration-copy";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  History,
  Info,
  Menu,
  MessageCircle,
  PanelRight,
  Phone,
  Plus,
  Settings,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Composer } from "./composer";
import { Navigation } from "./navigation";
import { TaskPanel } from "./task-panel";
import { Conversation } from "./conversation";
import { cn } from "@/lib/utils";

const ToolBrowser = dynamic(() => import("./tool-browser"));
const suggestions = [
  {
    icon: Phone,
    label: "Call users when an alert fires",
    detail: "Explore voice APIs",
    prompt:
      "I’m building an app that needs to call users when an alert fires. Can Workspace help?",
  },
  {
    icon: Settings,
    label: "Help me set up a phone number",
    detail: "Work through requirements",
    prompt: "I need a Polish number for outbound calls.",
  },
  {
    icon: BarChart3,
    label: "How many calls did we make yesterday?",
    detail: "Explore sample account data",
    prompt: "How many calls did my account make yesterday?",
  },
];
export function Workspace({
  configured,
  model,
  integration,
}: {
  configured: boolean;
  model: string;
  integration: { docs: boolean; account: boolean };
}) {
  const ws = useWorkspace(configured);
  const [toolOpen, setToolOpen] = useState(false);
  const [toolConversationId] = useState(() => crypto.randomUUID());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [railVisible, setRailVisible] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const task = ws.active?.messages
    .flatMap((m) => m.artifacts)
    .findLast((a) =>
      ["setup", "quote", "result", "cancelled"].includes(a.kind),
    );
  const accountReads = ws.mode === "live" && integration.account;
  const prompts = suggestions.map((suggestion) =>
    suggestion.icon === BarChart3
      ? {
          ...suggestion,
          label: accountReads
            ? "How many calls did we make yesterday?"
            : "Explore yesterday’s sample calls",
          prompt: accountReads
            ? "How many sample calls did my account make yesterday?"
            : "Show yesterday’s sample calls. These are demo records, not my sample account activity.",
          detail: accountReads
            ? mcpCopy("Sample account history", "Real account history")
            : "Explore sample account data",
        }
      : suggestion,
  );
  if (integration.account)
    prompts.unshift({
      icon: MessageCircle,
      label: "Show my connected accounts",
      detail: mcpCopy("Sample read via Mock MCP", "Live read via Zernio MCP"),
      prompt: "Which accounts are connected to my Workspace account?",
    });
  const navigation = (
    <Navigation
      onZen={() => {
        setNavOpen(false);
      }}
      onAccount={() => setSettingsOpen(true)}
      onNavigate={() => setNavOpen(false)}
    />
  );
  return (
    <div className="workspace">
      <a href="#zen-main" className="skip-link">
        Skip to conversation
      </a>
      <aside className="global-sidebar">{navigation}</aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="header-identity">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-nav-trigger"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <Menu />
            </Button>
            <div className="breadcrumb">
              <span>Default</span>
              <span aria-hidden="true">/</span>
              <strong>Zen</strong>
            </div>
          </div>
          <div className="header-actions">
            {integration.account && (
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Browse Workspace tools"
                onClick={() => setToolOpen(true)}
              >
                <Wrench />
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="demo-trigger"
                  onClick={() => setSettingsOpen(true)}
                >
                  <span
                    className={cn(
                      "connection-dot",
                      ws.mode === "live" && "is-live",
                    )}
                  />
                  <span>{accountReads ? "Live" : "Demo"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {ws.mode === "live"
                  ? accountReads
                    ? mcpCopy(
                        "Live AI · Mock MCP · Simulated actions",
                        "Live AI · Real MCP tools · Reviewed actions",
                      )
                    : "Live AI · account not connected"
                  : "Offline demo · simulated account"}
              </TooltipContent>
            </Tooltip>
            {task && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "task-trigger",
                  !railVisible && "rail-hidden-trigger",
                )}
                aria-label="Open current task"
                onClick={() => {
                  if (window.matchMedia("(min-width: 1200px)").matches)
                    setRailVisible(true);
                  else setTaskOpen(true);
                }}
              >
                <PanelRight />
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Conversation history"
                  onClick={() => setHistoryOpen(true)}
                >
                  <Clock3 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Conversation history</TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="lg"
              aria-label="New chat"
              onClick={() => {
                ws.selectChat(null);
                setRailVisible(true);
              }}
            >
              <Plus data-icon="inline-start" />
              <span>New chat</span>
            </Button>
          </div>
        </header>
        <div className="workspace-body">
          <main
            id="zen-main"
            className={cn("chat-main", ws.active && "has-conversation")}
          >
            {ws.active ? (
              <>
                <Conversation
                  chat={ws.active}
                  busy={ws.busy}
                  activity={ws.activity}
                  onReplace={ws.replaceArtifact}
                  onSend={ws.send}
                />
                <div className="conversation-composer">
                  {ws.error && (
                    <Alert variant="destructive">
                      <Info />
                      <AlertDescription>{ws.error}</AlertDescription>
                    </Alert>
                  )}
                  <Composer
                    mode={ws.mode}
                    accountReads={accountReads}
                    busy={ws.busy}
                    onSend={ws.send}
                    onStop={ws.stop}
                  />
                </div>
              </>
            ) : (
              <div className="welcome-scroll">
                <section className="welcome" aria-labelledby="welcome-title">
                  <div className="welcome-wordmark">
                    <MessageCircle />
                    <span>Zen</span>
                  </div>
                  <h1 id="welcome-title">What do you want to get done?</h1>
                  <p className="welcome-description">
                    Find the right API, work through setup, or understand your
                    account.
                  </p>
                  <Composer
                    welcome
                    mode={ws.mode}
                    accountReads={accountReads}
                    busy={ws.busy}
                    onSend={ws.send}
                    onStop={ws.stop}
                  />
                  <div className="suggestions">
                    {prompts
                      .filter(
                        (suggestion) =>
                          ws.mode === "live" ||
                          suggestion.label !== "Show my connected accounts",
                      )
                      .map(({ icon: Icon, label, detail, prompt }) => (
                        <button
                          key={label}
                          disabled={!ws.ready}
                          onClick={() => void ws.send(prompt)}
                        >
                          <Icon />
                          <span>
                            <strong>{label}</strong>
                            <small>{detail}</small>
                          </span>
                          <ChevronRight />
                        </button>
                      ))}
                  </div>
                </section>
                <p className="welcome-footer">
                  Unofficial concept ·{" "}
                  {accountReads
                    ? mcpCopy(
                        "Sample account tools · $5 action budget",
                        "Real account tools · $5 action budget",
                      )
                    : "Sample account"}
                </p>
              </div>
            )}
          </main>
          {task && railVisible && (
            <aside className="task-rail">
              <TaskPanel
                artifact={task}
                onCollapse={() => setRailVisible(false)}
              />
            </aside>
          )}
        </div>
      </div>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="mobile-navigation">
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace navigation</SheetTitle>
            <SheetDescription>Sample workspace navigation</SheetDescription>
          </SheetHeader>
          {navigation}
        </SheetContent>
      </Sheet>
      <Sheet open={taskOpen} onOpenChange={setTaskOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Current task</SheetTitle>
            <SheetDescription>
              Sample account · Simulated setup
            </SheetDescription>
          </SheetHeader>
          {task && <TaskPanel artifact={task} />}
        </SheetContent>
      </Sheet>
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="history-sheet">
          <SheetHeader>
            <SheetTitle>Conversations</SheetTitle>
            <SheetDescription>
              Saved in this browser. Only the latest 20 chats are kept.
            </SheetDescription>
          </SheetHeader>
          <div className="history-content">
            {ws.chats.length ? (
              <div className="history-list">
                {ws.chats.map((chat) => (
                  <div
                    className={cn(
                      "history-row",
                      chat.id === ws.activeId && "is-current",
                    )}
                    key={chat.id}
                  >
                    <button
                      onClick={() => {
                        ws.selectChat(chat.id);
                        setHistoryOpen(false);
                      }}
                    >
                      <MessageCircle />
                      <span>
                        <strong>{chat.title}</strong>
                        <small>
                          {new Date(chat.updatedAt).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short" },
                          )}{" "}
                          ·{" "}
                          {
                            chat.messages.filter((m) => m.role === "user")
                              .length
                          }{" "}
                          {chat.messages.filter((m) => m.role === "user")
                            .length === 1
                            ? "message"
                            : "messages"}
                        </small>
                      </span>
                      {chat.id === ws.activeId && <Check />}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete conversation: ${chat.title}`}
                      onClick={() => setDeleteId(chat.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <History />
                  <EmptyTitle>No conversations yet</EmptyTitle>
                  <EmptyDescription>
                    Start a conversation with Zen and it will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Dialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              This removes it from this browser. It can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Keep conversation
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteId) ws.deleteChat(deleteId);
                setDeleteId(null);
                toast.success("Conversation deleted");
              }}
            >
              Delete conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conversation settings</DialogTitle>
            <DialogDescription>
              Zen is an unofficial concept.{" "}
              {mcpCopy(
                "Live AI uses mocked account tools, inventory and call history.",
                "Live mode uses configured Zernio documentation and real account tools.",
              )}{" "}
              Other actions require UI review and are bounded by the $5 Zen
              action budget.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="conversation-mode">
                Conversation mode
              </FieldLabel>
              <Select
                value={ws.mode}
                disabled={ws.busy}
                onValueChange={(value) => ws.setMode(value as "live" | "demo")}
              >
                <SelectTrigger id="conversation-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="live" disabled={!configured}>
                      Live AI via OpenRouter
                    </SelectItem>
                    <SelectItem value="demo">
                      Offline demo · Scripted responses
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {configured
                  ? "OpenRouter is configured on the server. Chat text and selected MCP read results are sent to the model provider; never include credentials."
                  : "OpenRouter isn’t configured. Add OPENROUTER_API_KEY to .env.local to enable a live conversation."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Model</FieldLabel>
              <p className="model-name">{model}</p>
              <FieldDescription>
                Configured server-side with OPENROUTER_MODEL.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{mcpCopy("Mock MCP", "Zernio MCP")}</FieldLabel>
              <FieldDescription>
                {integration.docs
                  ? "Public documentation reads enabled."
                  : "Public documentation reads disabled."}{" "}
                {integration.account
                  ? mcpCopy(
                      "Sample account tools configured.",
                      "Local real-account tools configured.",
                    )
                  : "Account reads are not configured."}{" "}
                Successful reads show a {mcpCopy("sample", "live")} result and
                retrieval time in the conversation.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <Alert>
            <Info />
            <AlertDescription>
              {integration.account
                ? mcpCopy(
                    "Sample account access is enabled in live mode. ",
                    "Real account access is enabled in live mode. ",
                  )
                : "No live account reads are configured. "}
              {mcpCopy(
                "Catalog reads are simulated.",
                "Catalog reads use your real account.",
              )}{" "}
              Other actions require explicit UI review; unverified costs cannot
              bypass the $5 budget. Conversations, including displayed account
              snapshots, are stored in this browser.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={() => setSettingsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {integration.account && (
        <ToolBrowser
          open={toolOpen}
          onOpenChange={setToolOpen}
          conversationId={ws.activeId || toolConversationId}
        />
      )}
      <span className="sr-only" role="status">
        {ws.busy
          ? "Zen is responding"
          : ws.active
            ? "Zen is ready"
            : "Ready for a new conversation"}
      </span>
    </div>
  );
}
