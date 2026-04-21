/**
 * Server-side polyfill — derives `tools/index` and `tools/describe`
 * from an existing tool catalog. Designed to be droppable onto any
 * MCP server with an existing `tools/list` handler.
 *
 * In a fully-integrated SDK, this would be wired through the
 * `Server.setRequestHandler` API. Here it is exposed as a pure
 * builder so the prototype is dependency-free.
 */

import { computeSchemaHash } from './schemaHash.js';
import type {
    DescribeToolsRequestParams,
    DescribeToolsResult,
    IndexedTool,
    ListIndexedToolsRequestParams,
    ListIndexedToolsResult,
    Tool
} from './types.js';
import { UnknownToolNamesError } from './types.js';

/** A function that decides whether a tool matches a search query. */
export type QueryMatcher = (tool: Tool, query: string) => boolean;

export interface ProgressiveDisclosureServerOptions {
    /**
     * Maximum number of `IndexedTool` records returned per page.
     * Default: 100.
     */
    pageSize?: number;

    /**
     * Maximum number of names accepted per `tools/describe` request.
     * Requests exceeding this limit produce a JSON-RPC error and
     * the client should batch.  Default: 50.
     */
    describeBatchLimit?: number;

    /**
     * How to derive `IndexedTool.summary` from a `Tool`. Defaults to
     * the first sentence of `description`, truncated to 200 chars.
     * Override to use a richer source (e.g. `annotations.title`,
     * a tier-aware short description, or a translation table).
     */
    deriveSummary?: (tool: Tool) => string;

    /**
     * How to derive `IndexedTool.tags` from a `Tool`. Defaults to
     * `tool.annotations?.tags` if present and an array of strings,
     * otherwise undefined.
     */
    deriveTags?: (tool: Tool) => string[] | undefined;

    /**
     * Query matcher invoked when `query` is present on `tools/index`.
     * Defaults to a case-insensitive substring search across name,
     * title, description, and tags.
     */
    queryMatcher?: QueryMatcher;
}

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_DESCRIBE_BATCH_LIMIT = 50;

const defaultDeriveSummary = (tool: Tool): string => {
    const source = tool.description ?? tool.title ?? tool.name;
    // First sentence, then truncate to 200 chars.
    const firstSentence = source.split(/(?<=[.!?])\s/)[0] ?? source;
    return firstSentence.length > 200 ? firstSentence.slice(0, 197) + '...' : firstSentence;
};

const defaultDeriveTags = (tool: Tool): string[] | undefined => {
    const t = tool.annotations?.tags;
    if (Array.isArray(t) && t.every((x) => typeof x === 'string')) {
        return t as string[];
    }
    return undefined;
};

const defaultQueryMatcher: QueryMatcher = (tool, query) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    const haystack: string[] = [
        tool.name,
        tool.title ?? '',
        tool.description ?? '',
        ...(defaultDeriveTags(tool) ?? [])
    ];
    return haystack.some((s) => s.toLowerCase().includes(q));
};

/**
 * Build a `ProgressiveDisclosureServer` over a fixed tool catalog.
 *
 * The catalog is captured by reference, so updates to the source
 * array are reflected on subsequent calls. For dynamic catalogs,
 * the host application is responsible for emitting
 * `notifications/tools/list_changed` after mutating the array.
 */
export class ProgressiveDisclosureServer {
    private readonly catalog: () => readonly Tool[];
    private readonly pageSize: number;
    private readonly describeBatchLimit: number;
    private readonly deriveSummary: (tool: Tool) => string;
    private readonly deriveTags: (tool: Tool) => string[] | undefined;
    private readonly queryMatcher: QueryMatcher;
    private readonly hashCache = new WeakMap<Tool, string>();

