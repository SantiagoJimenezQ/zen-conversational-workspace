import { POST as mockOperationPost } from "../zernio/route";
import { withPreviewSession } from "@/lib/zen/preview-session";
import { admitPreview } from "@/lib/zen/admission";
import { assertPreviewBudget } from "@/lib/zen/budget";
import { chatRequest, type StreamEvent } from "@/lib/zen/schema";
import { runOpenRouter, providerConfig } from "@/lib/zen/openrouter";
import { mcpConfig } from "@/lib/zen/mcp";
import { operationContext } from "@/lib/zen/operations";
import { demoResponse } from "@/lib/zen/demo";
import { requestGuard, readBody } from "@/lib/zen/http";

import { readActionContext, withActionReceipt } from "@/lib/zen/action-context";

export const runtime = "nodejs";
export const maxDuration = 90;
async function handle(request: Request) {
  const rejected = requestGuard(request);
  if (rejected) return rejected;
  let input;
  try {
    input = chatRequest.parse(await readBody(request));
  } catch {
    return Response.json(
      {
        error:
          "The conversation request is invalid or too large. Start a new chat.",
      },
      { status: 400 },
    );
  }
  if (input.messages.at(-1)?.role !== "user")
    return Response.json(
      { error: "A user message is required." },
      { status: 400 },
    );
  if (input.mode === "live" && !providerConfig().configured)
    return Response.json(
      {
        error:
          "OpenRouter isn’t configured. Add your key to .env.local or select the offline demo.",
      },
      { status: 503 },
    );
  let release = () => {};
  if (input.mode === "live") {
    const admitted = admitPreview(request);
    if (admitted instanceof Response) return admitted;
    release = admitted.release;
    try {
      if (process.env.VERCEL === "1") await assertPreviewBudget(request.signal);
    } catch {
      release();
      return Response.json(
        {
          error:
            "Live AI is unavailable or its preview budget is exhausted. Try the offline demo.",
        },
        { status: 503 },
      );
    }
  }
  const actionContext = readActionContext(input.receipts, input.conversationId);
  const providerEvents =
    input.mode === "live" && mcpConfig().account
      ? await operationContext(input.operationIds ?? [], input.conversationId)
      : [];
  const abort = new AbortController();
  const signal = AbortSignal.any([
    request.signal,
    abort.signal,
    AbortSignal.timeout(85000),
  ]);
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        if (!cancelled)
          controller.enqueue(
            encoder.encode(
              JSON.stringify(
                event.type === "artifact"
                  ? {
                      ...event,
                      artifact: withActionReceipt(
                        input.conversationId,
                        event.artifact,
                      ),
                    }
                  : event,
              ) + "\n",
            ),
          );
      };
      try {
        if (input.mode === "demo") {
          for (const event of demoResponse(
            input.messages,
            new Date(),
            actionContext,
          )) {
            signal.throwIfAborted();
            emit(event);
          }
        } else {
          await runOpenRouter(
            input.messages,
            emit,
            signal,
            actionContext,
            input.omittedMessages,
            input.conversationId,
            providerEvents,
          );
          emit({ type: "done" });
        }
      } catch (error) {
        if (!request.signal.aborted && !cancelled)
          emit({
            type: "error",
            message: signal.aborted
              ? "The request timed out. Please try again."
              : error instanceof Error &&
                  !/JSON|Unexpected|fetch|network|token|sk-/i.test(
                    error.message,
                  )
                ? error.message
                : "The conversation could not finish. Please try again.",
          });
      } finally {
        release();
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      release();
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const rejected = requestGuard(request);
  if (rejected) return rejected;
  if (new URL(request.url).searchParams.get("operation") === "1")
    return mockOperationPost(request);
  return withPreviewSession(request, () => handle(request));
}
