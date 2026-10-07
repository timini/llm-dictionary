import { act, renderHook } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { useExplorer } from "../../hooks/use-explorer";
import { definition, graph } from "../fixtures";
const api = vi.hoisted(() => ({ define: vi.fn(), connect: vi.fn() }));
vi.mock("../../lib/client", () => ({
  defineWord: api.define,
  connectWords: api.connect,
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  api.define.mockResolvedValue({ data: definition, cached: true });
  api.connect.mockResolvedValue({
    status: "complete",
    data: graph,
    cached: false,
  });
});
it("starts empty, defines a word, and follows synonyms with cache status", async () => {
  const { result } = renderHook(useExplorer);
  expect(result.current.mode).toBe("dictionary");
  expect(result.current.definition).toBeNull();
  act(() => result.current.setWord("sea"));
  expect(result.current.word).toBe("sea");
  await act(() => result.current.define("ocean"));
  expect(result.current).toMatchObject({
    word: "ocean",
    definition,
    cached: true,
    busy: false,
    error: "",
  });
});
it("connects words, exposes progress, and switches modes without losing finished results", async () => {
  api.connect.mockImplementation(async (_a, _b, _signal, progress) => {
    progress("Embedding words");
    return { data: graph, cached: false };
  });
  const { result } = renderHook(useExplorer);
  act(() => {
    result.current.changeMode("connections");
    result.current.setFrom("forest");
    result.current.setTo("memory");
  });
  expect(result.current.from).toBe("forest");
  expect(result.current.to).toBe("memory");
  await act(() => result.current.connect("ocean", "music"));
  expect(result.current).toMatchObject({
    from: "ocean",
    to: "music",
    graph,
    cached: false,
    progress: "Embedding words",
    busy: false,
  });
  act(() => result.current.changeMode("dictionary"));
  expect(result.current.mode).toBe("dictionary");
  expect(result.current.graph).toBe(graph);
});
it.each(["dictionary", "connections"])(
  "shows errors and non-Error fallbacks in %s",
  async (mode) => {
    const method = mode === "dictionary" ? api.define : api.connect;
    const { result } = renderHook(useExplorer);
    method.mockRejectedValueOnce(new Error("quota"));
    await act(() =>
      mode === "dictionary"
        ? result.current.define("ocean")
        : result.current.connect("ocean", "music"),
    );
    expect(result.current.error).toBe("quota");
    expect(result.current.busy).toBe(false);
    method.mockRejectedValueOnce("unknown");
    await act(() =>
      mode === "dictionary"
        ? result.current.define("ocean")
        : result.current.connect("ocean", "music"),
    );
    expect(result.current.error).toBe("Please try again.");
    act(() => result.current.changeMode("connections"));
    expect(result.current.error).toBe("");
  },
);
it.each(["dictionary", "connections"])(
  "stops %s and ignores late success responses",
  async (mode) => {
    const pending = deferred<{
      data: typeof definition | typeof graph;
      cached: boolean;
    }>();
    (mode === "dictionary" ? api.define : api.connect).mockReturnValue(
      pending.promise,
    );
    const { result } = renderHook(useExplorer);
    let work!: Promise<void>;
    act(() => {
      work =
        mode === "dictionary"
          ? result.current.define("ocean")
          : result.current.connect("ocean", "music");
    });
    expect(result.current.busy).toBe(true);
    act(() => result.current.stop());
    expect(result.current.busy).toBe(false);
    await act(async () => {
      pending.resolve({
        data: mode === "dictionary" ? definition : graph,
        cached: true,
      });
      await work;
    });
    expect(result.current.definition).toBeNull();
    expect(result.current.graph).toBeNull();
  },
);
it.each(["dictionary", "connections"])(
  "ignores failures from a cancelled %s request",
  async (mode) => {
    const pending = deferred<never>();
    (mode === "dictionary" ? api.define : api.connect).mockReturnValue(
      pending.promise,
    );
    const { result } = renderHook(useExplorer);
    let work!: Promise<void>;
    act(() => {
      work =
        mode === "dictionary"
          ? result.current.define("a")
          : result.current.connect("a", "b");
    });
    act(() => result.current.stop());
    await act(async () => {
      pending.reject(new Error("aborted"));
      await work;
    });
    expect(result.current.error).toBe("");
  },
);
it("cancels pending requests when a new search starts and when the component unmounts", async () => {
  const pending = deferred<{ data: typeof definition; cached: boolean }>();
  api.define.mockReturnValueOnce(pending.promise);
  const { result, unmount } = renderHook(useExplorer);
  let old!: Promise<void>;
  act(() => {
    old = result.current.define("first");
  });
  const oldSignal = api.define.mock.calls[0][1] as AbortSignal;
  await act(() => result.current.define("second"));
  expect(oldSignal.aborted).toBe(true);
  expect(result.current.word).toBe("second");
  await act(async () => {
    pending.resolve({ data: definition, cached: false });
    await old;
  });
  expect(result.current.cached).toBe(true);
  const latest = api.define.mock.calls[1][1] as AbortSignal;
  unmount();
  expect(latest.aborted).toBe(true);
});
