# LLM Dictionary

[Open the live app](https://llm-dictionary.tim-5f9.workers.dev)

A Next.js app for looking up words and exploring the associations between any two words. Runs on Cloudflare Workers with OpenNext and stores completed results in Cloudflare D1.

## Features

- Dictionary entries: senses, pronunciation, examples, origin, and related words.
- Connections: 10 independent generation calls, each requesting 10 paths (100 sampled paths). Paths may overlap across batches.
- Gemini embeddings for every unique word; cosine similarity connects each word to its three nearest neighbours within the generated vocabulary.
- Interactive D3 force graph: zoom, drag, select neighbours, inspect edge similarity, and open definitions.
- Durable cache for definitions, every completed path batch, individual embeddings, and finished graphs. Interrupted searches resume completed steps.
- Server-side API key, input validation, generation locks, and rate limits.

## Models

Defaults are `gemini-2.5-flash-lite` for generation and `gemini-embedding-2` with 768 dimensions for embeddings. Google exposes generation and embedding through separate models under the same API key. Change model names in `wrangler.jsonc`; model versions are included in cache keys.

[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) lists Flash-Lite at $0.10 per million input tokens and $0.40 per million output tokens, and Embedding 2 text at $0.20 per million input tokens (checked October 7, 2026). Free tiers have quotas. D1 usage is billed separately by Cloudflare; no automatic cache expiry is configured.

AI definitions and associations are interpretations, not authoritative dictionary entries. Graph placement is a force layout, not a direct projection of embedding coordinates. Cosine similarities are shown in edge tooltips.

## Local development

Use Node.js 22 LTS or newer.

```sh
npm ci
cp .env.example .dev.vars
# Edit .dev.vars and set GEMINI_API_KEY.
npm run db:local
npm run dev
```

Open http://localhost:3000. Local development uses an actual SQLite-backed D1 emulator and real Gemini calls. `.dev.vars` and build outputs are ignored by Git. Never prefix the key with `NEXT_PUBLIC_`.

```sh
npm test
npm run typecheck
npm run build:worker
npm run preview
```

## Cloudflare deployment

```sh
npx wrangler login
npx wrangler d1 create llm-dictionary
# Put the returned database_id in wrangler.jsonc.
npm run db:remote
npx wrangler secret put GEMINI_API_KEY
npm run build:worker
npm run deploy
```

The supplied key must be configured with Wrangler as a Worker secret, never committed. `workers.dev` is enabled. Subsequent updates require `npm run build:worker` and `npm run deploy`; apply new migrations first when present. GitHub Actions checks tests and the Worker build on pushes.

## Request flow and cache

`POST /api/dictionary` accepts `{ "word": "serendipity" }` and returns `{ data, cached }`.

`POST /api/connections` accepts `{ "from": "ocean", "to": "music" }`. Each request completes one uncached path batch or embedding batch and persists it before returning `{ status: "processing", completed, total, stage }`. The browser polls every 6.5 seconds and retries transient model failures up to twice per step, until `{ status: "complete", data, cached }`. A repeat finished search returns immediately without Gemini calls. Requests for the same graph use an expiring D1 lock to prevent duplicate concurrent work. Different word order has a separate graph cache key; capitalization and spacing normalize to the same key.

The cache stores generation model versions and algorithm version (`v1`) in keys. Changing prompts or algorithms should bump the version. Failed or invalid model responses are not saved. A completed step is preserved even if a later step fails. There is a small unavoidable duplicate-call window if the Worker stops after the provider responds but before the result is persisted.

The Worker rate limiter allows 10 uncached requests per minute per IP, including graph steps; cache hits bypass it. This is a per-location Cloudflare limit, not a global spending cap. Monitor Gemini quotas and costs if opening the app to heavy public use.
