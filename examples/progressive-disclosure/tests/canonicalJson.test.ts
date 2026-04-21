import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/canonicalJson.js';

describe('canonicalize', () => {
    it('serializes primitives', () => {
        expect(canonicalize(null)).toBe('null');
        expect(canonicalize(true)).toBe('true');
        expect(canonicalize(false)).toBe('false');
        expect(canonicalize(0)).toBe('0');
        expect(canonicalize(42)).toBe('42');
        expect(canonicalize(-3.14)).toBe('-3.14');
        expect(canonicalize('hello')).toBe('"hello"');
    });

    it('escapes strings via JSON.stringify rules', () => {
        expect(canonicalize('with "quotes"')).toBe('"with \\"quotes\\""');
        expect(canonicalize('tab\there')).toBe('"tab\\there"');
        expect(canonicalize('emoji 🎉')).toBe('"emoji 🎉"');
    });

    it('rejects non-finite numbers', () => {
        expect(() => canonicalize(NaN)).toThrow(TypeError);
        expect(() => canonicalize(Infinity)).toThrow(TypeError);
    });

    it('serializes arrays positionally', () => {
        expect(canonicalize([1, 2, 3])).toBe('[1,2,3]');
        expect(canonicalize(['b', 'a'])).toBe('["b","a"]'); // arrays NOT sorted
    });

    it('sorts object keys lexicographically', () => {
        expect(canonicalize({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
        expect(canonicalize({ z: 1, A: 2 })).toBe('{"A":2,"z":1}'); // uppercase < lowercase
    });

    it('produces identical output regardless of input key order', () => {
        const a = { x: 1, y: { b: 2, a: 1 }, z: [3, 1, 2] };
        const b = { z: [3, 1, 2], y: { a: 1, b: 2 }, x: 1 };
        expect(canonicalize(a)).toBe(canonicalize(b));
    });

    it('omits undefined-valued properties', () => {
        expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
    });

    it('preserves null-valued properties', () => {
        expect(canonicalize({ a: null })).toBe('{"a":null}');
    });

    it('handles deep nesting', () => {
        const deep = { a: { b: { c: { d: [{ e: 'f' }] } } } };
        expect(canonicalize(deep)).toBe('{"a":{"b":{"c":{"d":[{"e":"f"}]}}}}');
    });

    it('produces zero-whitespace output', () => {
        const out = canonicalize({ a: 1, b: [2, 3], c: { d: 4 } });
        expect(out).not.toMatch(/\s/);
    });
});
