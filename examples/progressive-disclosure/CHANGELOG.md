# Changelog

This changelog tracks meaningful changes to the progressive-disclosure reference prototype. The protocol itself is specified in [`SPEC.md`](./SPEC.md); this file is for the implementation.

## [unreleased]

### Added

- `SPEC.md`: drop-in copy of the SEP draft, so the prototype branch is self-contained for reviewers.
- `INTEGRATION.md`: server-side and client-side adoption recipes for implementers.
- `API.md`: one-page reference of every public export.
- `CHANGELOG.md`: this file.
- `README.md`: documentation map section pointing to the new docs.

## v0.1.2 — 2026-04-21

Renames driven by SEP review feedback. No behavioural changes; the benchmark numbers and 35/35 test pass rate are unchanged.

### Changed

- Method renamed: `tools/index` → `tools/catalog`. The original name is preserved in a docstring on the `METHOD_TOOLS_CATALOG` constant for historical reference and in the SEP's Rationale section.
- Type renamed: `IndexedTool` → `ToolCatalogEntry`.
- Request and result types renamed for consistency: `ListIndexedTools{Request,Result}` → `ListToolsCatalog{Request,Result}`, `listIndexedTools` → `listToolsCatalog`, `toIndexed` → `toCatalogEntry`.
- Error code for unknown / unauthorized tool names changed from `-32602` (Invalid params, a misuse) to `-32002` `RESOURCE_NOT_AVAILABLE` in the JSON-RPC server-defined range. Reasoning: `-32602` describes a malformed request shape, not a missing-or-unauthorized resource. Constant renamed `ERR_UNKNOWN_TOOL_NAMES` → `ERR_RESOURCE_NOT_AVAILABLE`.

### Tests

- Added explicit assertions in `tests/polyfill.test.ts` that the thrown error carries code `-32002` and references the named constant.

### Docs

- `bench/results.md` regenerated with catalog-based labels.
- `README.md` updated to reflect the new naming throughout.

## v0.1.1 — 2026-04-21

### Added

- `bench/sampleTools.ts`: 37-tool synthetic catalog modelled on the MindStaq MCP service. This file was missing from v0.1.0 and prevented `npm run bench` and `npm run demo` from running.

## v0.1.0 — 2026-04-21

Initial reference prototype.

### Added

- `src/types.ts`: wire-format types and the `UnknownToolNamesError` class.
- `src/canonicalJson.ts`: RFC 8785 (JCS) subset, sufficient for stable `Tool` hashing.
- `src/schemaHash.ts`: SHA-256 over canonical JSON of a `Tool`.
- `src/server.ts`: `ProgressiveDisclosureServer` polyfill with configurable `pageSize`, `describeBatchLimit`, `deriveSummary`, `deriveTags`, and `queryMatcher`.
- `src/client.ts`: `listIndexedTools`, `describeTools`, and `ProgressiveDisclosureCache` implementing the recommended hit/miss/reconcile pattern with optional persistence hook.
- `src/demo.ts`: in-process end-to-end lifecycle demo.
- `src/index.ts`: barrel re-export.
- `bench/runBench.ts`, `bench/tokenize.ts`, `bench/results.md`: benchmark with two clearly-labelled token estimators producing the table cited in the SEP §Performance Implications.
- `tests/`: 35 vitest tests across canonical JSON, schema hash, polyfill, and cache. Strict TypeScript clean (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`.
