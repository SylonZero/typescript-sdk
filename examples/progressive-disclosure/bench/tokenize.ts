/**
 * Token cost measurement for the benchmark.
 *
 * Primary tokenizer: `cl100k_base` via `js-tiktoken`. This is the
 * encoding used by GPT-3.5-turbo, GPT-4, GPT-4o, and is a reasonable
 * proxy for Anthropic's tokenizer on schema-heavy payloads (the two
 * differ by single-digit percentages on JSON-shaped content). For the
 * SEP's purposes — proving relative reduction — cl100k_base is the
 * defensible default.
 *
 * Two heuristic estimators are retained for reference, clearly
 * marked as legacy. They were used during early development to
 * sanity-check the tiktoken numbers and remain in the file so
 * reviewers can see the relative magnitudes.
 */

import { getEncoding, type Tiktoken } from 'js-tiktoken';

let _enc: Tiktoken | undefined;

function enc(): Tiktoken {
    if (!_enc) _enc = getEncoding('cl100k_base');
    return _enc;
}

/**
 * Primary tokenizer used by the benchmark.
 *
 * Returns the exact number of cl100k_base tokens for the input string.
 * Backed by `js-tiktoken`. Idempotent and deterministic.
 */
export function countTokensTiktoken(s: string): number {
    return enc().encode(s).length;
}

/**
 * Legacy heuristic: ~4 chars/token (GPT-style English rule of thumb).
 * Conservative for JSON-heavy payloads (which tokenize denser than
 * English prose). Retained for comparison against the tiktoken
 * baseline; not used for SEP-published numbers.
 */
export function estimateTokensCharsDiv4(s: string): number {
    return Math.ceil(s.length / 4);
}

/**
 * Legacy heuristic: counts JSON delimiter characters (`{}[]:,`) as one
 * token each plus ~3.5 chars/token for the rest. Closer to cl100k_base
 * on schema payloads than the chars/4 rule of thumb. Retained for
 * comparison against the tiktoken baseline; not used for SEP-published
 * numbers.
 */
export function estimateTokensJsonAware(s: string): number {
    let delimiters = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (c === '{' || c === '}' || c === '[' || c === ']' || c === ':' || c === ',') {
            delimiters++;
        }
    }
    const remainingChars = s.length - delimiters;
    return delimiters + Math.ceil(remainingChars / 3.5);
}

export type TokenCounter = (s: string) => number;

/** Backward-compatible alias kept for any older imports. */
export type TokenEstimator = TokenCounter;
