# API Reference

Every public export from `examples/progressive-disclosure/src/`. For full JSDoc, hover the symbol in your IDE or open the linked source file. For protocol-level semantics, see [`SPEC.md`](./SPEC.md).

## Module: [`types.ts`](./src/types.ts)

### Method names

| Export | Type | Description |
|---|---|---|
| `METHOD_TOOLS_CATALOG` | `'tools/catalog'` | JSON-RPC method name for the lightweight catalog endpoint. |
| `METHOD_TOOLS_DESCRIBE` | `'tools/describe'` | JSON-RPC method name for the batched full-schema endpoint. |
| `CAPABILITY_KEY` | `'progressiveDisclosure'` | Capability key under `serverCapabilities.tools`. |

### Wire types

| Export | Kind | Description |
|---|---|---|
| `Tool` | interface | The full tool record with `inputSchema`, `outputSchema`, etc. (Mirrors the SDK's existing `Tool`.) |
| `ToolAnnotations` | interface | Optional advisory hints (`readOnlyHint`, `destructiveHint`, etc.). |
| `JsonSchema` | interface | Minimal JSON Schema subset used by `Tool.inputSchema` and `Tool.outputSchema`. |
| `ToolCatalogEntry` | interface | The compact catalog record: `name`, `summary`, `tags`, `schemaHash`, optional `annotations`. |
| `ProgressiveDisclosureCapability` | interface | The capability declaration object. |

### Request / response shapes

| Export | Kind | Description |
|---|---|---|
| `ListToolsCatalogRequestParams` | interface | Optional `cursor` (pagination) and `query` (opaque search). |
| `ListToolsCatalogResult` | interface | `tools: ToolCatalogEntry[]` plus optional `nextCursor`. |
| `DescribeToolsRequestParams` | interface | `names: string[]` — one or more tool names to fetch in a single batch. |
| `DescribeToolsResult` | interface | `tools: Tool[]` in the same order as the request. |

### Errors

| Export | Kind | Description |
|---|---|---|
| `ERR_RESOURCE_NOT_AVAILABLE` | `-32002` | JSON-RPC error code for unknown / unauthorized tool names in `tools/describe`. |
| `UnknownToolNamesError` | class | Thrown by the polyfill when `tools/describe` references unknown names; carries `code: -32002` and `data: { unknownNames: string[] }`. |

## Module: [`canonicalJson.ts`](./src/canonicalJson.ts)

| Export | Signature | Description |
|---|---|---|
| `canonicalize` | `(value: unknown) => string` | Serialize any JSON-compatible value to RFC 8785 (JCS) canonical form: sorted keys, no whitespace, deterministic numbers and string escaping. Used by `computeSchemaHash`; safe to use directly. |

## Module: [`schemaHash.ts`](./src/schemaHash.ts)

| Export | Signature | Description |
|---|---|---|
| `computeSchemaHash` | `(tool: Tool) => string` | Lowercase hex SHA-256 of the canonical JSON serialization of a `Tool`. Stable across encode/decode round trips and key reordering. |

## Module: [`server.ts`](./src/server.ts)

| Export | Kind | Description |
|---|---|---|
| `ProgressiveDisclosureServer` | class | Polyfill that derives `tools/catalog` and `tools/describe` from any `Tool[]` catalog. |
| `ProgressiveDisclosureServerOptions` | interface | Config: `pageSize`, `describeBatchLimit`, `deriveSummary`, `deriveTags`, `queryMatcher`. All optional with sensible defaults. |
| `QueryMatcher` | type | `(tool: Tool, query: string) => boolean` — predicate used when `query` is present on `tools/catalog`. Default is case-insensitive substring across name, title, description, and tags. |

### `ProgressiveDisclosureServer` methods

| Method | Returns | Description |
|---|---|---|
| `new ProgressiveDisclosureServer(catalog, options?)` | — | `catalog` may be `Tool[]` (captured by reference) or `() => Tool[]` (re-evaluated on every call). |
| `toCatalogEntry(tool)` | `ToolCatalogEntry` | Convert a single `Tool` to its compact form. Useful when wiring into a custom handler. |
| `listToolsCatalog(params?)` | `ListToolsCatalogResult` | Implement `tools/catalog`. Supports `cursor`, `query`. |
| `describeTools(params)` | `DescribeToolsResult` | Implement `tools/describe`. Throws `UnknownToolNamesError` for missing names; throws `RangeError` on oversized batches; throws `TypeError` on empty `names`. |

## Module: [`client.ts`](./src/client.ts)

### Top-level helpers

| Export | Signature | Description |
|---|---|---|
| `RequestFn` | `<T>(method: string, params?: unknown) => Promise<T>` | Transport-agnostic JSON-RPC roundtrip. Wrap your existing `Client.request(...)`. |
| `listToolsCatalog` | `(request: RequestFn, params?) => Promise<ListToolsCatalogResult>` | Convenience wrapper around the `tools/catalog` request. |
| `describeTools` | `(request: RequestFn, params) => Promise<DescribeToolsResult>` | Convenience wrapper around the `tools/describe` request. |

### `ProgressiveDisclosureCache`

| Export | Kind | Description |
|---|---|---|
| `ProgressiveDisclosureCache` | class | In-memory schema cache keyed by `(serverIdentity, name, schemaHash)`. Implements the recommended hit/miss/reconcile pattern from SPEC §5. |
| `ProgressiveDisclosureCacheOptions` | interface | `serverIdentity` (required), optional `persistence`. |
| `CachePersistence` | interface | Hooks for cross-session caching: `load(identity)` and `save(identity, entries)`. Optional. |

#### Cache methods

| Method | Returns | Description |
|---|---|---|
| `new ProgressiveDisclosureCache(options)` | — | Construct one cache per server connection. |
| `materialize(catalogEntries, request)` | `Promise<Tool[]>` | Resolve full `Tool` records for the given catalog entries. Cache hits avoid the network; misses trigger a single batched `tools/describe`. Returns `Tool[]` in the same order as the input. |
| `reconcile(freshCatalog)` | `{ evicted: number }` | After `notifications/tools/list_changed` and a fresh `tools/catalog`, evict cache entries whose `schemaHash` no longer appears. |
| `_size()` | `number` | Visible for testing. Number of cached entries. |

## Module: [`index.ts`](./src/index.ts)

Re-exports every public symbol from the modules above. Importing from this barrel is the recommended entry point.

```typescript
import {
  // protocol primitives
  METHOD_TOOLS_CATALOG, METHOD_TOOLS_DESCRIBE, CAPABILITY_KEY,
  // wire types
  Tool, ToolCatalogEntry, ListToolsCatalogResult, DescribeToolsResult,
  // errors
  ERR_RESOURCE_NOT_AVAILABLE, UnknownToolNamesError,
  // building blocks
  canonicalize, computeSchemaHash,
  // server side
  ProgressiveDisclosureServer,
  // client side
  listToolsCatalog, describeTools, ProgressiveDisclosureCache,
} from './index.js';
```
