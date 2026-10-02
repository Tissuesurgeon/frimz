import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { signupSchema } from "@/lib/validators";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Use a valid email, a name, and a password of at least 8 characters." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  try {
    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const [user] = await db
      .insert(users)
      .values({ email, name: parsed.data.name, passwordHash })
      .returning();
    await db.insert(userSettings).values({ userId: user.id, displayName: parsed.data.name, theme: "system" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "CONNECT_TIMEOUT" || code === "ECONNREFUSED" || code === "ENETUNREACH") {
      return NextResponse.json({ error: "Frimz couldn't reach the database. Wait a moment and try again." }, { status: 503 });
    }
    throw error;
  }
}
