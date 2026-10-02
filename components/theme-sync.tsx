"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export function ThemeSync({ theme }: { theme: "light" | "dark" | "system" }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);
  return null;
}
