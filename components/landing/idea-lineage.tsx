import type { CSSProperties } from "react";
import { MemoryGlyph } from "@/components/brand/memory-glyph";
import styles from "./landing.module.css";

const summary =
  "Illustration of an idea changing. It started as an AI education platform, and selling to universities first was set aside. Then it became an AI tutor, narrowed to one student at a time. Now it is a study partner that remembers the last session.";

export function IdeaLineage({ className = "" }: { className?: string }) {
  return (
    <figure className={`${styles.lineage} ${className}`} role="img" aria-label={summary}>
      <figcaption className={styles.caption}>Illustration · an idea changing</figcaption>
      <ol className={styles.track}>
        <li className={styles.stop} style={{ "--i": 0 } as CSSProperties}>
          <span className={styles.node} />
          <p className={styles.when}>Started</p>
          <p className={styles.what}>An AI education platform</p>
          <div className={styles.fork}>
            <svg className={styles.forkLine} viewBox="0 0 28 28" aria-hidden="true">
              <path d="M0 0C0 16 10 28 28 28" pathLength={1} />
            </svg>
            <MemoryGlyph kind="rejection" className={styles.forkGlyph} />
            <span className={styles.forkText}>
              <span className={styles.struck}>Sell to universities first</span>
            </span>
            <span className={styles.tag}>Set aside</span>
          </div>
        </li>
        <li className={styles.stop} style={{ "--i": 1 } as CSSProperties}>
          <span className={styles.node} />
          <p className={styles.when}>Then</p>
          <p className={styles.what}>An AI tutor</p>
          <p className={styles.note}>
            <MemoryGlyph kind="idea_change" className="h-4 w-4 shrink-0" />
            Narrowed to one student at a time
          </p>
        </li>
        <li className={`${styles.stop} ${styles.now}`} style={{ "--i": 2 } as CSSProperties}>
          <span className={styles.node} />
          <p className={styles.when}>Now</p>
          <p className={styles.what}>A study partner that remembers the last session</p>
        </li>
      </ol>
    </figure>
  );
}
