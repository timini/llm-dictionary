"use client";
import type { WordGraph } from "../../lib/types";
import WordGraphView from "./word-graph";
export default function ConnectionResult({
  graph,
  cached,
  onWord,
}: {
  graph: WordGraph;
  cached: boolean;
  onWord: (word: string) => void;
}) {
  return (
    <article className="graph-result">
      <div className="result-meta">
        <span>CONNECTION MAP</span>
        <span className="cache-badge">
          {cached ? "↺ Saved result" : "✧ Newly explored"}
        </span>
      </div>
      <div className="graph-title">
        <h2>
          {graph.from} <span>⟷</span> {graph.to}
        </h2>
        <p>
          {graph.pathCount} paths · {graph.nodes.length} words ·{" "}
          {graph.links.length} connections
        </p>
      </div>
      <WordGraphView graph={graph} onWord={onWord} />
      <details className="paths">
        <summary>Explore the {graph.pathCount} generated paths</summary>
        <ol>
          {graph.paths.map((path, i) => (
            <li key={i}>
              {path.map((w, j) => (
                <span key={j}>
                  {j > 0 && <i> → </i>}
                  <button onClick={() => onWord(w)}>{w}</button>
                </span>
              ))}
            </li>
          ))}
        </ol>
      </details>
      <p className="ai-note">
        Solid lines show generated associations. Dotted lines connect each word
        to its 3 nearest embedding neighbours within this graph. Edge lengths
        use cosine distance (1 − similarity): closer meanings have shorter
        edges. The force layout approximates these target distances. Select a
        node to inspect its connections.
      </p>
    </article>
  );
}
