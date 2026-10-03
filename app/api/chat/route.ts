import { and, eq, inArray } from "drizzle-orm";
import { chatMessageSchema, modeSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/server/auth/current-user";
import { runChatTurn } from "@/server/agent/frimz-agent";
import { parseMode } from "@/lib/modes";
import { getDb } from "@/db";
import { memoryIndex } from "@/db/schema";
import { indicatorPhrase } from "@/server/agent/indicator-label";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const limit = rateLimit(`chat:${user.id}`);
  if (!limit.ok) {
    return Response.json({ error: "Frimz needs a short pause. Try again in a moment." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That message could not be read." }, { status: 400 });
  }
  const record = body as { conversationId?: unknown; message?: unknown; mode?: unknown; retry?: unknown };
  const retry = record.retry === true;
  const parsedMessage = chatMessageSchema.safeParse(record.message ?? "");
  if (!retry && !parsedMessage.success) {
    return Response.json({ error: "Write a thought for Frimz to think with." }, { status: 400 });
  }
  const mode = modeSchema.safeParse(record.mode).success ? parseMode(record.mode) : parseMode(undefined);
  const conversationId = typeof record.conversationId === "string" ? record.conversationId : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for await (const item of runChatTurn({
          userId: user.id,
          conversationId,
          message: parsedMessage.success ? parsedMessage.data : undefined,
          mode,
          retry,
          signal: request.signal,
        })) {
          if (item.type === "done" && item.indicators && item.indicators.length > 0) {
            const ids = item.indicators.map((indicator) => indicator.memoryId);
            const labels = await getDb()
              .select({ id: memoryIndex.id, type: memoryIndex.type })
              .from(memoryIndex)
              .where(and(eq(memoryIndex.userId, user.id), inArray(memoryIndex.id, ids)));
            const typeById = new Map(labels.map((label) => [label.id, label.type]));
            send(item.type, {
              ...item,
              indicators: item.indicators.map((indicator) => ({
                ...indicator,
                kind: typeById.get(indicator.memoryId) ?? "",
                label: indicatorPhrase(typeById.get(indicator.memoryId) ?? ""),
              })),
            });
          } else {
            send(item.type, item);
          }
        }
      } catch {
        send("error", { message: "Frimz couldn't connect to its AI model right now. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
