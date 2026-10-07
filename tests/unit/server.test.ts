// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  acquire,
  ApiError,
  environment,
  errorResponse,
  generate,
  gemini,
  jsonBody,
  rateLimit,
  read,
  release,
  save,
  wordSchema,
  type Env,
} from "../../lib/server";
const context = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: context.get,
}));
const statement = {
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
};
const env: Env = {
  GEMINI_API_KEY: "test-key",
  GENERATION_MODEL: "gen",
  EMBEDDING_MODEL: "embed",
  DB: { prepare: vi.fn(() => statement), batch: vi.fn() },
};
beforeEach(() => {
  context.get.mockResolvedValue({ env });
  statement.first.mockResolvedValue(null);
  statement.run.mockResolvedValue({ meta: { changes: 1 } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
describe("Cloudflare cache and locking", () => {
  it("gets the bound runtime environment", async () => {
    expect(await environment()).toBe(env);
    expect(context.get).toHaveBeenCalledWith({ async: true });
  });
  it("reads misses and serialized hits and persists complete values", async () => {
    expect(await read(env, "missing")).toBeNull();
    statement.first.mockResolvedValue({ value: '{"word":"ocean"}' });
    expect(await read(env, "hit")).toEqual({ word: "ocean" });
    await save(env, "hit", "definition", { word: "ocean" });
    expect(statement.bind).toHaveBeenLastCalledWith(
      "hit",
      "definition",
      '{"word":"ocean"}',
    );
  });
  it("acquires unique expiring locks and only releases the matching owner", async () => {
    const owner = await acquire(env, "job");
    expect(owner).toEqual(expect.any(String));
    expect(statement.bind).toHaveBeenLastCalledWith(
      "job",
      owner,
      expect.any(Number),
      expect.any(Number),
    );
    statement.run.mockResolvedValue({ meta: { changes: 0 } });
    expect(await acquire(env, "job")).toBeNull();
    await release(env, "job", "owner");
    expect(statement.bind).toHaveBeenLastCalledWith("job", "owner");
  });
  it("allows missing limiters, permitted requests, and denies excess requests", async () => {
    await rateLimit(env, new Request("https://app"));
    const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    await rateLimit(
      { ...env, RATE_LIMITER: limiter },
      new Request("https://app"),
    );
    expect(limiter.limit).toHaveBeenCalledWith({ key: "local" });
    limiter.limit.mockResolvedValue({ success: false });
    await expect(
      rateLimit(
        { ...env, RATE_LIMITER: limiter },
        new Request("https://app", {
          headers: { "cf-connecting-ip": "1.2.3.4" },
        }),
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(limiter.limit).toHaveBeenLastCalledWith({ key: "1.2.3.4" });
  });
});
describe("model transport and validation", () => {
  it("normalizes valid words and rejects invalid inputs at the boundary", () => {
    expect(wordSchema.parse("  CAFÉ  ")).toBe("café");
    for (const value of ["", "a".repeat(61), "!", "a".repeat(81)])
      expect(wordSchema.safeParse(value).success).toBe(false);
  });
  it("sends the key in a backend header, never the URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    expect(await gemini(env, "model", "method", { data: 1 })).toEqual({
      ok: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/model:method",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": "test-key",
        },
        body: '{"data":1}',
      }),
    );
  });
  it("reports absent configuration and network timeouts", async () => {
    await expect(
      gemini({ ...env, GEMINI_API_KEY: "" }, "m", "m", {}),
    ).rejects.toMatchObject({ status: 503 });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(gemini(env, "m", "m", {})).rejects.toMatchObject({
      status: 504,
    });
  });
  it.each([429, 500])(
    "maps upstream %s to a safe public failure",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("provider secret", { status })),
      );
      await expect(gemini(env, "m", "m", {})).rejects.toMatchObject({
        status: status === 429 ? 429 : 502,
      });
    },
  );
  it("parses completed structured responses with default and explicit temperatures", async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{}, { text: '{"word":"ocean"}' }] },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const schema = z.object({ word: z.string() });
    expect(await generate(env, "prompt", schema)).toEqual({ word: "ocean" });
    await generate(env, "prompt", schema, 0.9);
    expect(
      JSON.parse(fetcher.mock.calls[0][1].body).generationConfig.temperature,
    ).toBe(0.5);
    expect(
      JSON.parse(fetcher.mock.calls[1][1].body).generationConfig.temperature,
    ).toBe(0.9);
  });
  it.each([{}, { candidates: [{ finishReason: "MAX_TOKENS" }] }])(
    "rejects unfinished or absent candidates",
    async (data) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
      await expect(generate(env, "p", z.string())).rejects.toMatchObject({
        status: 502,
      });
    },
  );
  it.each(["not json", "{}"])(
    "rejects invalid structured content %s",
    async (text) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          Response.json({
            candidates: [
              { finishReason: "STOP", content: { parts: [{ text }] } },
            ],
          }),
        ),
      );
      await expect(
        generate(env, "p", z.object({ word: z.string() })),
      ).rejects.toMatchObject({ status: 502 });
    },
  );
});
describe("HTTP errors and body validation", () => {
  it("uses API status and safe messages for unexpected errors", async () => {
    expect(new ApiError("problem").status).toBe(500);
    expect((await errorResponse(new ApiError("busy", 409)).json()).error).toBe(
      "busy",
    );
    expect(errorResponse(new Error("private failure")).status).toBe(500);
    expect(errorResponse("unknown").status).toBe(500);
  });
  it("formats validation errors, including the empty-issue fallback", async () => {
    expect(errorResponse(new z.ZodError([])).status).toBe(400);
    expect((await errorResponse(new z.ZodError([])).json()).error).toBe(
      "Invalid input.",
    );
    const result = wordSchema.safeParse("");
    if (result.success) throw new Error("Expected invalid input");
    expect((await errorResponse(result.error).json()).error).toContain(
      "Enter a word",
    );
  });
  it("accepts valid JSON and rejects malformed, oversized declared and streamed bodies", async () => {
    expect(
      await jsonBody(
        new Request("https://app", {
          method: "POST",
          body: '{"word":"ocean"}',
        }),
      ),
    ).toEqual({ word: "ocean" });
    await expect(
      jsonBody(new Request("https://app", { method: "POST", body: "oops" })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      jsonBody(
        new Request("https://app", {
          method: "POST",
          headers: { "content-length": "5000" },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      jsonBody(
        new Request("https://app", { method: "POST", body: " ".repeat(4097) }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});
