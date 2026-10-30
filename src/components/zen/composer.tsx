"use client";

import { useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export function Composer({
  welcome = false,
  mode,
  accountReads = false,
  busy,
  onSend,
  onStop,
}: {
  welcome?: boolean;
  mode: "live" | "demo";
  accountReads?: boolean;
  busy: boolean;
  onSend: (text: string) => Promise<void>;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  function submit() {
    if (!text.trim() || busy) return;
    const value = text;
    setText("");
    void onSend(value);
  }
  return (
    <form
      className={cn("composer", welcome && "composer-welcome")}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          rows={1}
          aria-label="Message Zen"
          placeholder={
            welcome ? "Describe what you’re building…" : "Ask a follow-up…"
          }
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <InputGroupAddon align="block-end">
          <InputGroupText>
            {mode === "live"
              ? accountReads
                ? "Live AI · Mock MCP"
                : "Live conversation · Sample account"
              : "Demo conversation"}
          </InputGroupText>
          <span className="flex-1" />
          {busy ? (
            <InputGroupButton
              size="icon-sm"
              variant="default"
              aria-label="Stop response"
              onClick={onStop}
            >
              <Square />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              aria-label="Send message"
              disabled={!text.trim()}
            >
              <ArrowUp />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      {!welcome && (
        <p className="keyboard-hint">
          Enter to send <span>·</span> Shift + Enter for a new line
        </p>
      )}
    </form>
  );
}
