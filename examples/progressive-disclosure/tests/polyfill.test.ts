import { describe, expect, it } from 'vitest';
import { computeSchemaHash } from '../src/schemaHash.js';
import { ProgressiveDisclosureServer } from '../src/server.js';
import type { Tool } from '../src/types.js';
import { UnknownToolNamesError } from '../src/types.js';

function makeTool(name: string, descLen = 50): Tool {
    return {
        name,
        title: `Title for ${name}`,
        description: 'A'.repeat(descLen),
        inputSchema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id']
        },
        annotations: { tags: [name.split('_')[0] ?? 'misc'] }
    };
}

describe('ProgressiveDisclosureServer', () => {
    describe('listIndexedTools', () => {
        it('returns one IndexedTool per source Tool', () => {
            const tools = [makeTool('a_one'), makeTool('a_two'), makeTool('b_three')];
            const server = new ProgressiveDisclosureServer(tools);
            const result = server.listIndexedTools();
            expect(result.tools).toHaveLength(3);
            expect(result.tools.map((t) => t.name)).toEqual(['a_one', 'a_two', 'b_three']);
        });

        it('includes a stable schemaHash matching computeSchemaHash', () => {
            const tools = [makeTool('a')];
            const server = new ProgressiveDisclosureServer(tools);
            const result = server.listIndexedTools();
            expect(result.tools[0]!.schemaHash).toBe(computeSchemaHash(tools[0]!));
        });

        it('truncates summary to 200 chars', () => {
            const tools = [makeTool('long', 500)];
            const server = new ProgressiveDisclosureServer(tools);
            const result = server.listIndexedTools();
            expect(result.tools[0]!.summary.length).toBeLessThanOrEqual(200);
        });

        it('respects custom deriveSummary', () => {
            const tools = [makeTool('x')];
            const server = new ProgressiveDisclosureServer(tools, {
                deriveSummary: (t) => `[CUSTOM] ${t.name}`
            });
            expect(server.listIndexedTools().tools[0]!.summary).toBe('[CUSTOM] x');
        });

        it('paginates with cursor and nextCursor', () => {
            const tools = Array.from({ length: 25 }, (_, i) => makeTool(`tool_${i}`));
            const server = new ProgressiveDisclosureServer(tools, { pageSize: 10 });

            const page1 = server.listIndexedTools();
            expect(page1.tools).toHaveLength(10);
            expect(page1.nextCursor).toBeDefined();

            const page2 = server.listIndexedTools({ cursor: page1.nextCursor! });
            expect(page2.tools).toHaveLength(10);
            expect(page2.nextCursor).toBeDefined();

            const page3 = server.listIndexedTools({ cursor: page2.nextCursor! });
            expect(page3.tools).toHaveLength(5);
            expect(page3.nextCursor).toBeUndefined();
        });

        it('filters by query (default substring matcher)', () => {
            const tools = [
                makeTool('project_create'),
                makeTool('project_delete'),
                makeTool('task_create'),
                makeTool('issue_close')
            ];
            const server = new ProgressiveDisclosureServer(tools);
            const result = server.listIndexedTools({ query: 'project' });
            expect(result.tools.map((t) => t.name)).toEqual(['project_create', 'project_delete']);
        });

        it('filters by tags via default matcher', () => {
            const tools = [makeTool('a_one'), makeTool('b_two'), makeTool('a_three')];
            const server = new ProgressiveDisclosureServer(tools);
            const result = server.listIndexedTools({ query: 'a' });
            expect(result.tools.map((t) => t.name)).toEqual(['a_one', 'b_two', 'a_three']);
        });

        it('respects custom queryMatcher', () => {
            const tools = [makeTool('alpha'), makeTool('beta'), makeTool('gamma')];
            const server = new ProgressiveDisclosureServer(tools, {
                queryMatcher: (t, q) => t.name.startsWith(q)
            });
            expect(server.listIndexedTools({ query: 'be' }).tools.map((t) => t.name)).toEqual(['beta']);
        });
    });

    describe('describeTools', () => {
        const tools = [makeTool('a'), makeTool('b'), makeTool('c')];
        const server = new ProgressiveDisclosureServer(tools);

        it('returns full Tool records in request order', () => {
            const r = server.describeTools({ names: ['c', 'a', 'b'] });
            expect(r.tools.map((t) => t.name)).toEqual(['c', 'a', 'b']);
        });

        it('rejects empty names', () => {
            expect(() => server.describeTools({ names: [] })).toThrow(TypeError);
        });

        it('rejects oversized batches', () => {
            const big = new ProgressiveDisclosureServer(tools, { describeBatchLimit: 2 });
            expect(() => big.describeTools({ names: ['a', 'b', 'c'] })).toThrow(RangeError);
        });

        it('throws UnknownToolNamesError for missing names', () => {
            try {
                server.describeTools({ names: ['a', 'nope', 'b'] });
                throw new Error('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(UnknownToolNamesError);
                expect((e as UnknownToolNamesError).data.unknownNames).toEqual(['nope']);
            }
        });

        it('describe(all_names) is byte-equivalent (after canonicalization) to the source catalog', () => {
            const names = tools.map((t) => t.name);
            const result = server.describeTools({ names });
            for (let i = 0; i < tools.length; i++) {
                expect(computeSchemaHash(result.tools[i]!)).toBe(computeSchemaHash(tools[i]!));
            }
        });
    });
});
