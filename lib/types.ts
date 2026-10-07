export type Definition = { word: string; pronunciation: string; senses: { partOfSpeech: string; definition: string; example: string }[]; origin: string; synonyms: string[]; note: string };
export type WordNode = { id: string; count: number; endpoint: boolean };
export type WordLink = { source: string; target: string; similarity: number; kind: 'association' | 'neighbour'; count: number };
export type WordGraph = { from: string; to: string; nodes: WordNode[]; links: WordLink[]; paths: string[][]; pathCount: number; models: { generation: string; embedding: string } };
export type JobResponse = { status: 'processing'; completed: number; total: number; stage: string } | { status: 'complete'; data: WordGraph; cached: boolean };
