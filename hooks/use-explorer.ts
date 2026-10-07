"use client";
import { useEffect, useRef, useState } from "react";
import { connectWords, defineWord } from "../lib/client";
import type { Definition, Mode, WordGraph } from "../lib/types";
export function useExplorer() {
  const [mode, setMode] = useState<Mode>("dictionary");
  const [word, setWord] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [graph, setGraph] = useState<WordGraph | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [cached, setCached] = useState(false);
  const controller = useRef(new AbortController());
  useEffect(() => () => controller.current.abort(), []);
  function start(message: string) {
    controller.current.abort();
    const next = new AbortController();
    controller.current = next;
    setBusy(true);
    setError("");
    setProgress(message);
    return next.signal;
  }
  function fail(reason: unknown, signal: AbortSignal) {
    if (!signal.aborted)
      setError(reason instanceof Error ? reason.message : "Please try again.");
  }
  async function define(value: string) {
    setMode("dictionary");
    setWord(value);
    setDefinition(null);
    const signal = start("Finding the meaning…");
    try {
      const result = await defineWord(value, signal);
      if (signal.aborted) return;
      setDefinition(result.data);
      setCached(result.cached);
    } catch (reason) {
      fail(reason, signal);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }
  async function connect(a: string, b: string) {
    setFrom(a);
    setTo(b);
    setGraph(null);
    const signal = start("Starting the first association paths…");
    try {
      const result = await connectWords(a, b, signal, setProgress);
      if (signal.aborted) return;
      setGraph(result.data);
      setCached(result.cached);
    } catch (reason) {
      fail(reason, signal);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }
  function stop() {
    controller.current.abort();
    setBusy(false);
  }
  function changeMode(value: Mode) {
    stop();
    setError("");
    setMode(value);
  }
  return {
    mode,
    word,
    from,
    to,
    definition,
    graph,
    busy,
    progress,
    error,
    cached,
    setWord,
    setFrom,
    setTo,
    define,
    connect,
    stop,
    changeMode,
  };
}
