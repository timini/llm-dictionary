import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

async function main() {
  // Exercise the built Worker, not Next's development server or the old live release.
  const worker = spawn(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", "dev", "--port", "8798"],
    { stdio: "inherit" },
  );
  try {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        response = await fetch("http://localhost:8798/", {
          signal: AbortSignal.timeout(3000),
        });
        break;
      } catch {
        if (worker.exitCode !== null)
          throw new Error("Worker exited before becoming ready");
        await setTimeout(500);
      }
    }
    if (!response?.ok)
      throw new Error(
        `Built Worker homepage returned ${response?.status ?? "no response"}`,
      );
    const html = await response.text();
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
      (match) => match[1],
    );
    if (!scripts.length)
      throw new Error("Built Worker served no JavaScript assets");
    let analyticsFound = false;
    for (const script of scripts) {
      const asset = await fetch(new URL(script, "http://localhost:8798"));
      if (!asset.ok)
        throw new Error(
          `Built Worker asset returned ${asset.status}: ${script}`,
        );
      analyticsFound ||= (await asset.text()).includes("G-KYD611CMTW");
    }
    if (!analyticsFound)
      throw new Error("Built Worker is missing the configured GA stream");
    console.log("Built Worker homepage, JavaScript assets and GA ID verified.");
  } finally {
    worker.kill("SIGTERM");
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
