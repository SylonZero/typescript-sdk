/**
 * In-process demo of the Progressive Tool Disclosure lifecycle.
 *
 * Wires the server polyfill to the client cache via an in-memory
 * `RequestFn`, then runs two simulated agent turns:
 *   - Turn 1: cold cache, agent picks 3 candidate tools; cache miss
 *     triggers a single batched `tools/describe`.
 *   - Turn 2: same agent picks 2 of those 3 tools again; cache hits
 *     skip the network entirely.
 *
 * Run: pnpm demo  (or: tsx src/demo.ts)
 */

import { SAMPLE_TOOLS } from '../bench/sampleTools.js';
import { ProgressiveDisclosureCache } from './client.js';
import { ProgressiveDisclosureServer } from './server.js';
import {
    METHOD_TOOLS_DESCRIBE,
    METHOD_TOOLS_INDEX,
    type DescribeToolsRequestParams,
    type ListIndexedToolsRequestParams
} from './types.js';

// --- Wire up an in-memory transport ----------------------------------------

const server = new ProgressiveDisclosureServer(SAMPLE_TOOLS);
let describeCalls = 0;

const request = async <T>(method: string, params?: unknown): Promise<T> => {
    if (method === METHOD_TOOLS_INDEX) {
        return server.listIndexedTools((params ?? {}) as ListIndexedToolsRequestParams) as T;
    }
    if (method === METHOD_TOOLS_DESCRIBE) {
        describeCalls++;
        return server.describeTools(params as DescribeToolsRequestParams) as T;
    }
    throw new Error(`Unknown method: ${method}`);
};

const cache = new ProgressiveDisclosureCache({ serverIdentity: 'mindstaq-mcp' });

// --- Turn 1: cold cache ----------------------------------------------------

console.log('--- Turn 1: cold cache ---\n');

const indexQ1 = await server.listIndexedTools({ query: 'task' });
console.log(`tools/index?query=task → ${indexQ1.tools.length} indexed records`);
for (const it of indexQ1.tools.slice(0, 5)) {
    console.log(`  • ${it.name.padEnd(24)} ${it.summary}`);
}
if (indexQ1.tools.length > 5) console.log(`  ... and ${indexQ1.tools.length - 5} more`);

// Agent picks 3 candidates from the index.
const candidates1 = indexQ1.tools.slice(0, 3);
console.log(`\nAgent picks: ${candidates1.map((c) => c.name).join(', ')}`);
console.log('Resolving full schemas via cache...');
const before1 = describeCalls;
const tools1 = await cache.materialize(candidates1, request);
console.log(`  describe round trips this turn: ${describeCalls - before1}`);
console.log(`  resolved tools: ${tools1.map((t) => t.name).join(', ')}`);
console.log(`  cache size: ${cache._size()}`);

// --- Turn 2: 2 of the same 3 tools ----------------------------------------

console.log('\n--- Turn 2: agent picks 2 tools already seen in Turn 1 ---\n');

const indexQ2 = await server.listIndexedTools({ query: 'task' });
const candidates2 = [indexQ2.tools[0]!, indexQ2.tools[2]!];
console.log(`Agent picks: ${candidates2.map((c) => c.name).join(', ')}`);
const before2 = describeCalls;
const tools2 = await cache.materialize(candidates2, request);
console.log(`  describe round trips this turn: ${describeCalls - before2}  ← should be 0`);
console.log(`  resolved tools: ${tools2.map((t) => t.name).join(', ')}`);

// --- Turn 3: a new tool, but mostly hits ----------------------------------

console.log('\n--- Turn 3: agent picks 1 new tool + 2 cached ---\n');

const candidates3 = [indexQ2.tools[0]!, indexQ2.tools[2]!, indexQ2.tools[5]!];
console.log(`Agent picks: ${candidates3.map((c) => c.name).join(', ')}`);
const before3 = describeCalls;
const tools3 = await cache.materialize(candidates3, request);
console.log(`  describe round trips this turn: ${describeCalls - before3}  ← should be 1 (one batched describe for the miss)`);
console.log(`  resolved tools: ${tools3.map((t) => t.name).join(', ')}`);
console.log(`  cache size: ${cache._size()}`);

// --- Reconciliation after a (simulated) list_changed notification ---------

console.log('\n--- Simulated list_changed: 1 tool re-hashed ---\n');

const fresh = await server.listIndexedTools({ query: 'task' });
// Tamper with one hash to simulate a schema change for that tool.
fresh.tools[0]!.schemaHash = 'deadbeef'.repeat(8);
const evict = cache.reconcile(fresh.tools);
console.log(`  evicted ${evict.evicted} stale entry/entries`);
console.log(`  cache size after reconcile: ${cache._size()}`);

console.log('\n✓ demo complete');
