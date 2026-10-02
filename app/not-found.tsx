import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-3xl tracking-tight">That page is not here.</h1>
      <p className="mt-3 text-muted-foreground">The conversation or idea may belong to another account, or it may not exist.</p>
      <Link href="/" className="mt-6 inline-block text-sm underline">Back to Frimz</Link>
    </main>
  );
}
