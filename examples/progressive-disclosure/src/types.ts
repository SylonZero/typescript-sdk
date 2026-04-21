/**
 * Progressive Tool Disclosure — type definitions.
 *
 * Wire-format types corresponding to SEP-XXXX §2 and §3.
 * These intentionally mirror the structure of the existing MCP `Tool`
 * type so that the same record can be canonicalized and hashed for
 * `IndexedTool.schemaHash`.
 */

// -----------------------------------------------------------------------------
// Method names and capability key.
// -----------------------------------------------------------------------------

export const METHOD_TOOLS_INDEX = 'tools/index' as const;
export const METHOD_TOOLS_DESCRIBE = 'tools/describe' as const;

/** Capability key advertised under `serverCapabilities.tools`. */
export const CAPABILITY_KEY = 'progressiveDisclosure' as const;

// -----------------------------------------------------------------------------
// The full Tool record (subset of MCP's Tool type used in this prototype).
//
// In the real SDK, this is `Tool` from `@modelcontextprotocol/sdk`. We
// reproduce a minimal compatible shape here so the prototype is
// dependency-free for ease of evaluation.
// -----------------------------------------------------------------------------

export interface ToolAnnotations {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    [k: string]: unknown;
}

export interface JsonSchema {
    type?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    enum?: unknown[];
    description?: string;
    additionalProperties?: boolean | JsonSchema;
    [k: string]: unknown;
}

export interface Tool {
    name: string;
    title?: string;
    description?: string;
    inputSchema: JsonSchema;
    outputSchema?: JsonSchema;
    annotations?: ToolAnnotations;
}

// -----------------------------------------------------------------------------
// IndexedTool — the cheap discovery record.
// -----------------------------------------------------------------------------

export interface IndexedTool {
    name: string;
    title?: string;
    /**
     * Single-sentence description suitable for an LLM's tool catalog.
     * SHOULD be ≤ 200 characters.
     */
    summary: string;
    tags?: string[];
    /**
     * Lowercase hex SHA-256 of the canonical JSON serialization of the
     * full `Tool`. See `schemaHash.ts` for the exact algorithm.
     */
    schemaHash: string;
    annotations?: ToolAnnotations;
}

// -----------------------------------------------------------------------------
// Request / response shapes for the new methods.
// -----------------------------------------------------------------------------

export interface ListIndexedToolsRequestParams {
    cursor?: string;
    /** Opaque search string. Server-defined semantics. */
    query?: string;
}

export interface ListIndexedToolsResult {
    tools: IndexedTool[];
    nextCursor?: string;
}

export interface DescribeToolsRequestParams {
    /** One or more tool names. Order is preserved in the response. */
    names: string[];
}

export interface DescribeToolsResult {
    tools: Tool[];
}

// -----------------------------------------------------------------------------
// Capability declaration.
// -----------------------------------------------------------------------------

export interface ProgressiveDisclosureCapability {
    /**
     * Reserved for future granularity. Today this is a marker — presence
     * means the server supports `tools/index`, `tools/describe`, the
     * `query` parameter, and `schemaHash` consistency.
     */
    enabled: true;
}

// -----------------------------------------------------------------------------
// Errors.
// -----------------------------------------------------------------------------

/** JSON-RPC error code returned by `tools/describe` for unknown names. */
export const ERR_UNKNOWN_TOOL_NAMES = -32602;

export class UnknownToolNamesError extends Error {
    public readonly code = ERR_UNKNOWN_TOOL_NAMES;
    public readonly data: { unknownNames: string[] };

    constructor(unknownNames: string[]) {
        super(`Unknown tool names: ${unknownNames.join(', ')}`);
        this.name = 'UnknownToolNamesError';
        this.data = { unknownNames };
    }
}
