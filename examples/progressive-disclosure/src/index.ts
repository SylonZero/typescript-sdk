/**
 * Progressive Tool Disclosure — public entry point.
 *
 * Re-exports every public symbol from the `src/` modules. Importing
 * from this barrel is the recommended entry point for adopters; see
 * `API.md` in the parent directory for the full reference and
 * `INTEGRATION.md` for adoption recipes.
 */

export * from './types.js';
export { canonicalize } from './canonicalJson.js';
export { computeSchemaHash } from './schemaHash.js';
export {
    ProgressiveDisclosureServer,
    type ProgressiveDisclosureServerOptions,
    type QueryMatcher
} from './server.js';
export {
    listToolsCatalog,
    describeTools,
    ProgressiveDisclosureCache,
    type ProgressiveDisclosureCacheOptions,
    type CachePersistence,
    type RequestFn
} from './client.js';
