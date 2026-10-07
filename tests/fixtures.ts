import type { Definition, WordGraph } from "../lib/types";
export const definition: Definition = {
  word: "ocean",
  pronunciation: "/oʊʃən/",
  senses: [
    {
      partOfSpeech: "noun",
      definition: "A large body of salt water.",
      example: "The ocean is blue.",
    },
  ],
  origin: "From Greek.",
  synonyms: ["sea"],
  note: "",
};
export const graph: WordGraph = {
  from: "ocean",
  to: "music",
  pathCount: 2,
  models: { generation: "test", embedding: "test" },
  paths: [
    ["ocean", "wave", "music"],
    ["ocean", "sea", "music"],
  ],
  nodes: [
    { id: "ocean", count: 2, endpoint: true },
    { id: "music", count: 2, endpoint: true },
    { id: "wave", count: 1, endpoint: false },
    { id: "sea", count: 1, endpoint: false },
    { id: "unrelated", count: 1, endpoint: false },
  ],
  links: [
    {
      source: "ocean",
      target: "wave",
      similarity: 0.9,
      kind: "association",
      count: 1,
    },
    {
      source: "wave",
      target: "music",
      similarity: 0.3,
      kind: "association",
      count: 1,
    },
    {
      source: "ocean",
      target: "sea",
      similarity: 0.95,
      kind: "neighbour",
      count: 0,
    },
    {
      source: "music",
      target: "sea",
      similarity: 0.2,
      kind: "association",
      count: 1,
    },
    {
      source: "sea",
      target: "unrelated",
      similarity: 0.1,
      kind: "neighbour",
      count: 0,
    },
  ],
};
