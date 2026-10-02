import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { listIdeas } from "@/server/ideas/idea-service";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return NextResponse.json({ ideas: await listIdeas(user.id) });
}
