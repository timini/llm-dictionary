// @vitest-environment node
import { it, expect, vi } from "vitest";
import { smokeTest } from "../../lib/smoke";
import { definition, graph } from "../fixtures";
function transport(overrides: Record<string, () => Response> = {}) {
  return vi.fn<
    (input: string | URL | Request, options?: RequestInit) => Promise<Response>
  >(async (input) => {
    const path = new URL(String(input)).pathname;
    const responses: Record<string, () => Response> = {
      "/": () =>
        new Response(
          'LLM Dictionary Word connections Word to define <script src="/_next/static/app.js"></script>',
        ),
      "/_next/static/app.js": () => new Response('console.log("ready")'),
      "/favicon.svg": () => new Response("<svg></svg>"),
      "/api/dictionary": () =>
        Response.json({
          cached: true,
          data: { ...definition, word: "serendipity" },
        }),
      "/api/connections": () =>
        Response.json({
          cached: true,
          status: "complete",
          data: { ...graph, pathCount: 100 },
        }),
      ...overrides,
    };
    return responses[path]();
  });
}
function validFetcher() {
  const fetcher = transport();
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (input, options?: RequestInit) => {
    if (options?.body === '{"word":""}')
      return new Response("", { status: 400 });
    return original(input);
  });
  return fetcher;
}
it("checks real resource paths and cache-only API contracts without new LLM calls", async () => {
  const fetcher = validFetcher();
  const checks = await smokeTest(
    "https://example.com",
    fetcher as typeof fetch,
  );
  expect(checks).toHaveLength(5);
  expect(fetcher).toHaveBeenCalledTimes(6);
  expect(
    JSON.parse((fetcher.mock.calls[3][1] as RequestInit).body as string),
  ).toEqual({ word: "serendipity", cachedOnly: true });
});
it("supports the default global transport", async () => {
  vi.stubGlobal("fetch", validFetcher());
  expect(await smokeTest("http://localhost")).toHaveLength(5);
});
it("rejects unsupported URLs", async () => {
  await expect(smokeTest("file:///tmp/app")).rejects.toThrow("HTTP or HTTPS");
});
it.each([
  ["/", () => new Response("bad", { status: 503 }), "HTTP 503"],
  ["/", () => new Response("not app"), "missing the application UI"],
  [
    "/",
    () => new Response("LLM Dictionary Word connections Word to define"),
    "missing its JavaScript",
  ],
  ["/_next/static/app.js", () => new Response(""), "bundle is empty"],
  ["/favicon.svg", () => new Response("bad"), "Favicon is invalid"],
  ["/api/dictionary", () => Response.json({ cached: false }), "Invalid"],
  [
    "/api/connections",
    () =>
      Response.json({
        cached: true,
        status: "complete",
        data: {
          ...graph,
          pathCount: 100,
          links: [
            { source: "missing", target: "wave", similarity: 1 },
            { source: "ocean", target: "wave", similarity: 0.9 },
          ],
        },
      }),
    "missing words",
  ],
] as const)(
  "fails the gate for broken deployed resource %s",
  async (path, response, message) => {
    await expect(
      smokeTest(
        "https://example.com",
        transport({ [path]: response }) as typeof fetch,
      ),
    ).rejects.toThrow(message);
  },
);
it("rejects incorrect input-validation status", async () => {
  await expect(
    smokeTest("https://example.com", transport() as typeof fetch),
  ).rejects.toThrow("not rejected");
});
