import { LogoMark } from "@/components/brand/logo";
import { MemoryGlyph } from "@/components/brand/memory-glyph";
import { MemoryNote } from "@/components/chat/memory-note";
import styles from "./landing.module.css";

const lanes = [
  { day: "Mon", widths: [26, 18, 34] },
  { day: "Wed", widths: [20, 30, 16] },
  { day: "Fri", widths: [32, 16, 24] },
];

export function SessionsGraphic({ keep = false }: { keep?: boolean }) {
  return (
    <div className={`${styles.sessions} ${keep ? styles.keep : styles.forget}`} aria-hidden="true">
      {keep ? <span className={styles.thread} /> : null}
      {lanes.map(({ day, widths }, lane) => (
        <div key={day} className={styles.lane}>
          <span className={styles.laneDay}>{day}</span>
          <span className={`${styles.start} ${keep && lane > 0 ? styles.carried : ""}`} />
          {widths.map((width, index) => (
            <span
              key={index}
              className={`${styles.bar} ${keep && lane === 0 && index === 1 ? styles.keyBar : ""}`}
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const days = [
  { day: "Monday", kind: "decision", said: "I think we should target students first.", kept: "Kept as a decision" },
  { day: "Wednesday", kind: "rejection", said: "I don't think universities are our best starting point.", kept: "Kept as a direction set aside" },
];

export function MemoryThread() {
  return (
    <ol className="max-w-2xl">
      {days.map((item) => (
        <li key={item.day} className={styles.day}>
          <span className={styles.dayNode}>
            <MemoryGlyph kind={item.kind} className="h-3.5 w-3.5" />
          </span>
          <p className={styles.dayName}>{item.day}</p>
          <p className="mt-2 w-fit max-w-xl rounded-[22px] bg-muted px-4 py-2.5 leading-relaxed">{item.said}</p>
          <p className="mt-3 text-sm text-muted-foreground">{item.kept}</p>
        </li>
      ))}
      <li className={styles.day}>
        <span className={`${styles.dayNode} ${styles.frimzNode}`}>
          <LogoMark className="h-7 w-7" />
        </span>
        <p className={styles.dayName}>Friday</p>
        <div className={styles.reply}>
          <p className="mt-2 max-w-xl text-lg leading-relaxed">
            Last time, you were leaning toward individual students because you wanted a faster feedback loop.
          </p>
          <div className="mt-4">
            <MemoryNote kind="decision" label="Used an earlier decision." />
          </div>
        </div>
      </li>
    </ol>
  );
}

const blobs = [
  { x: 306, y: 28, filled: true, role: "arrive" },
  { x: 345, y: 28, filled: true },
  { x: 384, y: 28, filled: false },
  { x: 306, y: 67, filled: true },
  { x: 345, y: 67, filled: false },
  { x: 384, y: 67, filled: true },
  { x: 306, y: 106, filled: true, role: "depart" },
  { x: 345, y: 106, filled: true },
  { x: 384, y: 106, filled: false },
];

const messages = [
  { y: 32, width: 86 },
  { y: 50, width: 62, role: "key" },
  { y: 68, width: 100 },
  { y: 86, width: 74, role: "back" },
  { y: 104, width: 92 },
  { y: 122, width: 50 },
];

export function WalrusLoop() {
  return (
    <figure>
      <svg
        className={styles.loop}
        viewBox="0 0 440 160"
        role="img"
        aria-label="Illustration: a decision travels from a conversation into Walrus Memory, and later returns to a new conversation."
      >
        <defs>
          <marker id="frimz-loop-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M1 1 7 4 1 7Z" className={styles.arrow} />
          </marker>
        </defs>
        <rect className={styles.box} x="12" y="10" width="140" height="140" rx="20" />
        {messages.map((message) => (
          <rect
            key={message.y}
            className={message.role === "key" ? styles.msgKey : message.role === "back" ? styles.msgBack : styles.msg}
            x="30"
            y={message.y}
            width={message.width}
            height="8"
            rx="4"
          />
        ))}
        <rect className={styles.box} x="288" y="10" width="140" height="140" rx="20" />
        {blobs.map((blob) => (
          <rect
            key={`${blob.x}-${blob.y}`}
            className={`${blob.filled ? styles.blob : styles.blobOpen} ${blob.role === "arrive" ? styles.blobArrive : ""} ${blob.role === "depart" ? styles.blobDepart : ""}`}
            x={blob.x}
            y={blob.y}
            width="26"
            height="26"
            rx="7"
          />
        ))}
        <path className={styles.channel} d="M152 46A88.25 88.25 0 0 1 288 46" markerEnd="url(#frimz-loop-arrow)" />
        <path className={styles.channel} d="M288 114A88.25 88.25 0 0 1 152 114" markerEnd="url(#frimz-loop-arrow)" />
        <g className={styles.orbitStore}>
          <rect className={`${styles.packetStore} ${styles.upright}`} x="146" y="40" width="12" height="12" rx="3.5" />
        </g>
        <g className={styles.orbitRecall}>
          <rect className={`${styles.packetRecall} ${styles.upright}`} x="282" y="108" width="12" height="12" rx="3.5" />
        </g>
      </svg>
      <figcaption className="mt-3 flex justify-between text-xs text-forest-muted">
        <span className="w-[32%] text-center">Conversation in Frimz</span>
        <span className="w-[32%] text-center">Walrus Memory</span>
      </figcaption>
    </figure>
  );
}

const turns = [
  { kind: "idea", text: "An AI education platform" },
  { kind: "idea_change", text: "An AI tutor" },
  { kind: "decision", text: "A study partner that remembers the last session" },
];

export function EvolutionLine() {
  return (
    <figure className={styles.evolution}>
      <ol className={styles.turns}>
        {turns.map((turn) => (
          <li key={turn.text} className={styles.turn}>
            <span className={styles.turnNode}>
              <MemoryGlyph kind={turn.kind} className="h-3.5 w-3.5" />
            </span>
            <span className={styles.turnText}>{turn.text}</span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-5 text-sm text-muted-foreground">Illustration · one idea, three turns, each with its reason kept</figcaption>
    </figure>
  );
}

const briefRows = [
  { kind: "", label: "Problem", text: "Students lose the thread between study sessions." },
  { kind: "decision", label: "Decision", text: "Start with one student at a time." },
  { kind: "rejection", label: "Set aside", text: "Selling to universities first." },
  { kind: "open_question", label: "Open question", text: "How much of the last session should come back?" },
];

export function BriefSketch() {
  return (
    <figure className={styles.sketch}>
      <div
        className={styles.sheet}
        role="img"
        aria-label="Illustration: current thinking for a study partner idea, listing its problem, a decision, a direction set aside, and an open question, with a project brief drafted from it."
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-medium">Study partner</p>
          <p className="text-xs text-muted-foreground">Current thinking · version 4</p>
        </div>
        <dl className="mt-3">
          {briefRows.map((row) => (
            <div key={row.label} className={styles.sheetRow}>
              <dt className={styles.sheetLabel}>
                {row.kind ? <MemoryGlyph kind={row.kind} className="h-3.5 w-3.5 shrink-0 text-primary" /> : <span className="h-3.5 w-3.5 shrink-0" />}
                {row.label}
              </dt>
              <dd>{row.text}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={styles.draftDoc} aria-hidden="true">
        <p className={styles.draftChip}>Draft · Project brief</p>
        <span className={styles.draftLine} style={{ width: "72%" }} />
        <span className={styles.draftLine} style={{ width: "88%" }} />
        <span className={styles.draftLine} style={{ width: "54%" }} />
      </div>
      <figcaption className="mt-4 text-sm text-muted-foreground">Illustration · current thinking for one idea, and a draft written from it</figcaption>
    </figure>
  );
}

export function ClosingPath() {
  return (
    <svg className={styles.closing} viewBox="0 0 320 120" aria-hidden="true">
      <rect className={styles.closingStart} x="8" y="74" width="20" height="20" rx="5.5" />
      <path className={styles.closingLine} d="M28 84C90 84 100 38 160 38" pathLength={1} />
      <rect className={styles.closingOpen} x="160" y="26" width="24" height="24" rx="6.5" pathLength={24} strokeDasharray="2.6 2.2" />
      <path className={styles.closingTail} d="M184 38C230 38 250 70 312 70" />
    </svg>
  );
}
