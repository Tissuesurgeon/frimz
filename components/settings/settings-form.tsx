"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Me = {
  user: { email: string; name: string };
  settings: { theme: "light" | "dark" | "system" };
  counts: { conversations: number; memories: number; recalls: number; ideas: number };
};

export function SettingsForm() {
  const { setTheme } = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [theme, setThemeValue] = useState<"light" | "dark" | "system">("system");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((response) => response.json())
      .then((body: Me) => {
        setMe(body);
        setName(body.user.name);
        setThemeValue(body.settings.theme);
      })
      .catch(() => setError("Settings could not be loaded."));
  }, []);

  if (!me && !error) {
    return (
      <div className="space-y-3" aria-busy="true">
        <span className="sr-only">Loading settings</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const unchanged = me && name === me.user.name && theme === me.settings.theme;
  const emptyUsage = me && me.counts.conversations + me.counts.memories + me.counts.ideas + me.counts.recalls === 0;

  return (
    <div className="space-y-10">
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground">Profile</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const response = await fetch("/api/me", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ displayName: name, theme }),
            });
            if (!response.ok) {
              setError("Settings could not be saved.");
              return;
            }
            setTheme(theme);
            toast("Settings saved");
            setMe((current) => current ? { ...current, user: { ...current.user, name }, settings: { theme } } : current);
          }}
        >
          <label className="block text-sm">
            Display name
            <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm">
            Email
            <Input className="mt-1" value={me?.user.email ?? ""} readOnly />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm">Appearance</legend>
            {(["light", "dark", "system"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm capitalize">
                <input type="radio" name="theme" checked={theme === value} onChange={() => setThemeValue(value)} />
                {value}
              </label>
            ))}
          </fieldset>
          {unchanged ? <p className="text-sm text-muted-foreground">No settings changes.</p> : null}
          <Button type="submit">Save</Button>
        </form>
      </section>
      <section>
        <h2 className="text-sm font-medium text-muted-foreground">Usage</h2>
        {emptyUsage ? <p className="mt-3 text-sm text-muted-foreground">Nothing here yet. Counts appear after you use Frimz.</p> : null}
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          <div><dd className="text-2xl tabular-nums">{me?.counts.conversations ?? 0}</dd><dt className="mt-1 text-sm text-muted-foreground">Conversations</dt></div>
          <div><dd className="text-2xl tabular-nums">{me?.counts.memories ?? 0}</dd><dt className="mt-1 text-sm text-muted-foreground">Memories</dt></div>
          <div><dd className="text-2xl tabular-nums">{me?.counts.recalls ?? 0}</dd><dt className="mt-1 text-sm text-muted-foreground">Memory recalls</dt></div>
          <div><dd className="text-2xl tabular-nums">{me?.counts.ideas ?? 0}</dd><dt className="mt-1 text-sm text-muted-foreground">Ideas</dt></div>
        </dl>
      </section>
      <section>
        <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
        <Button type="button" variant="outline" className="mt-4" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</Button>
      </section>
    </div>
  );
}
