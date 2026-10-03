import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MemoryGlyph } from "@/components/brand/memory-glyph";
import { MODES } from "@/lib/modes";
import { IdeaLineage } from "./idea-lineage";
import { BriefSketch, ClosingPath, EvolutionLine, MemoryThread, SessionsGraphic, WalrusLoop } from "./landing-graphics";
import styles from "./landing.module.css";

const headline = ["The", "AI", "thinking", "partner", "that", "remembers."];

const kept = [
  { kind: "decision", term: "Decisions", copy: "What you chose, kept settled until you decide to reopen it." },
  { kind: "rejection", term: "Directions set aside", copy: "What you ruled out, and the reason you gave." },
  { kind: "insight", term: "Insights", copy: "What you realised along the way, in your own framing." },
  { kind: "open_question", term: "Open questions", copy: "What is still unresolved, waiting for you when you return." },
];

const stored = [
  { label: "Stored", copy: "A decision or a change is written to Walrus Memory.", swatch: "bg-forest-foreground" },
  { label: "Recalled", copy: "A later conversation brings that piece back when it helps.", swatch: "bg-sage" },
  {
    label: "Stays in Frimz",
    copy: "Messages and each idea's current thinking live in Frimz's own database.",
    swatch: "bg-forest-muted/30",
  },
];

