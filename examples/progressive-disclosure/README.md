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
│   ├── tokenize.ts         # Two clearly-labelled token estimators
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

From `bench/results.md`, run on April 21, 2026 with the included 37-tool synthetic catalog:

| Scenario                                  | Bytes  | Tokens (chars/4) | Tokens (JSON-aware) | Savings vs baseline |
| ----------------------------------------- | -----: | ---------------: | ------------------: | ------------------: |
| Baseline `tools/list` (n=37)              | 20,709 |            5,178 |               7,882 |                   — |
| `tools/catalog` only                        |  9,639 |            2,410 |               3,289 |               53.5% |
| `tools/catalog` + `tools/describe(k=1)`     | 10,796 |            2,699 |               3,714 |               47.9% |
| `tools/catalog` + `tools/describe(k=3)`     | 11,771 |            2,943 |               4,089 |               43.2% |
| `tools/catalog` + `tools/describe(k=5)`     | 12,938 |            3,235 |               4,528 |               37.5% |
| `tools/catalog` + `tools/describe(k=10)`    | 16,654 |            4,164 |               5,928 |               19.6% |
| Steady state (cache hit, catalog only)    |  9,639 |            2,410 |               3,289 |               53.5% |

Token estimates use `Math.ceil(chars / 4)` (conservative GPT-style heuristic) and a JSON-aware estimate (`{}[]:,` count as 1 token each + 3.5 chars/token for the rest, closer to cl100k_base on schema payloads). For canonical SEP numbers, swap in tiktoken or the Anthropic tokenizer; the relative shape of the table holds across tokenizers.

## What this prototype is not

- Not wired into the SDK's `Server` / `Client` request-handler API. That integration is straightforward (look at `packages/server/src/experimental/tasks/server.ts` for the pattern) but is intentionally deferred until the SEP is accepted, per `CONTRIBUTING.md`.
- Not a full implementation of every option in the SEP (no glob filtering from SEP-2564, no scope filtering from SEP-1881, no per-call resolve from SEP-1862). The SEP §6 explains how those compose; this prototype is scoped to the new primitives.
- Not a network reference server. The `demo.ts` runs the server and client in-process via a synchronous `RequestFn`, which is enough to prove the protocol works end-to-end. Wiring stdio or HTTP is mechanical.

## Reproducing the benchmark with a real tokenizer

Replace `bench/tokenize.ts` with a wrapper around the `tiktoken` npm package or any Anthropic-compatible tokenizer, then re-run `npm run bench`. The harness records both byte counts and token counts so the relative comparison is the artifact, not any single absolute number.

## License

MIT, matching the parent SDK's example packages.
