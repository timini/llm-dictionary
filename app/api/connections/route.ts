import { z } from 'zod';
import { buildGraph, normalizeWord } from '../../../lib/graph';
import { acquire, ApiError, environment, errorResponse, generate, gemini, jsonBody, rateLimit, read, release, save, wordSchema } from '../../../lib/server';
import type { WordGraph } from '../../../lib/types';
export const dynamic = 'force-dynamic';
const input = z.object({ from: wordSchema, to: wordSchema }).refine(v => v.from !== v.to, 'Choose two different words.');
const pathSchema = z.object({ paths: z.array(z.array(wordSchema).min(3).max(8)).length(10) });
export async function POST(req: Request) {
  try {
    const { from, to } = input.parse(await jsonBody(req));
    const env = await environment();
    const models = { generation: env.GENERATION_MODEL, embedding: env.EMBEDDING_MODEL };
    const key = `graph:v1:${models.generation}:${models.embedding}:${JSON.stringify([from, to])}`;
    const cached = await read<WordGraph>(env, key);
    if (cached) return Response.json({ status: 'complete', data: cached, cached: true });
    await rateLimit(env, req);
    const owner = await acquire(env, key);
    if (!owner) return Response.json({ status: 'processing', completed: 0, total: 10, stage: 'Another request is building this graph. Waiting for saved progress…' });
    try {
      const paths: string[][] = [];
      for (let batch = 0; batch < 10; batch++) {
        const batchKey = `${key}:paths:${batch}`;
        let part = await read<string[][]>(env, batchKey);
        if (!part) {
          const previous = paths.slice(-20);
          const output = await generate(env, `Generate exactly 10 distinct word-association paths from ${JSON.stringify(from)} to ${JSON.stringify(to)}. Each path has 3 to 8 words, starts with the exact first word, ends with the exact second word, and each consecutive pair must have an intuitive semantic association. Use varied domains and everyday words. No repeated word within a path. This is batch ${batch + 1} of 10. Avoid these previous paths: ${JSON.stringify(previous)}. Return {"paths":[["start","related word","end"],...]}.`, pathSchema, 0.95);
          part = output.paths.map(p => p.map(normalizeWord));
          if (part.some(p => p[0] !== from || p.at(-1) !== to || new Set(p).size !== p.length)) throw new ApiError('The model returned an invalid association path. Retry to continue from saved progress.', 502);
          await save(env, batchKey, 'paths', part);
          return Response.json({ status: 'processing', completed: batch + 1, total: 10, stage: `Generated ${(batch + 1) * 10} of 100 association paths` });
        }
        paths.push(...part);
      }
      const words = [...new Set(paths.flat())];
      const vectors = new Map<string, number[]>();
      const embeddingKey = (word: string) => `embedding:v1:${models.embedding}:768:${word}`;
      // Read cached vectors in parallel; persist each completed embedding batch before continuing.
      const saved: (readonly [string, number[] | null])[] = [];
      for (let offset = 0; offset < words.length; offset += 80) {
        const chunk = words.slice(offset, offset + 80);
        const rows = await env.DB.prepare(`SELECT key, value FROM cache WHERE key IN (${chunk.map(() => '?').join(',')})`).bind(...chunk.map(embeddingKey)).all<{ key: string; value: string }>();
        const byKey = new Map(rows.results.map(row => [row.key, JSON.parse(row.value) as number[]]));
        saved.push(...chunk.map(word => [word, byKey.get(embeddingKey(word)) || null] as const));
      }
      const missing: string[] = [];
      for (const [word, vector] of saved) { if (vector) vectors.set(word, vector); else missing.push(word); }
      if (missing.length) {
        const batch = missing.slice(0, 40);
        const output = await gemini(env, models.embedding, 'batchEmbedContents', { requests: batch.map(word => ({ model: `models/${models.embedding}`, content: { parts: [{ text: word }] }, outputDimensionality: 768 })) });
        const embeddings = z.array(z.object({ values: z.array(z.number().finite()).length(768) })).length(batch.length).parse(output.embeddings);
        await env.DB.batch(batch.map((word, index) => env.DB.prepare('INSERT INTO cache (key, kind, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(embeddingKey(word), 'embedding', JSON.stringify(embeddings[index].values))));
        return Response.json({ status: 'processing', completed: 10, total: 10, stage: `Embedded ${words.length - missing.length + batch.length} of ${words.length} unique words` });
      }
      const data = buildGraph(from, to, paths, vectors, models);
      await save(env, key, 'graph', data);
      return Response.json({ status: 'complete', data, cached: false });
    } finally { await release(env, key, owner); }
  } catch (error) { return errorResponse(error); }
}