function Capability({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-8 py-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16 lg:py-14">
      <div>
        <h3 className="text-[1.75rem] leading-tight tracking-tight">{title}</h3>
        <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">{copy}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const sectionTitle = "text-[clamp(1.875rem,3.4vw,2.75rem)] leading-[1.08] tracking-tight";

function delay(ms: number) {
  return { "--d": `${ms}ms` } as CSSProperties;
}

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const start = signedIn ? "/chat" : "/signup";
  const startLabel = signedIn ? "Continue" : "Start thinking";
  return (
    <div className="min-h-dvh">
      <header className="on-forest sticky top-0 z-20 border-b border-white/10 bg-forest text-forest-foreground">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Logo href="/" onForest />
          <nav className="flex items-center gap-1 text-sm" aria-label="Account">
            {signedIn ? null : (
              <Link href="/login" className="rounded-md px-3 py-2 text-forest-muted hover:text-forest-foreground">
                Sign in
              </Link>
            )}
            <Link href={start} className={`${styles.cta} rounded-md bg-forest-foreground px-3.5 py-2 font-medium text-forest hover:bg-white`}>
              {startLabel}
            </Link>
          </nav>
        </div>
      </header>

      <main id="content">
        <section className="on-forest bg-forest text-forest-foreground">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-20 lg:pb-28 lg:pt-24">
            <div>
              <p className={`${styles.rise} text-forest-muted`}>Frimz doesn&apos;t decide for you. It thinks with you.</p>
              <h1 className="mt-6 max-w-2xl text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.98] tracking-[-0.035em]">
                {headline.map((word, index) => (
                  <Fragment key={word}>
                    <span
                      className={`${styles.word} ${index === headline.length - 1 ? "text-sage" : ""}`}
                      style={{ "--w": index } as CSSProperties}
                    >
                      {word}
                    </span>
                    {index < headline.length - 1 ? " " : null}
                  </Fragment>
                ))}
              </h1>
              <p className={`${styles.rise} mt-7 max-w-xl text-lg leading-relaxed text-forest-muted`} style={delay(420)}>
                Think through ideas with an AI that remembers where you&apos;ve been and helps turn your thinking into something you can build on.
              </p>
              <div className={`${styles.rise} mt-9 flex flex-wrap gap-3`} style={delay(520)}>
                <Link href={start} className={`${styles.cta} rounded-md bg-forest-foreground px-5 py-3 text-sm font-medium text-forest hover:bg-white`}>
                  {startLabel}
                </Link>
                <a href="#return" className={`${styles.cta} rounded-md border border-white/25 px-5 py-3 text-sm hover:border-white/45 hover:bg-white/5`}>
                  See a thought return
                </a>
              </div>
            </div>
            <IdeaLineage />
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-2 md:gap-20 lg:py-28">
          <div>
            <SessionsGraphic />
            <h2 className="mt-10 text-[clamp(1.75rem,3vw,2.25rem)] leading-tight tracking-tight">A good reply ends with the session.</h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
              You explain the idea. The answer helps. The next session starts from a blank page, and you explain it all again.
            </p>
          </div>
          <div>
            <SessionsGraphic keep />
            <h2 className="mt-10 text-[clamp(1.75rem,3vw,2.25rem)] leading-tight tracking-tight">Frimz keeps the change.</h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
              It holds on to what matters: the decision you made, the direction you dropped, and the question still waiting for an answer.
            </p>
          </div>
        </section>

        <section id="memory" className="scroll-mt-16 border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-6 pb-8 pt-20 lg:pt-24">
            <h2 className={`max-w-2xl ${sectionTitle}`}>Think it through, keep what matters, and build on it.</h2>
            <div className="mt-8 divide-y divide-border">
              <Capability title="Think" copy="Explore an idea, challenge your assumptions, and compare the alternatives. Pick the kind of help you want.">
                <ul className="border-t border-border lg:border-t-0">
                  {MODES.map((mode) => (
                    <li key={mode.id} className="flex items-baseline gap-5 border-b border-border py-4 last:border-b-0">
                      <span className="w-24 shrink-0">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{mode.label}</span>
                      </span>
                      <span className="text-sm leading-relaxed text-muted-foreground">{mode.hint}</span>
                    </li>
                  ))}
                </ul>
              </Capability>
              <Capability title="Remember" copy="Frimz keeps the meaningful parts of a conversation, along with how you like to work. The rest stays in the transcript.">
                <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                  {kept.map((item) => (
                    <div key={item.kind}>
                      <dt className="flex items-center gap-2.5 font-medium">
                        <MemoryGlyph kind={item.kind} className="h-4 w-4 shrink-0 text-primary" />
                        {item.term}
                      </dt>
                      <dd className="mt-2 max-w-xs leading-relaxed text-muted-foreground">{item.copy}</dd>
                    </div>
                  ))}
                </dl>
              </Capability>
              <Capability title="Evolve" copy="Frimz tracks how an idea changes over time, so you can see where it started and why it moved.">
                <EvolutionLine />
              </Capability>
              <Capability
                title="Build"
                copy="Frimz keeps a structured picture of where each idea stands, which you can read and correct. When you wrap up, it can write a project brief, a proposal, or a summary from it."
              >
                <BriefSketch />
              </Capability>
            </div>
          </div>
        </section>

        <section id="return" className="scroll-mt-16">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20 lg:py-28">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className={sectionTitle}>Come back on Friday. The Monday decision is still there.</h2>
              <p className="mt-5 max-w-sm leading-relaxed text-muted-foreground">
                Frimz recalls what you decided and what you set aside, then brings it into the reply when it matters.
              </p>
              <p className="mt-6 text-sm text-muted-foreground">An illustration of continuity, written for this page.</p>
            </div>
            <MemoryThread />
          </div>
        </section>

        <section className="lg:bg-[linear-gradient(to_right,transparent_50%,var(--forest)_50%)]">
          <div className="mx-auto grid max-w-6xl lg:grid-cols-2">
            <div className="px-6 py-20 lg:py-28 lg:pr-16">
              <h2 className={`max-w-md ${sectionTitle}`}>Your thinking can travel with you.</h2>
              <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
                Decisions, insights, and open questions are stored with Walrus Memory, then brought back when a later conversation needs them. The conversation
                and each idea&apos;s current thinking stay in Frimz&apos;s own database.
              </p>
              <a
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
                href="https://docs.wal.app/walrus-memory/sdk/quick-start"
              >
                Walrus Memory documentation
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
            <div className="on-forest bg-forest px-6 py-16 text-forest-foreground lg:bg-transparent lg:py-24 lg:pl-14 lg:pr-6">
              <WalrusLoop />
              <ul className="mt-10 grid gap-6 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {stored.map((item) => (
                  <li key={item.label}>
                    <p className="flex items-center gap-2 font-medium">
                      <span className={`${styles.legendKey} ${item.swatch}`} aria-hidden />
                      {item.label}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-forest-muted">{item.copy}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-[minmax(0,1fr)_auto] lg:py-32">
          <div>
            <h2 className="max-w-xl text-[clamp(2.25rem,4.6vw,3.75rem)] leading-[1.02] tracking-[-0.03em]">Start with an idea. See where it goes.</h2>
            <Link
              href={start}
              className={`${styles.cta} mt-9 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90`}
            >
              {startLabel}
            </Link>
          </div>
          <ClosingPath />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo href="/" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">Frimz doesn&apos;t decide for you. It thinks with you.</p>
          </div>
          <nav aria-label="Product" className="text-sm">
            <p className="font-medium">Product</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><a className="hover:text-foreground" href="#return">A thought returning</a></li>
              <li><a className="hover:text-foreground" href="#memory">How Frimz works</a></li>
            </ul>
          </nav>
          <nav aria-label="Legal" className="text-sm">
            <p className="font-medium">Legal</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link className="hover:text-foreground" href="/privacy">Privacy</Link></li>
              <li><Link className="hover:text-foreground" href="/terms">Terms</Link></li>
            </ul>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-6 pb-10 text-xs text-muted-foreground">Built with Walrus Memory and the Cursor SDK.</p>
      </footer>
    </div>
  );
}
