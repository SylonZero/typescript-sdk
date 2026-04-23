# Integration Guide

This guide shows how to adopt Progressive Tool Disclosure in a real MCP server and a real MCP client. It assumes you have already read [`SPEC.md`](./SPEC.md) and skimmed [`README.md`](./README.md). The reference prototype's `src/` modules are designed to be lifted directly into your own codebase under an MIT license; this guide explains how.

## Adoption strategy

The protocol is additive. Servers continue to support `tools/list` unchanged, and clients that don't know about the new methods continue to work. That gives you two adoption paths:

1. **Server-only**: advertise the capability and implement the new methods. Clients that know about the capability get the win; older clients are unaffected.
2. **Client-only**: implement the cache and capability check. Against servers that advertise progressive disclosure, the client will use the new methods; against older servers, it falls back to `tools/list`.

You can do either independently. The full benefit lands when both sides are upgraded.

## Server-side integration

The server-side surface is two new request handlers and one capability flag. The reference implementation provides a `ProgressiveDisclosureServer` polyfill that handles the derivation logic; you're responsible for wiring it into the SDK's request-handler registry and providing a high-quality summary derivation.

### Step 1 — Drop in the polyfill modules

Copy these four files from `examples/progressive-disclosure/src/` into your server codebase under any path that fits your conventions:

- `types.ts`
- `canonicalJson.ts`
- `schemaHash.ts`
- `server.ts`

These have zero runtime dependencies beyond `node:crypto` and Buffer. They are MIT-licensed.

### Step 2 — Wire the request handlers

Construct a `ProgressiveDisclosureServer` over your existing tool catalog, then register two handlers on the MCP `Server`. The exact API name varies by SDK version, but the shape is:

```typescript
import { ProgressiveDisclosureServer } from './progressive-disclosure/server.js';
import { UnknownToolNamesError } from './progressive-disclosure/types.js';

// `allTools` is your existing Tool[] — the same array you serve from tools/list.
const pd = new ProgressiveDisclosureServer(allTools, {
  deriveSummary: (tool) => CURATED_SUMMARIES[tool.name] ?? defaultSummary(tool),
  deriveTags: (tool) => DOMAIN_TAGS[tool.name],
  // pageSize and describeBatchLimit have sensible defaults (100 and 50)
});

server.setRequestHandler('tools/catalog', async (req) => {
  return pd.listToolsCatalog(req.params ?? {});
});

server.setRequestHandler('tools/describe', async (req) => {
  try {
    return pd.describeTools(req.params);
  } catch (err) {
    if (err instanceof UnknownToolNamesError) {
      // Re-throw as a JSON-RPC error your transport understands.
      const e: any = new Error(err.message);
      e.code = err.code;       // -32002
      e.data = err.data;       // { unknownNames: [...] }
      throw e;
    }
    throw err;
  }
});
```

The polyfill captures the catalog by reference, so if your tools array is mutated in place you don't need to rebuild the polyfill. If you replace the array (e.g., tools added or removed at runtime), pass a function instead of the array so the polyfill always sees the current set:

```typescript
const pd = new ProgressiveDisclosureServer(() => currentToolsArray, options);
```

### Step 3 — Advertise the capability

Add `progressiveDisclosure: true` under your server's `tools` capability:

```typescript
const serverCapabilities = {
  tools: {
    listChanged: true,
    progressiveDisclosure: true,   // <-- add this
  },
  // ...
};
```

Clients that know about the capability will route to `tools/catalog` and `tools/describe`. Clients that don't will continue using `tools/list` unchanged.

### Step 4 — Curate your summaries

This is the highest-leverage piece of work and the easiest to skip. The default summary derivation takes the first sentence of `description`, truncated to 200 characters. That works, but it leaves a lot on the table because most tool descriptions are written for human developers reading documentation, not for an LLM scanning a catalog mid-conversation.

A curated `CURATED_SUMMARIES: Record<string, string>` lookup table gets you the routing-quality win that the SEP §2 paragraph on summary quality refers to. Good summaries:

- Lead with a verb: "Create", "List", "Update", "Search"
- Mention the primary noun and its scope: "task in a project", "issue on a workspace"
- Stay under ~120 characters where possible
- Use vocabulary the LLM has seen elsewhere in the system prompt or earlier turns

A worked example for a project-management server:

```typescript
const CURATED_SUMMARIES: Record<string, string> = {
  project_create: 'Create a new project with a methodology (agile, waterfall, manual).',
  project_list: 'List projects in a workspace, with status and progress.',
  task_create: 'Create a task under a project, optionally as a subtask.',
  task_list_my_active: "List the current user's active tasks across all projects.",
  task_search: 'Search tasks by text across a workspace or single project.',
  // ... one line per tool
};
```

For ~25 tools this is an hour of writing and pays back on every chat turn forever. For 200 tools, generate a first pass with an LLM, then hand-edit the high-traffic ones.

### Step 5 — Maintain the change-domain invariant

When you mutate a tool, regenerate the polyfill's hash cache. The polyfill uses a `WeakMap<Tool, string>` keyed by the `Tool` reference, so:

- If you mutate a `Tool` in place, the WeakMap will return the stale hash. Either replace the `Tool` reference (preferred) or clear the polyfill and rebuild.
- If you replace the entire tools array, no action needed — the new `Tool` references will hash fresh.

Per the spec, emit `notifications/tools/list_changed` whenever the catalog, schemas, or any `schemaHash` changes. The notification is the existing one — no new wire surface.

## Client-side integration

The client-side surface is a capability check, two RPC calls, and an optional cache.

### Step 1 — Drop in the client modules

Copy these from `examples/progressive-disclosure/src/`:

