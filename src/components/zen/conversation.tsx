"use client";

import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { MessageCircle, RotateCcw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ArtifactView } from "./artifacts";
import { SourceDisclosure } from "./sources";
import { isOfficialUrl } from "@/lib/zen/sources";
import type { Conversation as Chat, Artifact } from "@/lib/zen/schema";

export function Conversation({
  chat,
  busy,
  activity,
  onReplace,
  onSend,
}: {
  chat: Chat;
  busy: boolean;
  activity: string;
  onReplace: (messageId: string, index: number, artifact: Artifact) => void;
  onSend: (text: string) => Promise<void>;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const last = chat.messages.at(-1);
  const hasSetup = chat.messages.some((m) =>
    m.artifacts.some((a) =>
      ["setup", "quote", "result", "cancelled"].includes(a.kind),
    ),
  );
  useEffect(() => {
    const el = scroll.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages, last?.text, activity]);
  useEffect(() => {
    follow.current = true;
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.id]);
  return (
    <div
      className="conversation-scroll"
      ref={scroll}
      onScroll={() => {
        const el = scroll.current;
        if (el)
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      }}
    >
      <div className="conversation-inner">
        <header className="conversation-heading">
          <h1>{hasSetup ? "Set up a Polish phone number" : chat.title}</h1>
          <p>New conversation</p>
        </header>
        <div
          className="message-list"
          role="log"
          aria-label="Conversation with Zen"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={busy}
        >
          {chat.messages.map((message, i) =>
            message.role === "user" ? (
              <article className="user-message" key={message.id}>
                <span className="sr-only">You: </span>
                <p>{message.text}</p>
              </article>
            ) : (
              <article className="assistant-message" key={message.id}>
                <MessageCircle
                  className="zen-message-icon"
                  aria-hidden="true"
                />
                <div className="assistant-content">
                  <span className="assistant-name">Zen</span>
                  {message.text && (
                    <div className="prose-chat">
                      <Markdown
                        components={{
                          a: ({ href, children }) =>
                            href && isOfficialUrl(href) ? (
                              <a href={href} target="_blank" rel="noreferrer">
                                {children}
                              </a>
                            ) : (
                              <span>{children}</span>
                            ),
                          img: () => null,
                        }}
                      >
                        {message.text}
                      </Markdown>
                    </div>
                  )}
                  {message.artifacts.map((artifact, index) => (
                    <ArtifactView
                      key={`${message.id}-${index}`}
                      artifact={artifact}
                      conversationId={chat.id}
                      disabled={
                        busy ||
                        message.status === "streaming" ||
                        message.status === "stopped" ||
                        message.status === "error"
                      }
                      onReplace={(a) => onReplace(message.id, index, a)}
                      onSend={onSend}
                    />
                  ))}
                  <SourceDisclosure ids={message.sources} />
                  {message.status === "streaming" &&
                    i === chat.messages.length - 1 && (
                      <p className="activity-line" role="status">
                        <Spinner />
                        {activity || "Writing…"}
                      </p>
                    )}
                  {message.status === "stopped" && (
                    <p className="message-state">
                      Response stopped. No pending action was completed.
                    </p>
                  )}
                  {message.status === "error" && (
                    <div className="message-state">
                      This response couldn’t finish.{" "}
                      <Button
                        variant="link"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void onSend(
                            chat.messages[i - 1]?.text ?? "Please try again.",
                          )
                        }
                      >
                        <RotateCcw data-icon="inline-start" />
                        Try again
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
