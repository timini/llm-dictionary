import { z } from "zod";
const dictionaryResult = z.object({
  cached: z.literal(true),
  data: z.object({
    word: z.literal("serendipity"),
    senses: z.array(z.object({ definition: z.string().min(1) })).min(1),
  }),
});
const graphResult = z.object({
  status: z.literal("complete"),
  cached: z.literal(true),
  data: z.object({
    from: z.literal("ocean"),
    to: z.literal("music"),
    pathCount: z.literal(100),
    nodes: z.array(z.object({ id: z.string() })).min(3),
    links: z
      .array(
        z.object({
          source: z.string(),
          target: z.string(),
          similarity: z.number().min(-1).max(1),
        }),
      )
      .min(2),
  }),
});
export async function smokeTest(
  baseURL: string,
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  const origin = new URL(baseURL);
  if (!["https:", "http:"].includes(origin.protocol))
    throw new Error("Smoke URL must use HTTP or HTTPS.");
  async function request(path: string, body?: unknown) {
    const response = await fetcher(new URL(path, origin), {
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        `Smoke request ${path} returned HTTP ${response.status}.`,
      );
    return response;
  }
  const homepage = await request("/");
  const html = await homepage.text();
  if (
    !html.includes("LLM Dictionary") ||
    !html.includes("Word connections") ||
    !html.includes("Word to define")
  )
    throw new Error("Homepage is missing the application UI.");
  const script = html.match(
    /src="([^"\s]+\/_next\/static\/[^"\s]+\.js|\/_next\/static\/[^"\s]+\.js)"/,
  );
  if (!script) throw new Error("Homepage is missing its JavaScript bundle.");
  const bundle = await request(script[1]);
  if (!(await bundle.text()).length)
    throw new Error("JavaScript bundle is empty.");
  const favicon = await request("/favicon.svg");
  if (!(await favicon.text()).includes("<svg"))
    throw new Error("Favicon is invalid.");
  dictionaryResult.parse(
    await (
      await request("/api/dictionary", {
        word: "serendipity",
        cachedOnly: true,
      })
    ).json(),
  );
  const result = graphResult.parse(
    await (
      await request("/api/connections", {
        from: "ocean",
        to: "music",
        cachedOnly: true,
      })
    ).json(),
  );
  const words = new Set(result.data.nodes.map((node) => node.id));
  if (
    result.data.links.some(
      (link) => !words.has(link.source) || !words.has(link.target),
    )
  )
    throw new Error("Graph edges reference missing words.");
  const invalid = await fetcher(new URL("/api/dictionary", origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"word":""}',
    signal: AbortSignal.timeout(15000),
  });
  if (invalid.status !== 400)
    throw new Error("Invalid dictionary input was not rejected.");
  return [
    "Homepage and JavaScript bundle",
    "Favicon",
    "Cached dictionary and D1 access",
    "Cached 100-path graph and valid edges",
    "Input validation",
  ];
}
