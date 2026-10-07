"use client";
import type { Mode } from "../../lib/types";
export default function SearchForm({
  mode,
  word,
  from,
  to,
  busy,
  setWord,
  setFrom,
  setTo,
  onDefine,
  onConnect,
}: {
  mode: Mode;
  word: string;
  from: string;
  to: string;
  busy: boolean;
  setWord: (value: string) => void;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  onDefine: (word: string) => void;
  onConnect: (from: string, to: string) => void;
}) {
  return (
    <div className="search-area">
      <div className="search-heading">
        <h2>
          {mode === "dictionary"
            ? "What’s the word?"
            : "How do two words connect?"}
        </h2>
        <span>
          {mode === "dictionary"
            ? "A little curiosity goes a long way."
            : "100 paths. Many ways to get there."}
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "dictionary") onDefine(word);
          else onConnect(from, to);
        }}
        className="search-form"
      >
        {mode === "dictionary" ? (
          <label>
            <span className="sr-only">Word to define</span>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Enter any word or short phrase…"
              required
              maxLength={60}
              autoComplete="off"
            />
          </label>
        ) : (
          <>
            <label>
              <span className="sr-only">Starting word</span>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="First word"
                required
                maxLength={60}
              />
            </label>
            <span className="between">⟷</span>
            <label>
              <span className="sr-only">Destination word</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Second word"
                required
                maxLength={60}
              />
            </label>
          </>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Exploring…"
            : mode === "dictionary"
              ? "Define word"
              : "Connect words"}{" "}
          <span>↗</span>
        </button>
      </form>
      <div className="suggestions">
        <span>TRY</span>
        {mode === "dictionary"
          ? ["serendipity", "liminal", "sonder", "petrichor"].map((w) => (
              <button disabled={busy} key={w} onClick={() => onDefine(w)}>
                {w} ↗
              </button>
            ))
          : [
              ["ocean", "music"],
              ["coffee", "space"],
              ["memory", "forest"],
            ].map(([a, b]) => (
              <button disabled={busy} key={a} onClick={() => onConnect(a, b)}>
                {a} <span>→</span> {b}
              </button>
            ))}
      </div>
    </div>
  );
}
