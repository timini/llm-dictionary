import { beforeEach, it, expect, vi } from "vitest";
import {
  connectWords,
  defineWord,
  pause,
  POLL_INTERVAL,
  MAX_GRAPH_STEPS,
} from "../../lib/client";
import { definition, graph } from "../fixtures";
const complete = { status: "complete", data: graph, cached: true };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
it("posts dictionary input with cancellation and receives typed data", async () => {
  fetcher.mockResolvedValue(Response.json({ data: definition, cached: true }));
  const signal = new AbortController().signal;
  expect(await defineWord("ocean", signal)).toEqual({
    data: definition,
    cached: true,
  });
  expect(fetcher).toHaveBeenCalledWith(
    "/api/dictionary",
    expect.objectContaining({
      method: "POST",
      body: '{"word":"ocean"}',
      signal,
    }),
  );
});
it("handles abort before waiting and while waiting, clearing pending timers", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(pause(controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  const active = new AbortController();
  const waiting = pause(active.signal);
  const check = expect(waiting).rejects.toMatchObject({ name: "AbortError" });
  active.abort();
  await check;
  expect(vi.getTimerCount()).toBe(0);
});
it("resolves a polling wait and removes the abort listener", async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const waiting = pause(controller.signal);
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
  await waiting;
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  controller.abort();
});
it("reports progress until a complete graph is returned", async () => {
  fetcher
    .mockResolvedValueOnce(
      Response.json({ status: "processing", stage: "10 paths" }),
    )
    .mockResolvedValueOnce(Response.json(complete));
  const progress = vi.fn();
  const pending = connectWords(
    "ocean",
    "music",
    new AbortController().signal,
    progress,
  );
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
  expect(await pending).toEqual(complete);
  expect(progress).toHaveBeenCalledWith("10 paths");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("retries 502 and 504 per step before succeeding", async () => {
  fetcher
    .mockResolvedValueOnce(Response.json({ error: "bad" }, { status: 502 }))
    .mockResolvedValueOnce(Response.json({ error: "slow" }, { status: 504 }))
    .mockResolvedValueOnce(Response.json(complete));
  const progress = vi.fn();
  const pending = connectWords(
    "a",
    "b",
    new AbortController().signal,
    progress,
  );
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 2);
  expect(await pending).toEqual(complete);
  expect(progress).toHaveBeenCalledTimes(2);
});
it("limits retries and preserves the final provider error", async () => {
  fetcher.mockImplementation(() =>
    Promise.resolve(Response.json({ error: "bad output" }, { status: 502 })),
  );
  const pending = connectWords("a", "b", new AbortController().signal, vi.fn());
  const check = expect(pending).rejects.toThrow("bad output");
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 2);
  await check;
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("does not retry quota, dictionary failures or transport failures", async () => {
  fetcher.mockResolvedValueOnce(
    Response.json({ error: "quota" }, { status: 429 }),
  );
  await expect(
    connectWords("a", "b", new AbortController().signal, vi.fn()),
  ).rejects.toThrow("quota");
  fetcher.mockResolvedValueOnce(Response.json({}, { status: 502 }));
  await expect(defineWord("a", new AbortController().signal)).rejects.toThrow(
    "Unable to complete this request.",
  );
  fetcher.mockRejectedValueOnce(new Error("network"));
  await expect(
    connectWords("a", "b", new AbortController().signal, vi.fn()),
  ).rejects.toThrow("network");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("bounds endless processing and preserves saved-progress instructions", async () => {
  fetcher.mockImplementation(() =>
    Promise.resolve(Response.json({ status: "processing", stage: "working" })),
  );
  const pending = connectWords("a", "b", new AbortController().signal, vi.fn());
  const check = expect(pending).rejects.toThrow("continue from saved progress");
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL * MAX_GRAPH_STEPS);
  await check;
  expect(fetcher).toHaveBeenCalledTimes(MAX_GRAPH_STEPS);
});
