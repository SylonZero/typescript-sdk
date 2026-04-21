/**
 * Client-side helpers for Progressive Tool Disclosure.
 *
 * These are intentionally transport-agnostic: pass any function that
 * round-trips a JSON-RPC method+params and returns the result. In the
 * real SDK this wraps `Client.request(...)`.
 */

import type {
    DescribeToolsRequestParams,
    DescribeToolsResult,
    ToolCatalogEntry,
    ListToolsCatalogRequestParams,
    ListToolsCatalogResult,
    Tool
} from './types.js';
import { METHOD_TOOLS_DESCRIBE, METHOD_TOOLS_CATALOG } from './types.js';

/** Minimal transport contract — produced by the host's MCP client. */
export type RequestFn = <TResult>(method: string, params?: unknown) => Promise<TResult>;

// -----------------------------------------------------------------------------
// Convenience wrappers.
// -----------------------------------------------------------------------------

export async function listToolsCatalog(
    request: RequestFn,
    params: ListToolsCatalogRequestParams = {}
): Promise<ListToolsCatalogResult> {
    return request<ListToolsCatalogResult>(METHOD_TOOLS_CATALOG, params);
}

export async function describeTools(
    request: RequestFn,
    params: DescribeToolsRequestParams
): Promise<DescribeToolsResult> {
    return request<DescribeToolsResult>(METHOD_TOOLS_DESCRIBE, params);
}

// -----------------------------------------------------------------------------
// Cache — implements the SEP §5 invalidation pattern.
// -----------------------------------------------------------------------------

export interface ProgressiveDisclosureCacheOptions {
    /**
     * Stable identifier distinguishing one MCP server connection from
     * another. The host's existing connection identity is the right
     * choice. The same value is used to namespace cache entries.
     */
    serverIdentity: string;

    /**
     * Optional persistence hook. If provided, the cache writes through
     * to this store after every successful describe. Pass `null` for
     * in-memory only (default).
     */
    persistence?: CachePersistence | null;
}

export interface CachePersistence {
    load(serverIdentity: string): Promise<Map<string, Tool>>;
    save(serverIdentity: string, entries: Map<string, Tool>): Promise<void>;
}

/**
 * In-memory schema cache, keyed by `${serverIdentity}::${toolName}::${schemaHash}`.
 *
 * On a `tools/catalog` response, call `materialize(entries, request)` —
 * cache hits return the full Tool records immediately; misses trigger
 * a single batched `tools/describe` for the missing names.
 */
export class ProgressiveDisclosureCache {
    private readonly options: ProgressiveDisclosureCacheOptions;
    private readonly entries = new Map<string, Tool>();
    private loaded = false;

    constructor(options: ProgressiveDisclosureCacheOptions) {
        this.options = options;
    }

    private key(name: string, hash: string): string {
        return `${this.options.serverIdentity}::${name}::${hash}`;
    }

    /** Lazy-load any persisted cache entries. */
    private async ensureLoaded(): Promise<void> {
        if (this.loaded) return;
        this.loaded = true;
        const p = this.options.persistence;
        if (!p) return;
        const stored = await p.load(this.options.serverIdentity);
        for (const [k, v] of stored) this.entries.set(k, v);
    }

    /**
     * Resolve full `Tool` records for a list of `ToolCatalogEntry` records.
     *
     * Returns Tools in the same order as the input. Cache hits avoid
     * the round trip; misses trigger a single batched `tools/describe`.
     */
    public async materialize(entries: readonly ToolCatalogEntry[], request: RequestFn): Promise<Tool[]> {
        await this.ensureLoaded();

        // First pass: identify hits and misses.
        const result: (Tool | undefined)[] = new Array(entries.length);
        const missingNames: string[] = [];
        const missingPositions: number[] = [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i]!;
            const cached = this.entries.get(this.key(entry.name, entry.schemaHash));
            if (cached) {
                result[i] = cached;
            } else {
                missingNames.push(entry.name);
                missingPositions.push(i);
            }
        }

        // Single batched describe for misses.
        if (missingNames.length > 0) {
            const { tools } = await describeTools(request, { names: missingNames });
            if (tools.length !== missingNames.length) {
                throw new Error(
                    `tools/describe returned ${tools.length} tools for ${missingNames.length} names`
                );
            }
            for (let j = 0; j < tools.length; j++) {
                const tool = tools[j]!;
                const pos = missingPositions[j]!;
                const entry = entries[pos]!;
                this.entries.set(this.key(tool.name, entry.schemaHash), tool);
                result[pos] = tool;
            }

            const p = this.options.persistence;
            if (p) await p.save(this.options.serverIdentity, this.entries);
        }

        return result as Tool[];
    }

    /**
     * Invalidate cache entries whose hash no longer appears in the given
     * fresh catalog. Use after `notifications/tools/list_changed` plus a
     * fresh `tools/catalog` call.
     */
    public reconcile(freshCatalog: readonly ToolCatalogEntry[]): { evicted: number } {
        const valid = new Set<string>();
        for (const e of freshCatalog) valid.add(this.key(e.name, e.schemaHash));

        let evicted = 0;
        for (const k of this.entries.keys()) {
            if (k.startsWith(`${this.options.serverIdentity}::`) && !valid.has(k)) {
                this.entries.delete(k);
                evicted++;
            }
        }
        return { evicted };
    }

    /** Visible for testing. */
    public _size(): number {
        return this.entries.size;
    }
}
