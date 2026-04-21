/**
 * Schema hash for ToolCatalogEntry.schemaHash.
 *
 * The hash is the lowercase hex SHA-256 digest of the canonical JSON
 * serialization of the full Tool record (including name, title,
 * description, inputSchema, outputSchema, annotations).
 */

import { createHash } from 'node:crypto';
import { canonicalize } from './canonicalJson.js';
import type { Tool } from './types.js';

/**
 * Compute the canonical schema hash for a Tool.
 *
 * The hash domain is the full Tool record. Two tools with the same
 * canonical serialization will produce identical hashes regardless of
 * encoding round-trips, key ordering on the wire, or whitespace.
 */
export function computeSchemaHash(tool: Tool): string {
    const canonical = canonicalize(tool);
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
