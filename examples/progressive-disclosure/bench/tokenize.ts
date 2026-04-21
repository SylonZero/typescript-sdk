/**
 * Token cost estimator.
 *
 * For SEP discussion purposes we want directional numbers, not perfect
 * tokenization. Two estimators are provided:
 *
 * 1. `estimateTokensCharsDiv4(s)` — the well-known ~4 chars/token rule
 *    of thumb for English-dominated text. Conservative for JSON-heavy
 *    payloads (which actually tokenize to ~3 chars/token because of
 *    punctuation density).
 *
 * 2. `estimateTokensJsonAware(s)` — counts JSON delimiter characters
 *    (`{}[]:,`) as one token each plus ~3.5 chars/token for the rest.
 *    Closer to GPT-4o tokenization on schema payloads in informal
 *    measurement.
 *
 * Both are clearly labelled so reviewers can run their own tokenizer
 * (tiktoken, anthropic-tokenizer, cl100k_base) for confirmation.
 */

export function estimateTokensCharsDiv4(s: string): number {
    return Math.ceil(s.length / 4);
}

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

export type TokenEstimator = (s: string) => number;
