import { smokeTest } from "../lib/smoke";
const url =
  process.env.SMOKE_BASE_URL || "https://llm-dictionary.tim-5f9.workers.dev";
smokeTest(url)
  .then((checks) => {
    for (const check of checks) console.log(`PASS ${check}`);
    console.log(`Smoke test passed against ${url}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
