// @vitest-environment node
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { testEnvironment } from "../database";
import { definition, graph } from "../fixtures";
import { save, acquire, read } from "../../lib/server";
import {
  POST as dictionaryPOST,
  dynamic as dictionaryDynamic,
} from "../../app/api/dictionary/route";
import {
  POST as connectionsPOST,
  dynamic as connectionsDynamic,
} from "../../app/api/connections/route";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  generate: vi.fn(),
  gemini: vi.fn(),
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.context,
}));
vi.mock("../../lib/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/server")>()),
  generate: mocks.generate,
  gemini: mocks.gemini,
}));
let db: ReturnType<typeof testEnvironment>;
const graphKey = 'graph:v1:gen:embed:["ocean","music"]';
const definitionKey = "definition:v1:gen:ocean";
const request = (data: unknown) =>
  new Request("https://app", { method: "POST", body: JSON.stringify(data) });
const paths = Array.from({ length: 10 }, () => ["ocean", "wave", "music"]);
const vector = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
async function seedPaths(vary = false) {
  for (let i = 0; i < 10; i++)
    await save(
      db.env,
      `${graphKey}:paths:${i}`,
      "paths",
      vary
        ? Array.from({ length: 10 }, (_, j) => [
            "ocean",
            `word ${i} ${j}`,
            "music",
          ])
        : paths,
    );
}
async function seedVectors(words = ["ocean", "wave", "music"]) {
  for (const word of words)
    await save(db.env, `embedding:v1:embed:768:${word}`, "embedding", vector);
}
beforeEach(() => {
  db = testEnvironment();
  mocks.context.mockResolvedValue({ env: db.env });
  mocks.generate.mockResolvedValue({ paths });
  mocks.gemini.mockResolvedValue({
    embeddings: paths[0].map(() => ({ values: vector })),
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => db.sqlite.close());
describe("dictionary route with durable SQLite cache", () => {
  it("is dynamic and returns a cached normalized entry without model calls", async () => {
    expect(dictionaryDynamic).toBe("force-dynamic");
    await save(db.env, definitionKey, "definition", definition);
    const response = await dictionaryPOST(request({ word: " OCEAN " }));
    expect(await response.json()).toEqual({ data: definition, cached: true });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("generates, persists and then reuses an entry", async () => {
    mocks.generate.mockResolvedValue(definition);
    expect(
      await (await dictionaryPOST(request({ word: "ocean" }))).json(),
    ).toEqual({ data: definition, cached: false });
    expect(await read(db.env, definitionKey)).toEqual(definition);
    expect(
      await (await dictionaryPOST(request({ word: "ocean" }))).json(),
    ).toEqual({ data: definition, cached: true });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(
      db.sqlite.prepare("SELECT COUNT(*) AS count FROM locks").get()?.count,
    ).toBe(0);
  });
  it("returns conflict for an active generation lock", async () => {
    await acquire(db.env, definitionKey);
    expect((await dictionaryPOST(request({ word: "ocean" }))).status).toBe(409);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects invalid words and releases locks when provider calls fail", async () => {
    expect((await dictionaryPOST(request({ word: "" }))).status).toBe(400);
    mocks.generate.mockRejectedValue(new Error("provider failed"));
    expect((await dictionaryPOST(request({ word: "ocean" }))).status).toBe(500);
    expect(await read(db.env, definitionKey)).toBeNull();
    expect(
      db.sqlite.prepare("SELECT COUNT(*) AS count FROM locks").get()?.count,
    ).toBe(0);
  });
});
describe("incremental graph route", () => {
  it("is dynamic, validates distinct words and bypasses models for a finished graph", async () => {
    expect(connectionsDynamic).toBe("force-dynamic");
    expect(
      (await connectionsPOST(request({ from: "same", to: "SAME" }))).status,
    ).toBe(400);
    await save(db.env, graphKey, "graph", graph);
    expect(
      await (
        await connectionsPOST(request({ from: "ocean", to: "music" }))
      ).json(),
    ).toEqual({ status: "complete", data: graph, cached: true });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("reports an active graph lock without duplicate generation", async () => {
    await acquire(db.env, graphKey);
    expect(
      await (
        await connectionsPOST(request({ from: "ocean", to: "music" }))
      ).json(),
    ).toMatchObject({ status: "processing", completed: 0 });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("persists exactly one batch per request and resumes existing paths", async () => {
    const first = await connectionsPOST(
      request({ from: "ocean", to: "music" }),
    );
    expect(await first.json()).toMatchObject({
      completed: 1,
      stage: "Generated 10 of 100 association paths",
    });
    expect(await read(db.env, `${graphKey}:paths:0`)).toEqual(paths);
    const second = await connectionsPOST(
      request({ from: "ocean", to: "music" }),
    );
    expect(await second.json()).toMatchObject({ completed: 2 });
    expect(mocks.generate.mock.calls[1][1]).toContain(
      'Avoid these previous paths: [["ocean","wave","music"]',
    );
    expect(
      db.sqlite.prepare("SELECT COUNT(*) AS count FROM locks").get()?.count,
    ).toBe(0);
  });
  it.each([
    ["wrong", "wave", "music"],
    ["ocean", "wave", "wrong"],
    ["ocean", "wave", "wave", "music"],
  ])("rejects invalid endpoints and repeated words: %j", async (...path) => {
    mocks.generate.mockResolvedValue({ paths: [path] });
    const response = await connectionsPOST(
      request({ from: "ocean", to: "music" }),
    );
    expect(response.status).toBe(502);
    expect(await read(db.env, `${graphKey}:paths:0`)).toBeNull();
    expect(
      db.sqlite.prepare("SELECT COUNT(*) AS count FROM locks").get()?.count,
    ).toBe(0);
  });
  it("embeds only missing words and saves each complete embedding batch", async () => {
    await seedPaths();
    await seedVectors(["ocean"]);
    mocks.gemini.mockResolvedValue({
      embeddings: [{ values: vector }, { values: vector }],
    });
    expect(
      await (
        await connectionsPOST(request({ from: "ocean", to: "music" }))
      ).json(),
    ).toMatchObject({
      status: "processing",
      stage: "Embedded 3 of 3 unique words",
    });
    expect(
      mocks.gemini.mock.calls[0][3].requests.map(
        (r: { content: { parts: { text: string }[] } }) =>
          r.content.parts[0].text,
      ),
    ).toEqual(["wave", "music"]);
    expect(await read(db.env, "embedding:v1:embed:768:wave")).toEqual(vector);
  });
  it("reads over 80 words in chunks and caps each embedding batch at 40", async () => {
    await seedPaths(true);
    mocks.gemini.mockResolvedValue({
      embeddings: Array.from({ length: 40 }, () => ({ values: vector })),
    });
    expect(
      await (
        await connectionsPOST(request({ from: "ocean", to: "music" }))
      ).json(),
    ).toMatchObject({ stage: "Embedded 40 of 102 unique words" });
    expect(mocks.gemini.mock.calls[0][3].requests).toHaveLength(40);
  });
  it("builds and durably reuses the final 100-path graph", async () => {
    await seedPaths();
    await seedVectors();
    const result = await (
      await connectionsPOST(request({ from: "ocean", to: "music" }))
    ).json();
    expect(result).toMatchObject({
      status: "complete",
      cached: false,
      data: { pathCount: 100 },
    });
    expect(result.data.nodes).toHaveLength(3);
    expect(
      result.data.links.every(
        (l: { similarity: number }) => l.similarity === 1,
      ),
    ).toBe(true);
    expect(mocks.gemini).not.toHaveBeenCalled();
    const cached = await (
      await connectionsPOST(request({ from: "ocean", to: "music" }))
    ).json();
    expect(cached.cached).toBe(true);
    expect(cached.data).toEqual(result.data);
  });
  it("releases graph locks on embedding failure without saving incomplete vectors", async () => {
    await seedPaths();
    mocks.gemini.mockRejectedValue(new Error("network"));
    expect(
      (await connectionsPOST(request({ from: "ocean", to: "music" }))).status,
    ).toBe(500);
    expect(await read(db.env, "embedding:v1:embed:768:ocean")).toBeNull();
    expect(
      db.sqlite.prepare("SELECT COUNT(*) AS count FROM locks").get()?.count,
    ).toBe(0);
  });
});

it("cache-only smoke requests never call providers for missing results", async () => {
  expect(
    (await dictionaryPOST(request({ word: "ocean", cachedOnly: true }))).status,
  ).toBe(404);
  expect(
    (
      await connectionsPOST(
        request({ from: "ocean", to: "music", cachedOnly: true }),
      )
    ).status,
  ).toBe(404);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.gemini).not.toHaveBeenCalled();
});

it("rejects malformed embedding batches without caching partial vectors", async () => {
  await seedPaths();
  mocks.gemini.mockResolvedValue({ embeddings: [{ values: [1] }] });
  expect(
    (await connectionsPOST(request({ from: "ocean", to: "music" }))).status,
  ).toBe(502);
  expect(await read(db.env, "embedding:v1:embed:768:ocean")).toBeNull();
});
