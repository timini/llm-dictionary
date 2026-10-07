/** Cosine distance: 0 is identical, 1 is orthogonal, 2 is opposite. */
export function semanticDistance(similarity: number): number {
  return 1 - Math.max(-1, Math.min(1, similarity));
}
/** Scale semantic distance into readable SVG units; every edge uses the same scale. */
export function edgeLength(similarity: number): number {
  return 40 + semanticDistance(similarity) * 240;
}
