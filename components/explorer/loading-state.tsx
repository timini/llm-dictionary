"use client";
import type { Mode } from "../../lib/types";
export default function LoadingState({
  mode,
  progress,
  onStop,
}: {
  mode: Mode;
  progress: string;
  onStop: () => void;
}) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      <strong>{progress}</strong>
      <p>
        {mode === "connections"
          ? "Building your graph in saved steps. The first exploration may take a few minutes."
          : "A definition, examples, and a little context."}
      </p>
      <button className="text-button" onClick={onStop}>
        Stop
      </button>
    </div>
  );
}
