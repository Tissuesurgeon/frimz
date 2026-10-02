import Link from "next/link";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1e3a34" />
      <rect x="6.5" y="6.5" width="12" height="12" rx="2.5" fill="#9fbfb3" />
      <rect x="13.5" y="13.5" width="12" height="12" rx="2.5" fill="#f3f6f4" />
    </svg>
  );
}

export function Logo({ href, className }: { href: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 text-sm font-semibold tracking-[0.14em] ${className ?? ""}`}>
      <LogoMark />
      FRIMZ
    </Link>
  );
}
