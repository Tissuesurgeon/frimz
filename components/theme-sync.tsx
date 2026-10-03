"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export function ThemeSync({ theme }: { theme: "light" | "dark" | "system" }) {
  const { setTheme } = useTheme();
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (applied.current === theme) return;
    applied.current = theme;
    setTheme(theme);
  }, [setTheme, theme]);
  return null;
}
