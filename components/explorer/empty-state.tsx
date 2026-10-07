"use client";
import type { Mode } from "../../lib/types";
export default function EmptyState({ mode }: { mode: Mode }) {
  return (
    <div className="empty-result">
      <span className="empty-symbol">
        {mode === "dictionary" ? "“ ”" : "•—•"}
      </span>
      <h3>
        {mode === "dictionary"
          ? "Every word has a story."
          : "There’s a connection waiting to be found."}
      </h3>
      <p>
        {mode === "dictionary"
          ? "Enter a word above to discover its meaning, origin, and related words."
          : "Choose two words to explore the associations between them."}
      </p>
    </div>
  );
}
