import Link from "next/link";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main id="content" className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground">Frimz</Link>
      <h1 className="mt-6 text-4xl tracking-tight">Privacy</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>Frimz stores your account email, a password hash, conversations, messages, ideas, and a memory index in PostgreSQL. Durable memories are also written to Walrus Memory in a namespace derived from your account.</p>
        <p>You can inspect, edit, and forget memories. Forgetting hides a memory from retrieval. It does not claim that the immutable Walrus blob was physically deleted.</p>
        <p>Cursor and Walrus credentials stay on the server. Frimz does not put them in the browser, API responses, or logs.</p>
        <p>Other people cannot read your conversations, ideas, or memories through the app. Your account is empty until you start a conversation.</p>
      </div>
    </main>
  );
}