- `types.ts` (if not already shared with the server side)
- `client.ts`

`client.ts` exports `listToolsCatalog`, `describeTools`, and `ProgressiveDisclosureCache`.

### Step 2 — Check the capability and route accordingly

```typescript
const initResult = await client.initialize(...);
const supportsProgressive = Boolean(
  initResult.capabilities?.tools?.progressiveDisclosure
);

const tools = supportsProgressive
  ? await loadViaProgressiveDisclosure(client)
  : await client.request('tools/list', {});
```

For older servers, your existing `tools/list` flow continues to work. For new servers, `loadViaProgressiveDisclosure` is the new flow.

### Step 3 — Use the cache

The `ProgressiveDisclosureCache` implements the recommended hit/miss/reconcile pattern. Construct it once per server connection, reuse it for the lifetime of the connection:

```typescript
import { ProgressiveDisclosureCache, listToolsCatalog } from './progressive-disclosure/client.js';

const cache = new ProgressiveDisclosureCache({
  serverIdentity: connection.id, // your existing connection identifier
});

// `request` is your existing JSON-RPC roundtrip helper.
const request = async <T>(method: string, params: unknown): Promise<T> =>
  client.request(method, params);

async function loadViaProgressiveDisclosure(client) {
  const catalog = await listToolsCatalog(request);
  // catalog.tools is ToolCatalogEntry[] — show summaries to the model here.
  return catalog.tools;
}

// When the agent picks specific tools to surface or invoke:
async function materializeFullSchemas(picks: ToolCatalogEntry[]): Promise<Tool[]> {
  return cache.materialize(picks, request);
}
```

The cache returns full `Tool` records for the picks. Cache hits avoid the round trip entirely; misses trigger a single batched `tools/describe` for all the missing names at once.

### Step 4 — Handle list_changed

When you receive `notifications/tools/list_changed`, fetch a fresh catalog and reconcile the cache:

```typescript
client.onNotification('notifications/tools/list_changed', async () => {
  const fresh = await listToolsCatalog(request);
  const { evicted } = cache.reconcile(fresh.tools);
  // Optional: log how many cached schemas were invalidated.
});
```

`reconcile` evicts only entries whose `schemaHash` no longer appears in the fresh catalog. Cached entries whose hash still matches stay valid — that's the §5 change-domain separation in action.

### Step 5 — Decide on persistence (optional)

The cache supports an optional `persistence` hook for cross-session reuse. This is genuinely optional and host-defined; the SEP does not prescribe it.

```typescript
const persistence = {
  async load(serverIdentity: string): Promise<Map<string, Tool>> {
    const blob = await yourStorage.get(`pd-cache:${serverIdentity}`);
    return blob ? new Map(JSON.parse(blob)) : new Map();
  },
  async save(serverIdentity: string, entries: Map<string, Tool>): Promise<void> {
    await yourStorage.set(
      `pd-cache:${serverIdentity}`,
      JSON.stringify([...entries])
    );
  },
};

const cache = new ProgressiveDisclosureCache({ serverIdentity, persistence });
```

Caveats:

- `serverIdentity` semantics are entirely yours to define. Use whatever stable identifier your host already uses for connection state.
- Cross-session caching only pays off when the cache is preserved across process restarts (browser tab, mobile app suspend/resume, server restart). For short-lived processes, in-memory is sufficient.
- A schema cache may grow over time. Consider an LRU or size cap if your catalog is volatile.

## Common pitfalls

**`tools/list` and `tools/catalog` returning different sets.** They MUST return the same set of tools for the same session. If you apply scope filtering at one layer but not the other, you've introduced an authorization bypass. The polyfill avoids this by being a derived view, but if you implement `tools/catalog` from scratch, share the filtering logic.

**Forgetting to advertise the capability.** Without the capability flag, clients won't even try the new methods. The capability is the only signal.

**Non-deterministic summary derivation.** If your `deriveSummary` reads from a database or calls an external service, the same tool can produce different summaries on different requests. That's fine for routing quality but means clients can't rely on the catalog being byte-stable across calls. Prefer pure-function derivation.

**Forgetting to regenerate hashes after mutation.** The WeakMap-based hash cache is an optimization; it assumes `Tool` references are immutable. If you mutate a `Tool` in place, replace the reference instead.

**Using `tools/describe` for browse-style traversal.** `tools/describe` is for "I picked these N tools, give me their schemas." If a client wants the full catalog (e.g., a tool inspector UI), it should use `tools/list` — that's why `tools/list` is preserved.

**Passing arbitrary user input as `query` without sanitization.** The `query` parameter is opaque to the protocol but server-defined in semantics. If your server backs the query with a search engine, vector database, or LLM-based retriever, treat it as untrusted input.

## Testing your integration

The `tests/` directory in the prototype is a good template. The tests you'll want against your integration:

1. **Equivalence**: `describe(all_names_from_catalog)` returns the same `Tool` records (modulo whitespace) as `tools/list`.
2. **Hash stability**: the same `Tool` produces the same `schemaHash` across multiple calls and across encode/decode round trips.
3. **Authorization parity**: a tool hidden from `tools/list` for a particular session is also hidden from `tools/catalog` and produces a `-32002` from `tools/describe`.
4. **Notification semantics**: mutating a tool fires `notifications/tools/list_changed`, and a subsequent `tools/catalog` reflects the new `schemaHash`.
5. **Cache correctness** (client side): cold cache → one batched describe; warm cache → zero describes; reconcile after hash change → eviction.

The `tests/cache.test.ts` and `tests/polyfill.test.ts` files in this prototype cover all five against the in-process implementations and can be adapted to your transport.
