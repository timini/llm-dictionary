import { semanticDistance } from "../../lib/distance";
import type { WordLink } from "../../lib/types";
export default function NeighbourDistances({
  selected,
  links,
}: {
  selected: string;
  links: WordLink[];
}) {
  const neighbours = links
    .filter((link) => link.source === selected || link.target === selected)
    .map((link) => ({
      word: link.source === selected ? link.target : link.source,
      distance: semanticDistance(link.similarity),
    }))
    .sort((a, b) => a.distance - b.distance);
  return (
    <details className="neighbour-distances">
      <summary>Connection distances from {selected}</summary>
      <ul>
        {neighbours.map(({ word, distance }) => (
          <li key={word}>
            <span>{word}</span>
            <span>{distance.toFixed(3)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
