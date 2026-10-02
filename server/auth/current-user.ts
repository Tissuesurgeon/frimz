import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return {
    id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}
