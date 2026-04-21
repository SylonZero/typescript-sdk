import { describe, expect, it, vi } from 'vitest';
import { ProgressiveDisclosureCache } from '../src/client.js';
import { ProgressiveDisclosureServer } from '../src/server.js';
import type { Tool } from '../src/types.js';
import { METHOD_TOOLS_DESCRIBE, METHOD_TOOLS_INDEX } from '../src/types.js';

function makeTool(name: string): Tool {
    return {
        name,
        description: `Tool ${name}`,
        inputSchema: { type: 'object', properties: { x: { type: 'string' } } }
    };
}

function makeRequest(server: ProgressiveDisclosureServer) {
    const calls: { method: string; params: unknown }[] = [];
    const fn = async <T>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params });
        if (method === METHOD_TOOLS_INDEX) return server.listIndexedTools(params as never) as T;
        if (method === METHOD_TOOLS_DESCRIBE) return server.describeTools(params as never) as T;
        throw new Error(`unknown method ${method}`);
    };
    return { fn, calls };
}

describe('ProgressiveDisclosureCache', () => {
    it('issues one batched tools/describe on cold cache', async () => {
        const tools = [makeTool('a'), makeTool('b'), makeTool('c')];
        const server = new ProgressiveDisclosureServer(tools);
        const cache = new ProgressiveDisclosureCache({ serverIdentity: 's1' });
        const { fn, calls } = makeRequest(server);

        const indexed = server.listIndexedTools().tools;
        const resolved = await cache.materialize(indexed, fn);

        expect(resolved.map((t) => t.name)).toEqual(['a', 'b', 'c']);
        const describes = calls.filter((c) => c.method === METHOD_TOOLS_DESCRIBE);
        expect(describes).toHaveLength(1);
        expect((describes[0]!.params as { names: string[] }).names).toEqual(['a', 'b', 'c']);
    });

    it('serves repeat lookups from cache without round-tripping', async () => {
        const tools = [makeTool('a'), makeTool('b')];
        const server = new ProgressiveDisclosureServer(tools);
        const cache = new ProgressiveDisclosureCache({ serverIdentity: 's1' });
        const { fn, calls } = makeRequest(server);

        const indexed = server.listIndexedTools().tools;
        await cache.materialize(indexed, fn); // turn 1
        const before = calls.length;
        await cache.materialize(indexed, fn); // turn 2
        await cache.materialize(indexed, fn); // turn 3

        // Index calls were issued by the test, not the cache; the cache only
        // issues describes. Verify no additional describes happened.
        const describesAfter = calls.slice(before).filter((c) => c.method === METHOD_TOOLS_DESCRIBE);
        expect(describesAfter).toHaveLength(0);
    });

    it('only fetches the missing subset when partially cached', async () => {
        const tools = [makeTool('a'), makeTool('b'), makeTool('c'), makeTool('d')];
        const server = new ProgressiveDisclosureServer(tools);
        const cache = new ProgressiveDisclosureCache({ serverIdentity: 's1' });
        const { fn, calls } = makeRequest(server);

        const indexed = server.listIndexedTools().tools;
        // Prime cache with [a, b].
        await cache.materialize([indexed[0]!, indexed[1]!], fn);
        const before = calls.length;

        // Request [a, c, b, d] — c and d are misses.
        const resolved = await cache.materialize(
            [indexed[0]!, indexed[2]!, indexed[1]!, indexed[3]!],
            fn
        );
        expect(resolved.map((t) => t.name)).toEqual(['a', 'c', 'b', 'd']);
        const describes = calls.slice(before).filter((c) => c.method === METHOD_TOOLS_DESCRIBE);
        expect(describes).toHaveLength(1);
        expect((describes[0]!.params as { names: string[] }).names).toEqual(['c', 'd']);
    });

    it('reconcile() evicts entries whose hash no longer appears', async () => {
        const tools = [makeTool('a'), makeTool('b')];
        const server = new ProgressiveDisclosureServer(tools);
        const cache = new ProgressiveDisclosureCache({ serverIdentity: 's1' });
        const { fn } = makeRequest(server);

        const indexed = server.listIndexedTools().tools;
        await cache.materialize(indexed, fn);
        expect(cache._size()).toBe(2);

        // Simulate `b`'s schema changing.
        const fresh = server.listIndexedTools().tools;
        fresh[1]!.schemaHash = 'cafebabe'.repeat(8);

        const r = cache.reconcile(fresh);
        expect(r.evicted).toBe(1);
        expect(cache._size()).toBe(1);
    });

    it('persistence hook receives writes after misses', async () => {
        const tools = [makeTool('a')];
        const server = new ProgressiveDisclosureServer(tools);
        const persistence = {
            load: vi.fn(async () => new Map<string, Tool>()),
            save: vi.fn(async () => {})
        };
        const cache = new ProgressiveDisclosureCache({ serverIdentity: 's1', persistence });
        const { fn } = makeRequest(server);

        const indexed = server.listIndexedTools().tools;
        await cache.materialize(indexed, fn);

        expect(persistence.load).toHaveBeenCalledOnce();
        expect(persistence.save).toHaveBeenCalledOnce();
    });

    it('namespace isolation between server identities', async () => {
        const tools = [makeTool('a')];
        const server = new ProgressiveDisclosureServer(tools);
        const cacheS1 = new ProgressiveDisclosureCache({ serverIdentity: 's1' });
        const cacheS2 = new ProgressiveDisclosureCache({ serverIdentity: 's2' });
        const { fn, calls } = makeRequest(server);

        const indexed = server.listIndexedTools().tools;
        await cacheS1.materialize(indexed, fn);
        const before = calls.length;
        await cacheS2.materialize(indexed, fn); // separate cache → fresh describe

        const describesAfter = calls.slice(before).filter((c) => c.method === METHOD_TOOLS_DESCRIBE);
        expect(describesAfter).toHaveLength(1);
    });
});
