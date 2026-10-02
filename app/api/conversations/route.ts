import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { createConversation, listConversations } from "@/server/conversations/conversation-service";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const rows = await listConversations(user.id);
  return NextResponse.json({ conversations: rows });
}

const createSchema = z.object({ title: z.string().trim().min(1).max(80).optional() });

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  const conversation = await createConversation(user.id, parsed.success ? parsed.data.title ?? "New conversation" : "New conversation");
  return NextResponse.json({ conversation });
}
