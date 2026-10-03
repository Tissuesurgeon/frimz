"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Theme = "light" | "dark" | "system";

type Me = {
  user: { email: string; name: string };
  settings: { theme: Theme };
  counts: { conversations: number; memories: number; recalls: number; ideas: number };
};

const themes = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const heading = "text-sm font-medium text-muted-foreground";

async function saveSettings(body: { displayName?: string; theme?: Theme }) {
  const response = await fetch("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok;
}

export function SettingsForm() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [theme, setThemeValue] = useState<Theme>("system");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<Me>;
      })
      .then((body) => {
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
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const trimmed = name.trim();
  const nameChanged = Boolean(me) && trimmed.length > 0 && trimmed !== me?.user.name;
  const usage = [
    { label: "Conversations", value: me?.counts.conversations ?? 0 },
    { label: "Memories kept", value: me?.counts.memories ?? 0 },
    { label: "Times a memory was recalled", value: me?.counts.recalls ?? 0 },
    { label: "Ideas", value: me?.counts.ideas ?? 0 },
  ];
  const emptyUsage = usage.every((item) => item.value === 0);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!nameChanged) return;
    setSaving(true);
    setError("");
    const ok = await saveSettings({ displayName: trimmed });
    setSaving(false);
    if (!ok) {
      setError("Your name could not be saved.");
      return;
    }
    setName(trimmed);
    setMe((current) => (current ? { ...current, user: { ...current.user, name: trimmed } } : current));
    toast("Name saved");
    router.refresh();
  }

  async function chooseTheme(next: Theme) {
    if (next === theme) return;
    const previous = theme;
    setThemeValue(next);
    setTheme(next);
    setError("");
    if (!(await saveSettings({ theme: next }))) {
      setThemeValue(previous);
      setTheme(previous);
      setError("Appearance could not be saved.");
    }
  }

  return (
    <div className="space-y-10">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <section>
        <h2 className={heading}>Profile</h2>
        <form className="mt-3" onSubmit={saveName}>
          <label htmlFor="display-name" className="text-sm">
            Display name
          </label>
          <div className="mt-1 flex max-w-md gap-2">
            <Input id="display-name" value={name} maxLength={80} autoComplete="name" onChange={(event) => setName(event.target.value)} />
            <Button type="submit" variant="outline" disabled={!nameChanged || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
        <p className="mt-5 text-sm">Email</p>
        <p className="mt-1 text-sm text-muted-foreground">{me?.user.email}</p>
      </section>

      <fieldset>
        <legend className={heading}>Appearance</legend>
        <div className="mt-3 grid max-w-sm grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
          {themes.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={`flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                theme === value ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => void chooseTheme(value)} className="sr-only" />
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Changes apply and save right away.</p>
      </fieldset>

      <section>
        <h2 className={heading}>Your activity</h2>
        {emptyUsage ? <p className="mt-2 text-sm text-muted-foreground">Counts appear here as you use Frimz.</p> : null}
        <dl className="mt-3 max-w-md divide-y divide-border rounded-xl border border-border bg-card">
          {usage.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className={heading}>Account</h2>
        <Button type="button" variant="outline" className="mt-3" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </section>
    </div>
  );
}