    constructor(catalog: readonly Tool[] | (() => readonly Tool[]), options: ProgressiveDisclosureServerOptions = {}) {
        this.catalog = typeof catalog === 'function' ? catalog : () => catalog;
        this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
        this.describeBatchLimit = options.describeBatchLimit ?? DEFAULT_DESCRIBE_BATCH_LIMIT;
        this.deriveSummary = options.deriveSummary ?? defaultDeriveSummary;
        this.deriveTags = options.deriveTags ?? defaultDeriveTags;
        this.queryMatcher = options.queryMatcher ?? defaultQueryMatcher;
    }

    /** Hash with a per-instance cache to avoid recomputing on every page. */
    private hashFor(tool: Tool): string {
        const cached = this.hashCache.get(tool);
        if (cached !== undefined) return cached;
        const h = computeSchemaHash(tool);
        this.hashCache.set(tool, h);
        return h;
    }

    /** Convert a `Tool` into its lightweight `IndexedTool` representation. */
    public toIndexed(tool: Tool): IndexedTool {
        const indexed: IndexedTool = {
            name: tool.name,
            summary: this.deriveSummary(tool),
            schemaHash: this.hashFor(tool)
        };
        if (tool.title !== undefined) indexed.title = tool.title;
        const tags = this.deriveTags(tool);
        if (tags) indexed.tags = tags;
        if (tool.annotations) {
            // Surface only the well-known boolean hints in the index;
            // richer annotations belong on the full Tool returned by
            // tools/describe.
            const indexedAnnotations: Record<string, unknown> = {};
            for (const k of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
                if (tool.annotations[k] !== undefined) indexedAnnotations[k] = tool.annotations[k];
            }
            if (Object.keys(indexedAnnotations).length > 0) {
                indexed.annotations = indexedAnnotations;
            }
        }
        return indexed;
    }

    /**
     * Implement `tools/index`.
     *
     * If `query` is present, the configured matcher decides which tools
     * are returned. The result is paginated; clients pass the returned
     * `nextCursor` back to retrieve the next page.
     */
    public listIndexedTools(params: ListIndexedToolsRequestParams = {}): ListIndexedToolsResult {
        const all = this.catalog();
        const filtered = params.query ? all.filter((t) => this.queryMatcher(t, params.query!)) : all;

        const start = params.cursor ? parseCursor(params.cursor) : 0;
        const end = Math.min(start + this.pageSize, filtered.length);
        const page = filtered.slice(start, end);
        const result: ListIndexedToolsResult = {
            tools: page.map((t) => this.toIndexed(t))
        };
        if (end < filtered.length) {
            result.nextCursor = encodeCursor(end);
        }
        return result;
    }

    /**
     * Implement `tools/describe`.
     *
     * Returns full `Tool` records for the requested names, in the same
     * order. Unknown names produce a single error response listing all
     * unknowns — partial responses are not permitted.
     */
    public describeTools(params: DescribeToolsRequestParams): DescribeToolsResult {
        if (!Array.isArray(params.names) || params.names.length === 0) {
            throw new TypeError('tools/describe: `names` must be a non-empty array');
        }
        if (params.names.length > this.describeBatchLimit) {
            throw new RangeError(
                `tools/describe: ${params.names.length} names exceeds batch limit of ${this.describeBatchLimit}`
            );
        }

        const byName = new Map<string, Tool>();
        for (const t of this.catalog()) byName.set(t.name, t);

        const unknown: string[] = [];
        const tools: Tool[] = [];
        for (const name of params.names) {
            const t = byName.get(name);
            if (!t) unknown.push(name);
            else tools.push(t);
        }
        if (unknown.length > 0) {
            throw new UnknownToolNamesError(unknown);
        }
        return { tools };
    }
}

// -----------------------------------------------------------------------------
// Cursor encoding (opaque to the client).
// -----------------------------------------------------------------------------

function encodeCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

function parseCursor(cursor: string): number {
    try {
        const obj = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: unknown };
        if (typeof obj.offset === 'number' && Number.isInteger(obj.offset) && obj.offset >= 0) {
            return obj.offset;
        }
    } catch {
        // fall through
    }
    throw new TypeError(`Invalid cursor: ${cursor}`);
}
