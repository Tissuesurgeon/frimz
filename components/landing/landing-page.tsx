import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { MODES } from "@/lib/modes";

const capabilities = [
  ["Think", "Explore ideas with a partner that asks useful questions and helps you reason through possibilities."],
  ["Remember", "Decisions, insights, preferences, rejected directions, and open questions can persist across conversations."],
  ["Evolve", "Frimz remembers how an idea changed over time."],
  ["Connect", "Bring relevant context from earlier conversations into the one you are having now."],
  ["Challenge", "Ask Frimz to examine assumptions and explore alternatives."],
  ["Develop", "Turn early thoughts into clearer concepts, plans, proposals, or written outputs."],
];

const memoryKinds = ["Preferences", "Decisions", "Insights", "Rejected directions", "Open questions", "Ideas", "Changes in direction"];

const uses = ["Startup ideas", "Product development", "Software projects", "Research", "Marketing", "Business planning", "Writing", "Hackathons", "Personal projects"];

const ideaSteps = ["AI Education Platform", "AI Tutor", "Personalized AI Tutor", "Persistent Learning Context", "AI Study Partner"];

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const start = signedIn ? "/chat" : "/signup";
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo href="/" />
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href={start} className="rounded-md bg-primary px-3 py-2 text-primary-foreground">Start thinking</Link>
          </nav>
        </div>
      </header>
      <main id="content">
        <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="max-w-md text-base text-muted-foreground">Frimz doesn&apos;t decide for you. It thinks with you.</p>
            <h1 className="mt-5 max-w-xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">The AI thinking partner that remembers.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Frimz helps you think through ideas, explore possibilities, and develop better decisions — while remembering how your thinking evolves over time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={start} className="rounded-md bg-primary px-5 py-3 text-sm text-primary-foreground">Start thinking</Link>
              <a href="#how-it-works" className="rounded-md border border-border bg-card px-5 py-3 text-sm hover:bg-muted">See how it works</a>
            </div>
          </div>
          {/* Presentation-only illustration. Not a real conversation or user evidence. */}
          <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]" aria-hidden="true">
            <figcaption className="border-b border-border px-5 py-3 text-sm text-muted-foreground">Example, not a real conversation</figcaption>
            <div className="space-y-4 px-5 py-6 text-sm leading-relaxed">
              <p className="ml-auto max-w-[85%] rounded-lg bg-muted px-4 py-3">I&apos;m thinking about building an AI study partner.</p>
              <p className="max-w-[85%]">What problem do you think existing study tools aren&apos;t solving well?</p>
              <p className="max-w-[85%] rounded-lg bg-secondary px-4 py-3 text-secondary-foreground">
                <span className="block text-xs text-muted-foreground">Remembered</span>
                A focus on persistent learning context
              </p>
            </div>
          </figure>
        </section>

        <section className="border-y border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:gap-16">
            <div>
              <h2 className="text-3xl tracking-tight">Most AI conversations disappear.</h2>
              <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">You explain the idea. The reply is useful. Then the context is gone, and the next session starts from nothing.</p>
            </div>
            <div>
              <h3 className="text-lg">With Frimz</h3>
              <ol className="mt-5 space-y-3 text-muted-foreground">
                {["You explain the idea.", "Frimz helps you explore it.", "Important thinking is remembered.", "You return later.", "The conversation continues."].map((step, index) => (
                  <li key={step} className="grid grid-cols-[1.5rem_1fr] gap-3">
                    <span className="text-foreground">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="max-w-xl text-3xl tracking-tight">A partner for the thinking, not a substitute for it.</h2>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {capabilities.map(([title, copy]) => (
              <li key={title} className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-10 sm:py-6">
                <h3 className="font-medium">{title}</h3>
                <p className="max-w-xl leading-relaxed text-muted-foreground">{copy}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="ideas" className="scroll-mt-20 border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <h2 className="text-3xl tracking-tight">Your ideas have a history. Frimz remembers it.</h2>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">Frimz doesn&apos;t just remember what you said. It can remember important changes in your thinking — what you decided, what you rejected, what you learned, and what remains unresolved.</p>
            </div>
            {/* Presentation-only illustration. Not a real idea timeline. */}
            <ol className="space-y-0" aria-hidden="true">
              {ideaSteps.map((step, index) => (
                <li key={step} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-border py-3 last:border-b-0">
                  <span className="text-sm text-muted-foreground">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="memory" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
          <h2 className="text-3xl tracking-tight">Memory that actually helps.</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">Frimz does not need to remember every message. It keeps useful long-term context and leaves the rest in the conversation.</p>
          <ul className="mt-8 flex flex-wrap gap-x-3 gap-y-2 text-sm">
            {memoryKinds.map((kind) => (
              <li key={kind} className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{kind}</li>
            ))}
          </ul>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-3xl tracking-tight">Come back later.</h2>
            <p className="mt-3 text-sm text-muted-foreground">An illustration of continuity. Not a record of a real session.</p>
            {/* Presentation-only illustration. Not user evidence. */}
            <ol className="mt-8 max-w-2xl divide-y divide-border border-y border-border" aria-hidden="true">
              {[
                ["Monday", "I think we should target students first."],
                ["Wednesday", "I don't think universities are our best starting point."],
                ["Friday", "Last time, you were leaning toward individual students because you wanted a faster feedback loop."],
              ].map(([day, line]) => (
                <li key={day} className="grid gap-2 py-5 sm:grid-cols-[7rem_1fr] sm:gap-8">
                  <p className="text-sm text-muted-foreground">{day}</p>
                  <p className="leading-relaxed">{line}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
          <h2 className="text-3xl tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-4">
            {[
              ["01", "Start a conversation"],
              ["02", "Explore the idea"],
              ["03", "Frimz remembers meaningful context"],
              ["04", "Return later and continue"],
            ].map(([n, label]) => (
              <li key={n}>
                <p className="font-mono text-sm text-muted-foreground">{n}</p>
                <p className="mt-2 max-w-[16rem] leading-relaxed">{label}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-3xl tracking-tight">What people use it for</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">Frimz helps you think these through. It does not run them for you.</p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {uses.map((use) => (
                <li key={use}>{use}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-3xl tracking-tight">Four ways to think</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">The same Frimz, with a different stance. These are the modes in the conversation.</p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {MODES.map((mode) => (
                <article key={mode.id} className="bg-card p-5">
                  <h3 className="font-medium">{mode.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mode.hint}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border">
          <div className="mx-auto grid max-w-6xl lg:grid-cols-2">
            <div className="px-6 py-16 lg:pr-16">
              <h2 className="max-w-md text-3xl tracking-tight">Your thinking can travel with you.</h2>
              <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
                Frimz uses Walrus Memory for persistent semantic memory. Meaningful context is stored, then relevant pieces are recalled in a later conversation.
              </p>
              <a className="mt-8 inline-block text-sm underline underline-offset-4" href="https://docs.wal.app/walrus-memory/sdk/quick-start">Walrus Memory documentation</a>
            </div>
            <ol className="space-y-8 bg-forest px-6 py-16 text-forest-foreground lg:px-12">
              {[
                ["Stored", "Meaningful context is written to Walrus."],
                ["Recalled", "A later conversation can bring the relevant pieces back."],
                ["Left in the conversation", "Walrus is not the application database, and Frimz does not store every message there."],
              ].map(([label, copy], index) => (
                <li key={label} className="grid grid-cols-[1.75rem_1fr] gap-4">
                  <span className="text-sm text-forest-muted">{index + 1}</span>
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="mt-1 leading-relaxed text-forest-muted">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="max-w-xl text-4xl tracking-tight">Start with an idea. See where it goes.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={start} className="rounded-md bg-primary px-5 py-3 text-sm text-primary-foreground">Start thinking</Link>
            <a href="#how-it-works" className="rounded-md border border-border bg-card px-5 py-3 text-sm hover:bg-muted">Explore Frimz</a>
          </div>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.14em]"><LogoMark />FRIMZ</p>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">The AI thinking partner that remembers.</p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Product</p>
            <ul className="mt-3 space-y-2">
              <li><a href="#how-it-works">How it works</a></li>
              <li><a href="#memory">Memory</a></li>
              <li><a href="#ideas">Ideas</a></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Legal</p>
            <ul className="mt-3 space-y-2">
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
