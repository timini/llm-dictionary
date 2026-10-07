import { describe, it, expect } from "vitest";
import { buildGraph, cosine, normalizeWord } from "../../lib/graph";
import { edgeLength, semanticDistance } from "../../lib/distance";
describe("semantic geometry", () => {
  it("normalizes Unicode, case and spacing for shared cache keys", () => {
    expect(normalizeWord("  CAFÉ  ")).toBe("café");
    expect(normalizeWord("Ice   Cream")).toBe("ice cream");
    expect(normalizeWord("ＦＯＲＥＳＴ")).toBe("forest");
  });
  it("measures cosine angles, including zero vectors and invalid dimensions", () => {
    expect(cosine([1, 0], [4, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 0], [-1, 0])).toBe(-1);
    expect(cosine([0, 0], [1, 0])).toBe(0);
    expect(cosine([1, 0], [0, 0])).toBe(0);
    expect(() => cosine([], [])).toThrow("Invalid embedding dimensions");
    expect(() => cosine([1], [1, 0])).toThrow();
  });
  it("uses cosine distance for both types of edge lengths on a common scale", () => {
    expect(semanticDistance(1)).toBe(0);
    expect(semanticDistance(0)).toBe(1);
    expect(semanticDistance(-1)).toBe(2);
    expect(semanticDistance(2)).toBe(0);
    expect(semanticDistance(-2)).toBe(2);
    expect(edgeLength(1)).toBe(40);
    expect(edgeLength(0)).toBe(280);
    expect(edgeLength(-1)).toBe(520);
    expect(edgeLength(0.9)).toBeLessThan(edgeLength(0.3));
  });
  it("preserves association frequency, deduplicates edges and adds nearest neighbours", () => {
    const paths = [
      ["a", "a", "b", "c"],
      ["a", "d", "c"],
      ["a", "b", "c"],
      ["a", "e", "c"],
    ];
    const vectors = new Map([
      ["a", [1, 0]],
      ["b", [1, 0.1]],
      ["c", [0, 1]],
      ["d", [0.1, 1]],
      ["e", [-1, 0]],
    ]);
    const g = buildGraph("a", "c", paths, vectors, {
      generation: "test",
      embedding: "test",
    });
    expect(g.pathCount).toBe(4);
    expect(g.nodes.find((n) => n.id === "a")?.count).toBe(4);
    expect(g.nodes.find((n) => n.id === "b")?.count).toBe(2);
    expect(g.nodes.filter((n) => n.endpoint)).toHaveLength(2);
    expect(
      g.links.find((l) => l.source === "a" && l.target === "b")?.count,
    ).toBe(2);
    expect(g.links.some((l) => l.kind === "neighbour")).toBe(true);
    expect(
      g.links.every(
        (l) => l.source !== l.target && Number.isFinite(l.similarity),
      ),
    ).toBe(true);
    expect(
      new Set(g.links.map((l) => [l.source, l.target].sort().join("|"))).size,
    ).toBe(g.links.length);
  });
  it("handles empty and singleton vocabularies without fabricated neighbours", () => {
    expect(
      buildGraph("a", "b", [], new Map(), { generation: "x", embedding: "y" })
        .nodes,
    ).toEqual([]);
    expect(
      buildGraph("a", "b", [["a"]], new Map([["a", [1]]]), {
        generation: "x",
        embedding: "y",
      }).links,
    ).toEqual([]);
  });
});
