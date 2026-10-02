"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "signup") {
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setError(body.error ?? "The account could not be created.");
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(mode === "login" ? "Those details don’t match an account." : "The account was created, but signing in failed. Try signing in.");
        return;
      }
      router.push("/chat");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary px-12 py-14 text-primary-foreground lg:flex">
        <Logo href="/" className="text-primary-foreground" />
        <div>
          <p className="max-w-sm text-3xl leading-tight tracking-tight">Frimz doesn&apos;t decide for you. It thinks with you.</p>
          <p className="mt-4 max-w-sm text-primary-foreground/80">A thinking partner that remembers how an idea changes.</p>
        </div>
        <p className="text-sm text-primary-foreground">Your account starts empty.</p>
      </aside>
    <main id="content" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <Logo href="/" className="lg:hidden" />
      <h1 className="mt-8 text-3xl tracking-tight lg:mt-0">{mode === "login" ? "Sign in" : "Create an account"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "login" ? "Continue a conversation you already started." : "A new account starts empty. Nothing is preloaded."}
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {mode === "signup" ? (
          <label className="block text-sm">
            Name
            <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
          </label>
        ) : null}
        <label className="block text-sm">
          Email
          <Input className="mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </label>
        <label className="block text-sm">
          Password
          <div className="mt-1 flex gap-2">
            <Input type={show ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            <Button type="button" variant="outline" aria-pressed={show} onClick={() => setShow((value) => !value)}>
              {show ? "Hide" : "Show"}
            </Button>
          </div>
        </label>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {mode === "login" ? (
          <>Need an account? <Link href="/signup" className="text-foreground underline">Create one</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="text-foreground underline">Sign in</Link></>
        )}
      </p>
    </main>
    </div>
  );
}
