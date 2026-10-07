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

AI definitions and associations are interpretations, not authoritative dictionary entries. Graph placement is a force layout, not a direct projection of embedding coordinates. Every edge uses a target length of `40 + 240 × (1 − cosine similarity)` SVG units, regardless of whether it is an association or embedding-neighbour edge. Nodes, including endpoints, move to approximate these distances. Exact pairwise distances cannot generally be represented in two dimensions. Tooltips show distance and similarity; selecting a word exposes its neighbours sorted by distance.

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

The supplied key must be configured with Wrangler as a Worker secret, never committed. `workers.dev` is enabled. Subsequent updates use `npm run deploy`, which enforces local quality checks, builds, deploys, and runs the production smoke test. Apply new migrations first when present. GitHub Actions runs the same quality checks, then builds the Worker and checks the currently deployed site on pushes and pull requests.

## Request flow and cache

`POST /api/dictionary` accepts `{ "word": "serendipity" }` and returns `{ data, cached }`.

`POST /api/connections` accepts `{ "from": "ocean", "to": "music" }`. Each request completes one uncached path batch or embedding batch and persists it before returning `{ status: "processing", completed, total, stage }`. The browser polls every 6.5 seconds and retries transient model failures up to twice per step, until `{ status: "complete", data, cached }`. A repeat finished search returns immediately without Gemini calls. Requests for the same graph use an expiring D1 lock to prevent duplicate concurrent work. Different word order has a separate graph cache key; capitalization and spacing normalize to the same key.

The cache stores generation model versions and algorithm version (`v1`) in keys. Changing prompts or algorithms should bump the version. Failed or invalid model responses are not saved. A completed step is preserved even if a later step fails. There is a small unavoidable duplicate-call window if the Worker stops after the provider responds but before the result is persisted.

The Worker rate limiter allows 10 uncached requests per minute per IP, including graph steps; cache hits bypass it. This is a per-location Cloudflare limit, not a global spending cap. Monitor Gemini quotas and costs if opening the app to heavy public use.

## Structure and quality gates

- `app/`: thin page composition, document metadata, and API entrypoints.
- `components/explorer/`: mode tabs, search form, loading/empty states, and result composition.
- `components/dictionary/`: dictionary entry presentation.
- `components/connections/`: graph, connection result, and neighbour distances.
- `components/layout/`: shared page frame.
- `hooks/use-explorer.ts`: search state, cancellation, and stale-response protection.
- `lib/`: typed client requests, model/cache helpers, graph construction, distances, and smoke assertions.
- `tests/unit/`: deterministic component, hook, client, API, cache, and graph tests. API tests run the actual migration against in-memory SQLite; Gemini transport is mocked.

`npm run check` requires ESLint with zero warnings, Prettier formatting, strict TypeScript, and Vitest. Coverage thresholds are **100% per executable app file** for lines, statements, branches, and functions, including pages, API routes, components, hooks, and libraries. Only the type-declaration-only `lib/types.ts` is excluded; third-party packages, generated code, CSS, test code, and configuration are outside application coverage. There are no coverage-ignore comments. HTML, JSON, and LCOV reports are written to `coverage/` and uploaded as CI artifacts.

The named **Quality gate** CI check fails unless lint/types/coverage, the Cloudflare production build, and the deployed-site smoke test all pass. `Production smoke` can also be run manually in GitHub Actions. The smoke test checks the published homepage, a JavaScript bundle, favicon, cached dictionary data, the completed 100-path graph with valid edges, and input validation. It sends `cachedOnly: true`, so cache misses return 404 and cannot incur Gemini calls. The existing `serendipity` definition and `ocean` → `music` graph are its durable fixtures; do not delete them without reseeding. It checks the currently published deployment, not an unpublished pull request preview.

```sh
npm run check
npm run test:smoke
SMOKE_BASE_URL=https://your-domain.example npm run test:smoke
```

## Planned domain

`llmdict.io` is a proposed domain, not yet registered or configured. Once owned, add it as a Cloudflare Worker custom domain and set the repository variable `SMOKE_BASE_URL` to `https://llmdict.io`. The app has no hard-coded browser origin, so it can use the custom domain without changing application logic.
