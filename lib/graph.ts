import type { WordGraph, WordLink } from "./types";
export function normalizeWord(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length)
    throw new Error("Invalid embedding dimensions");
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : 0;
}
export function buildGraph(
  from: string,
  to: string,
  paths: string[][],
  vectors: Map<string, number[]>,
  models: WordGraph["models"],
): WordGraph {
  const counts = new Map<string, number>();
  for (const path of paths)
    for (const word of new Set(path))
      counts.set(word, (counts.get(word) || 0) + 1);
  const nodes = [...counts].map(([id, count]) => ({
    id,
    count,
    endpoint: id === from || id === to,
  }));
  const links = new Map<string, WordLink>();
  const pair = (a: string, b: string) => [a, b].sort().join("\u0000");
  for (const path of paths)
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      if (a === b) continue;
      const key = pair(a, b),
        existing = links.get(key);
      if (existing) existing.count++;
      else
        links.set(key, {
          source: a,
          target: b,
          similarity: cosine(vectors.get(a)!, vectors.get(b)!),
          kind: "association",
          count: 1,
        });
    }
  for (const node of nodes) {
    const neighbours = nodes
      .filter((n) => n.id !== node.id)
      .map((n) => ({
        id: n.id,
        score: cosine(vectors.get(node.id)!, vectors.get(n.id)!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    for (const n of neighbours)
      if (!links.has(pair(node.id, n.id)))
        links.set(pair(node.id, n.id), {
          source: node.id,
          target: n.id,
          similarity: n.score,
          kind: "neighbour",
          count: 0,
        });
  }
  return {
    from,
    to,
    nodes,
    links: [...links.values()],
    paths,
    pathCount: paths.length,
    models,
  };
}
