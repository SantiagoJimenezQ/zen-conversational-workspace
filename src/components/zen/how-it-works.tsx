"use client";

import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function HowItWorks({ mock }: { mock: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="link" size="sm" className="how-it-works-trigger">
          <Workflow data-icon="inline-start" />
          How it works
        </Button>
      </SheetTrigger>
      <SheetContent className="how-it-works-panel">
        <SheetHeader className="how-it-works-heading">
          <Badge variant="secondary">Inside Zen</Badge>
          <SheetTitle>How Zen works</SheetTitle>
          <SheetDescription>
            Jev checks scope. DeepSeek handles the conversation. Zen controls
            the tools.
          </SheetDescription>
        </SheetHeader>

        <div className="how-it-works-body">
          <figure
            className="architecture-flow"
            aria-label="Live chat flow: OpenRouter connects Zen to Jev for a scope decision, then DeepSeek for allowed requests. Zen validates tool arguments. Zen MCP reads return data; writes require your UI approval and a server recheck."
          >
            <figcaption>
              <span>From request to action</span>
              <Badge variant="outline">{mock ? "Mock MCP" : "Real MCP"}</Badge>
            </figcaption>
            <div className="architecture-request">
              <MessageSquare aria-hidden="true" /> Your request
            </div>
            <ArrowDown className="architecture-down" aria-hidden="true" />
            <section
              className="architecture-gateway"
              aria-label="Model calls through OpenRouter"
            >
              <h3>
                OpenRouter <span>Model gateway</span>
              </h3>
              <ol className="architecture-stages">
                <li>
                  <Image
                    src="/brands/jev-typesafe.png"
                    width={24}
                    height={24}
                    alt=""
                    aria-hidden="true"
                    className="architecture-brand-icon"
                    unoptimized
                  />
                  <strong>Jev</strong>
                  <span>Scope decision</span>
                  <ArrowRight
                    className="architecture-across"
                    aria-hidden="true"
                  />
                </li>
                <li>
                  <Image
                    src="/brands/deepseek.svg"
                    width={24}
                    height={24}
                    alt=""
                    aria-hidden="true"
                    className="architecture-brand-icon"
                    unoptimized
                  />
                  <strong>DeepSeek</strong>
                  <span>Conversation + tools</span>
                </li>
              </ol>
              <p>
                Both model calls use OpenRouter. Only allowed requests reach
                DeepSeek.
              </p>
            </section>
            <ArrowDown className="architecture-down" aria-hidden="true" />
            <div className="architecture-server">
              <ShieldCheck aria-hidden="true" />
              <strong>Zen server checks</strong>
              <span>Arguments, totals and costs</span>
            </div>
            <div className="architecture-paths">
              <section aria-label="Read path">
                <h3>Read</h3>
                <ol>
                  <li>
                    <div>Zen MCP read</div>
                    <ArrowDown aria-hidden="true" />
                  </li>
                  <li>
                    <div>Result card</div>
                  </li>
                </ol>
                <p>Read data, then explain it.</p>
              </section>
              <section aria-label="Write path">
                <h3>Write</h3>
                <ol>
                  <li>
                    <div>Review card</div>
                    <ArrowDown aria-hidden="true" />
                  </li>
                  <li>
                    <div className="architecture-approval">
                      You confirm in the UI
                    </div>
                    <ArrowDown aria-hidden="true" />
                  </li>
                  <li>
                    <div>Server rechecks</div>
                    <ArrowDown aria-hidden="true" />
                  </li>
                  <li>
                    <div>Zen MCP write</div>
                  </li>
                </ol>
              </section>
            </div>
          </figure>

          <section className="architecture-why" aria-labelledby="why-jev-title">
            <h3 id="why-jev-title">Why Jev?</h3>
            <p>
              Jev is a decision model: it returns a typed choice, not a written
              reply. That fits one bounded question: should Zen continue,
              clarify, or decline?
            </p>
            <p>
              A separate scope model lets us evaluate that policy independently
              of DeepSeek. The trade-off is another model call and possible
              false refusals.
            </p>
            <a
              href="https://openrouter.ai/typesafe/jev-1.14"
              target="_blank"
              rel="noopener noreferrer"
            >
              About Jev<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </section>

          <dl className="architecture-notes">
            <div>
              <dt>Execution stays in code</dt>
              <dd>
                Zen validates tool arguments, computes call totals, and checks
                costs and action ownership. You review the exact action and
                recurring terms. Neither model nor a chat “yes” can approve a
                write. Credentials stay on the server.
              </dd>
            </div>
          </dl>

          <div className="architecture-mode">
            <Badge variant="outline">
              {mock
                ? "Zen MCP tools: mocked data"
                : "Zen MCP tools: real provider"}
            </Badge>
            <p>
              {mock
                ? "Zen’s MCP adapter uses a mock catalog with sample profiles, phone offers and call records. Jev and DeepSeek are live in live-chat mode, but no provider account is connected. Approval only changes temporary simulation state. No real number is purchased or provider charge created."
                : "Local real mode uses Zen’s MCP adapter for Zernio’s provider tools and requires your own server credentials. Approved actions can change your account and incur provider charges."}
            </p>
          </div>
          <p className="architecture-footnote">
            This diagram describes live chat. Offline demo mode uses scripted
            responses without model calls. Scope checks are a guardrail, not
            authorization. A temporary Jev failure can use one Luna Decisions
            fallback; that does not bypass approvals.
          </p>
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Back to demo</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
