import type { Definition, JobResponse } from "./types";
export const POLL_INTERVAL = 6500;
export const MAX_GRAPH_STEPS = 100;
export function pause(signal: AbortSignal): Promise<void> {
  if (signal.aborted)
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, POLL_INTERVAL);
    signal.addEventListener("abort", abort, { once: true });
  });
}
async function post<T>(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new RequestError(
      data.error || "Unable to complete this request.",
      response.status,
    );
  return data as T;
}
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function defineWord(word: string, signal: AbortSignal) {
  return post<{ data: Definition; cached: boolean }>(
    "/api/dictionary",
    { word },
    signal,
  );
}
export async function connectWords(
  from: string,
  to: string,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<Extract<JobResponse, { status: "complete" }>> {
  for (let step = 0; step < MAX_GRAPH_STEPS; step++) {
    let result: JobResponse;
    let retries = 0;
    for (;;) {
      try {
        result = await post<JobResponse>(
          "/api/connections",
          { from, to },
          signal,
        );
        break;
      } catch (error) {
        if (
          !(error instanceof RequestError) ||
          ![502, 504].includes(error.status) ||
          retries >= 2
        )
          throw error;
        retries++;
        onProgress("Retrying this step; completed paths are saved…");
        await pause(signal);
      }
    }
    if (result.status === "complete") return result;
    onProgress(result.stage);
    await pause(signal);
  }
  throw new Error(
    "This graph is taking longer than expected. Try again to continue from saved progress.",
  );
}
