import { z } from "zod";
import {
  acquire,
  ApiError,
  environment,
  errorResponse,
  generate,
  jsonBody,
  rateLimit,
  read,
  release,
  save,
  wordSchema,
} from "../../../lib/server";
import type { Definition } from "../../../lib/types";
export const dynamic = "force-dynamic";
const schema = z.object({
  pronunciation: z.string().max(200),
  senses: z
    .array(
      z.object({
        partOfSpeech: z.string().max(80),
        definition: z.string().max(1500),
        example: z.string().max(1000),
      }),
    )
    .min(1)
    .max(6),
  origin: z.string().max(1500),
  synonyms: z.array(z.string().max(80)).max(10),
  note: z.string().max(1000),
});
export async function POST(req: Request) {
  try {
    const { word } = z.object({ word: wordSchema }).parse(await jsonBody(req));
    const env = await environment(),
      key = `definition:v1:${env.GENERATION_MODEL}:${word}`;
    const cached = await read<Definition>(env, key);
    if (cached) return Response.json({ data: cached, cached: true });
    await rateLimit(env, req);
    const owner = await acquire(env, key);
    if (!owner)
      throw new ApiError(
        "This word is already being defined. Try again shortly.",
        409,
      );
    try {
      const result = await generate(
        env,
        `Define the word or phrase ${JSON.stringify(word)} in English. Include its common senses, concise examples, pronunciation, brief origin if known, and synonyms. If invented or unrecognized, label the interpretation explicitly in note and do not invent factual etymology. JSON: {"pronunciation":"...","senses":[{"partOfSpeech":"noun","definition":"...","example":"..."}],"origin":"...","synonyms":["..."],"note":"..."}.`,
        schema,
      );
      const data: Definition = { word, ...result };
      await save(env, key, "definition", data);
      return Response.json({ data, cached: false });
    } finally {
      await release(env, key, owner);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
