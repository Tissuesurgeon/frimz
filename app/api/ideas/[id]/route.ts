import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { getIdea } from "@/server/ideas/idea-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await params;
  const result = await getIdea(user.id, id);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(result);
}
