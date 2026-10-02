import Link from "next/link";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main id="content" className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground">Frimz</Link>
      <h1 className="mt-6 text-4xl tracking-tight">Terms</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>Frimz is a thinking partner. You remain the decision maker. Replies are suggestions, not instructions to act, and they can be wrong.</p>
        <p>You are responsible for what you share in a conversation. Do not submit secrets you would not want stored as memory.</p>
        <p>These notes describe how this deployment behaves. They are not a substitute for legal advice, and no warranty is offered beyond what the software actually does.</p>
      </div>
    </main>
  );
}
