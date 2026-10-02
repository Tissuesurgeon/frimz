import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user) redirect("/login");
  const [settings] = await getDb().select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
  const theme = settings?.theme === "light" || settings?.theme === "dark" ? settings.theme : "system";
  return (
    <AppShell user={{ name: settings?.displayName || user.name, email: user.email }} theme={theme}>
      {children}
    </AppShell>
  );
}
