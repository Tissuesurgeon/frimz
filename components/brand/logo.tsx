import Link from "next/link";

export function LogoMark({ className = "h-7 w-7", onForest = false }: { className?: string; onForest?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#1e3a34" stroke={onForest ? "rgb(243 246 244 / 0.24)" : "none"} />
      <rect x="6.5" y="6.5" width="12" height="12" rx="2.5" fill="#9fbfb3" />
      <rect x="13.5" y="13.5" width="12" height="12" rx="2.5" fill="#f3f6f4" />
    </svg>
  );
}

export function Logo({ href, className, onForest = false }: { href: string; className?: string; onForest?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 text-sm font-semibold tracking-[0.14em] ${className ?? ""}`}>
      <LogoMark onForest={onForest} />
      FRIMZ
    </Link>
  );
}
