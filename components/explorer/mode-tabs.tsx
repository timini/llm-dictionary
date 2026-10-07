"use client";
import type { Mode } from "../../lib/types";
export default function ModeTabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <nav className="tabs" aria-label="Explorer mode">
      <button
        className={mode === "dictionary" ? "active" : ""}
        onClick={() => onChange("dictionary")}
      >
        <span>01</span> Dictionary
      </button>
      <button
        className={mode === "connections" ? "active" : ""}
        onClick={() => onChange("connections")}
      >
        <span>02</span> Word connections <i>↗</i>
      </button>
    </nav>
  );
}
