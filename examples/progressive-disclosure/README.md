# Progressive Tool Disclosure — Reference Prototype

This is the reference prototype accompanying **SEP-XXXX: Progressive Tool Disclosure** (link added once the SEP PR is opened against `modelcontextprotocol/modelcontextprotocol`).

It is intentionally a self-contained workspace package rather than a modification of the SDK's internal types. The MCP `CONTRIBUTING.md` is explicit that spec-touching changes require a SEP first; the goal of this prototype is to demonstrate the API surface and produce reproducible token-cost numbers, not to merge into the SDK before the SEP is accepted.

## Documentation map

| Doc | What it's for | Read it if |
|---|---|---|
| **README.md** *(this file)* | Orientation, layout, run instructions, latest benchmark numbers | You're new here |
| [**SPEC.md**](./SPEC.md) | The protocol specification — full SEP draft including motivation, wire format, security implications, and rationale | You're reviewing the protocol |
| [**INTEGRATION.md**](./INTEGRATION.md) | Step-by-step server-side and client-side integration recipes for adopters | You're putting this into a real MCP server or client |
| [**API.md**](./API.md) | One-page reference of every public export from `src/` | You want to skim the API surface without opening source |
| [**CHANGELOG.md**](./CHANGELOG.md) | Version history and rationale for each substantive change | You want to know how the prototype evolved |
| [**bench/results.md**](./bench/results.md) | Captured benchmark output, paste-ready for the SEP | You want the numbers in markdown form |

## What this prototype demonstrates

1. **`tools/catalog`** — a lightweight catalog payload (`ToolCatalogEntry`: name, summary, tags, schemaHash, and minimal annotations) that an LLM can use to decide which tools are candidates for the current turn.
2. **`tools/describe`** — fetches the full `Tool` (with `inputSchema`, `outputSchema`, full annotations) for an explicitly-named subset, in a single batched round trip.
3. **`schemaHash`** — a stable, canonicalized SHA-256 hash that lets clients cache full schemas and skip refetches when the underlying `Tool` is unchanged.
4. **The polyfill** — a `ProgressiveDisclosureServer` that derives `tools/catalog` and `tools/describe` from any existing tool catalog, with sensible defaults for summary derivation and substring-based query matching.
5. **The cache** — `ProgressiveDisclosureCache` implements the lookup pattern referenced in SPEC §5: cache hits avoid the network entirely; cache misses are batched into a single `tools/describe`; `reconcile()` invalidates entries whose `schemaHash` no longer appears.
6. **Real numbers** — a benchmark over a 37-tool catalog modelled on the MindStaq MCP service, producing the table cited in the SEP §Performance section.

## Layout

```
examples/progressive-disclosure/
├── src/
│   ├── types.ts            # Wire-format types (ToolCatalogEntry, requests, capability)
│   ├── canonicalJson.ts    # RFC 8785 subset for hashing
│   ├── schemaHash.ts       # SHA-256 over canonical Tool JSON
│   ├── server.ts           # ProgressiveDisclosureServer polyfill
│   ├── client.ts           # listToolsCatalog, describeTools, ProgressiveDisclosureCache
│   ├── demo.ts             # In-process end-to-end demo
│   └── index.ts            # Public re-exports
├── bench/
│   ├── sampleTools.ts      # 37 synthetic MindStaq-shaped tools
│   ├── tokenize.ts         # cl100k_base tiktoken (primary) + 2 legacy heuristics
│   ├── runBench.ts         # The benchmark
│   └── results.md          # Captured benchmark output
├── tests/
│   ├── canonicalJson.test.ts
│   ├── schemaHash.test.ts
│   ├── polyfill.test.ts
│   └── cache.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Running

```bash
cd examples/progressive-disclosure
npm install
npm run typecheck   # strict TypeScript pass
npm test            # 35 vitest tests
npm run bench       # produces bench/results.md
npm run demo        # in-process end-to-end lifecycle
```

## Latest benchmark numbers

From `bench/results.md`, run on April 21, 2026 with the included 37-tool synthetic catalog. Tokens measured with `cl100k_base` via `js-tiktoken`.

| Scenario                                   | Bytes  | Tokens (cl100k_base) | Savings vs baseline |
| ------------------------------------------ | -----: | -------------------: | ------------------: |
| Baseline `tools/list` (n=37)               | 20,709 |                5,238 |                   — |
| `tools/catalog` only                       |  9,639 |                2,919 |               44.3% |
| `tools/catalog` + `tools/describe(k=1)`    | 10,796 |                3,223 |               38.5% |
| `tools/catalog` + `tools/describe(k=3)`    | 11,771 |                3,458 |               34.0% |
| `tools/catalog` + `tools/describe(k=5)`    | 12,938 |                3,767 |               28.1% |
| `tools/catalog` + `tools/describe(k=10)`   | 16,654 |                4,732 |                9.7% |
| Steady state (cache hit, catalog only)     |  9,639 |                2,919 |               44.3% |

`cl100k_base` is the encoding used by GPT-3.5-turbo, GPT-4, and GPT-4o, and is a defensible proxy for Anthropic's tokenizer on schema-heavy JSON payloads. Reproduce these exact numbers with `npm install && npm run bench`.

## What this prototype is not

- Not wired into the SDK's `Server` / `Client` request-handler API. That integration is straightforward (look at `packages/server/src/experimental/tasks/server.ts` for the pattern) but is intentionally deferred until the SEP is accepted, per `CONTRIBUTING.md`.
- Not a full implementation of every option in the SEP (no glob filtering from SEP-2564, no scope filtering from SEP-1881, no per-call resolve from SEP-1862). The SEP §6 explains how those compose; this prototype is scoped to the new primitives.
- Not a network reference server. The `demo.ts` runs the server and client in-process via a synchronous `RequestFn`, which is enough to prove the protocol works end-to-end. Wiring stdio or HTTP is mechanical.

## Tokenizer choice

The benchmark uses `cl100k_base` via [`js-tiktoken`](https://www.npmjs.com/package/js-tiktoken) — the encoding used by GPT-3.5-turbo, GPT-4, and GPT-4o, and a defensible proxy for Anthropic's tokenizer on JSON-shaped payloads.

To re-run with a different tokenizer (e.g., the Anthropic SDK's tokenizer or `o200k_base` for GPT-4o-specific exactness), edit `bench/tokenize.ts` — `countTokensTiktoken` is the only function `runBench.ts` calls for SEP-published numbers; the two heuristic estimators alongside it are retained only as sanity-check references.

## License

MIT, matching the parent SDK's example packages.
