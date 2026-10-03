"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { IdeaLineage } from "@/components/landing/idea-lineage";
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
      <aside className="on-forest hidden flex-col bg-forest px-12 py-10 text-forest-foreground lg:flex">
        <Logo href="/" onForest />
        <div className="my-auto max-w-md py-10">
          <p className="text-3xl leading-tight tracking-tight">Frimz doesn&apos;t decide for you. It thinks with you.</p>
          <IdeaLineage className="mt-10" />
        </div>
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
          <div className="text-sm">
            <label htmlFor="password">Password</label>
            <div className="relative mt-1">
              <Input
                id="password"
                className="pr-11"
                type={show ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                aria-describedby={mode === "signup" ? "password-hint" : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground"
                onClick={() => setShow((value) => !value)}
              >
                {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {mode === "signup" ? (
              <p id="password-hint" className="mt-1.5 text-xs text-muted-foreground">At least 8 characters.</p>
            ) : null}
          </div>
          {error ? (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          {mode === "login" ? (
            <>Need an account? <Link href="/signup" className="text-foreground underline underline-offset-4">Create one</Link></>
          ) : (
            <>Already have an account? <Link href="/login" className="text-foreground underline underline-offset-4">Sign in</Link></>
          )}
        </p>
      </main>
    </div>
  );
}
