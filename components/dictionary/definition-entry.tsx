"use client";
import type { Definition } from "../../lib/types";
export default function DefinitionEntry({
  definition,
  cached,
  onWord,
}: {
  definition: Definition;
  cached: boolean;
  onWord: (word: string) => void;
}) {
  return (
    <article className="definition">
      <div className="result-meta">
        <span>DICTIONARY ENTRY</span>
        <span className="cache-badge">
          {cached ? "↺ Saved result" : "✧ Newly explored"}
        </span>
      </div>
      <h2>{definition.word}</h2>
      <p className="pronunciation">{definition.pronunciation}</p>
      <div className="senses">
        {definition.senses.map((sense, i) => (
          <div className="sense" key={i}>
            <span className="sense-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className="part-of-speech">{sense.partOfSpeech}</span>
              <p>{sense.definition}</p>
              <blockquote>“{sense.example}”</blockquote>
            </div>
          </div>
        ))}
      </div>
      <div className="definition-details">
        {definition.origin && (
          <div>
            <h3>WORD ORIGIN</h3>
            <p>{definition.origin}</p>
          </div>
        )}
        <div>
          <h3>NEARBY WORDS</h3>
          <div className="synonyms">
            {definition.synonyms.map((s) => (
              <button key={s} onClick={() => onWord(s)}>
                {s} ↗
              </button>
            ))}
          </div>
        </div>
      </div>
      {definition.note && <p className="entry-note">{definition.note}</p>}
      <p className="ai-note">
        AI-generated interpretation. Meanings and origins may need verification.
      </p>
    </article>
  );
}
