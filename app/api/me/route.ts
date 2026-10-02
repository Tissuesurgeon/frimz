import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { userCounts } from "@/server/conversations/conversation-service";
import { displayNameSchema } from "@/lib/validators";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
  const counts = await userCounts(user.id);
  return NextResponse.json({
    user: { id: user.id, email: row?.email ?? user.email, name: settings?.displayName ?? row?.name ?? "" },
    settings: { theme: settings?.theme ?? "system" },
    counts,
  });
}

const patchSchema = z.object({
  displayName: displayNameSchema.optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check those settings and try again." }, { status: 400 });
  const db = getDb();
  if (parsed.data.displayName) {
    await db.update(users).set({ name: parsed.data.displayName }).where(eq(users.id, user.id));
    await db.update(userSettings).set({ displayName: parsed.data.displayName }).where(eq(userSettings.userId, user.id));
  }
  if (parsed.data.theme) {
    await db.update(userSettings).set({ theme: parsed.data.theme }).where(eq(userSettings.userId, user.id));
  }
  return NextResponse.json({ ok: true });
}
