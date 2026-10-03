import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const title = "Frimz — The AI thinking partner that remembers.";
const description =
  "Frimz helps you think through ideas, explore possibilities, and develop better decisions, while remembering how your thinking evolves.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL || "http://localhost:3000"),
  title: { default: title, template: "%s · Frimz" },
  description,
  keywords: [
    "AI thinking partner",
    "AI with memory",
    "persistent AI memory",
    "idea development AI",
    "AI brainstorming partner",
    "AI idea evolution",
  ],
  openGraph: {
    title: "Frimz",
    description: "The AI thinking partner that remembers.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frimz",
    description: "The AI thinking partner that remembers.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
            Skip to content
          </a>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
