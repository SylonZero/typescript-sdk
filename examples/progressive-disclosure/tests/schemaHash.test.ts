import { describe, expect, it } from 'vitest';
import { computeSchemaHash } from '../src/schemaHash.js';
import type { Tool } from '../src/types.js';

const sampleTool: Tool = {
    name: 'project_create',
    title: 'Create Project',
    description: 'Create a new project',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', minLength: 1 },
            methodology: { type: 'string', enum: ['agile', 'waterfall', 'manual'] }
        },
        required: ['name', 'methodology']
    },
    annotations: { tags: ['projects', 'create'] }
};

describe('computeSchemaHash', () => {
    it('returns lowercase hex SHA-256 (64 chars)', () => {
        const h = computeSchemaHash(sampleTool);
        expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is stable across encode/decode round-trips', () => {
        const h1 = computeSchemaHash(sampleTool);
        const roundTripped = JSON.parse(JSON.stringify(sampleTool)) as Tool;
        const h2 = computeSchemaHash(roundTripped);
        expect(h2).toBe(h1);
    });

    it('is invariant to top-level key ordering', () => {
        const reordered = {
            annotations: sampleTool.annotations,
            inputSchema: sampleTool.inputSchema,
            description: sampleTool.description,
            title: sampleTool.title,
            name: sampleTool.name
        } as Tool;
        expect(computeSchemaHash(reordered)).toBe(computeSchemaHash(sampleTool));
    });

    it('is invariant to nested key ordering', () => {
        const reordered: Tool = {
            ...sampleTool,
            inputSchema: {
                required: ['name', 'methodology'],
                properties: {
                    methodology: { enum: ['agile', 'waterfall', 'manual'], type: 'string' },
                    name: { minLength: 1, type: 'string' }
                },
                type: 'object'
            }
        };
        expect(computeSchemaHash(reordered)).toBe(computeSchemaHash(sampleTool));
    });

    it('changes when the schema changes', () => {
        const mutated: Tool = {
            ...sampleTool,
            inputSchema: {
                ...sampleTool.inputSchema,
                properties: {
                    ...sampleTool.inputSchema.properties,
                    description: { type: 'string' }
                }
            }
        };
        expect(computeSchemaHash(mutated)).not.toBe(computeSchemaHash(sampleTool));
    });

    it('changes when annotations change', () => {
        const mutated: Tool = {
            ...sampleTool,
            annotations: { ...sampleTool.annotations, destructiveHint: true }
        };
        expect(computeSchemaHash(mutated)).not.toBe(computeSchemaHash(sampleTool));
    });
});
