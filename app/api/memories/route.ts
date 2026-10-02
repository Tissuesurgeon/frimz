import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { getMemoryStore } from "@/server/memory/memory-runtime";
import { PostgresMemoryIndex } from "@/server/memory/memory-index";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const index = new PostgresMemoryIndex();
  const memories = await index.list(user.id);
  return NextResponse.json({
    memories: memories.filter((memory) => memory.status !== "forgotten"),
    walrusConfigured: Boolean(getMemoryStore()),
  });
}
