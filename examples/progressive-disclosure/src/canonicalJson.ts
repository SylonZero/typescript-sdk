/**
 * Canonical JSON serialization — RFC 8785 (JCS) subset.
 *
 * Rules implemented:
 *   1. Object keys sorted lexicographically by UTF-16 code-unit order
 *      (matches JavaScript's String comparison and is equivalent to
 *      Unicode code-point order for the BMP, which covers all valid
 *      JSON object keys in practice).
 *   2. No insignificant whitespace.
 *   3. Strings escaped via JSON.stringify (RFC 8259-compatible).
 *   4. Numbers serialized via Number.prototype.toString, which is the
 *      shortest round-trip form for IEEE-754 doubles per ECMA-262.
 *
 * NOT implemented from full RFC 8785 (out of scope for this prototype):
 *   - `null` vs missing-property distinction normalization.
 *   - Special handling of -0 vs +0 (defaults to JS behaviour: both -> "0").
 *
 * The hash domain for Progressive Tool Disclosure is `Tool` records, which
 * never contain non-finite numbers, function values, or symbols, so this
 * subset is sufficient.
 */
export function canonicalize(value: unknown): string {
    if (value === null) return 'null';

    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';

        case 'number':
            if (!Number.isFinite(value)) {
                throw new TypeError(`Non-finite number cannot be canonicalized: ${value}`);
            }
            return Number(value).toString();

        case 'string':
            return JSON.stringify(value);

        case 'object': {
            if (Array.isArray(value)) {
                return '[' + value.map(canonicalize).join(',') + ']';
            }
            const obj = value as Record<string, unknown>;
            const keys = Object.keys(obj)
                .filter((k) => obj[k] !== undefined)
                .sort();
            const parts: string[] = [];
            for (const k of keys) {
                parts.push(JSON.stringify(k) + ':' + canonicalize(obj[k]));
            }
            return '{' + parts.join(',') + '}';
        }

        default:
            throw new TypeError(`Unsupported value type for canonicalization: ${typeof value}`);
    }
}
