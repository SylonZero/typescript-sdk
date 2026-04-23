/**
 * Benchmark — compares baseline `tools/list` cost vs the progressive
 * `tools/catalog` + `tools/describe(k)` flow.
 *
 * Run: pnpm bench  (or: tsx bench/runBench.ts)
 *
 * Primary tokenizer is cl100k_base via js-tiktoken (the encoding used
 * by GPT-3.5-turbo, GPT-4, GPT-4o; close enough to Anthropic's tokenizer
 * on schema payloads to be a defensible proxy for SEP-published numbers).
 *
 * Output is a markdown table suitable for pasting into the SEP plus a
 * second cleartext table for stdout readability.
 */

import { ProgressiveDisclosureServer } from '../src/server.js';
import type { Tool } from '../src/types.js';
import { SAMPLE_TOOLS } from './sampleTools.js';
import {
    countTokensTiktoken,
    estimateTokensCharsDiv4,
    estimateTokensJsonAware
} from './tokenize.js';

interface Row {
    label: string;
    bytes: number;
    tokens: number;
    legacyCharsDiv4: number;
    legacyJsonAware: number;
}

function serializeBaseline(tools: Tool[]): string {
    // Approximates the wire format of `ListToolsResult` as the LLM sees it.
    return JSON.stringify({ tools });
}

function measure(label: string, payload: string): Row {
    return {
        label,
        bytes: payload.length,
        tokens: countTokensTiktoken(payload),
        legacyCharsDiv4: estimateTokensCharsDiv4(payload),
        legacyJsonAware: estimateTokensJsonAware(payload)
    };
}

/**
 * Render the primary stdout table. Three columns: label, bytes, tokens
 * (cl100k_base). The two legacy heuristics get a separate "for reference"
 * table later.
 */
function table(rows: Row[]): string {
    const headers = ['Scenario', 'Bytes', 'Tokens (cl100k_base)'];
    const widths = headers.map((h) => h.length);
    for (const r of rows) {
        widths[0] = Math.max(widths[0]!, r.label.length);
        widths[1] = Math.max(widths[1]!, r.bytes.toLocaleString().length);
        widths[2] = Math.max(widths[2]!, r.tokens.toLocaleString().length);
    }
    const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ');
    const lines: string[] = [];
    lines.push(fmt(headers));
    lines.push(widths.map((w) => '-'.repeat(w)).join('  '));
    for (const r of rows) {
        lines.push(fmt([r.label, r.bytes.toLocaleString(), r.tokens.toLocaleString()]));
    }
    return lines.join('\n');
}

function markdownTable(rows: Row[]): string {
    const lines: string[] = [];
    lines.push('| Scenario | Bytes | Tokens (cl100k_base) | Savings vs baseline |');
    lines.push('|---|---:|---:|---:|');
    const baselineTokens = rows[0]!.tokens;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i]!;
        const savings =
            i === 0 ? '—' : pct(baselineTokens - r.tokens, baselineTokens);
        lines.push(
            `| ${r.label} | ${r.bytes.toLocaleString()} | ${r.tokens.toLocaleString()} | ${savings} |`
        );
    }
    return lines.join('\n');
}

/**
 * Auxiliary table comparing the cl100k_base measurement against the two
 * legacy heuristics. Useful for reviewers who want to see how close the
 * heuristics get to a real tokenizer.
 */
function comparisonTable(rows: Row[]): string {
    const lines: string[] = [];
    lines.push('| Scenario | tiktoken | chars/4 (legacy) | JSON-aware (legacy) |');
    lines.push('|---|---:|---:|---:|');
    for (const r of rows) {
        lines.push(
            `| ${r.label} | ${r.tokens.toLocaleString()} | ${r.legacyCharsDiv4.toLocaleString()} | ${r.legacyJsonAware.toLocaleString()} |`
        );
    }
    return lines.join('\n');
}

function pct(part: number, whole: number): string {
    if (whole === 0) return '0%';
    return ((part / whole) * 100).toFixed(1) + '%';
}

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

const tools = SAMPLE_TOOLS;
const server = new ProgressiveDisclosureServer(tools);

// Build the catalog payload as a client would see it.
const catalogResult = server.listToolsCatalog();
const catalogPayload = JSON.stringify(catalogResult);

// Baseline: `tools/list` ships every full Tool.
const baselinePayload = serializeBaseline(tools);

const rows: Row[] = [];
rows.push(measure(`Baseline tools/list (n=${tools.length})`, baselinePayload));
rows.push(measure(`tools/catalog only (n=${tools.length})`, catalogPayload));

// Progressive scenarios for various k (number of tool schemas actually pulled this turn).
const ks = [0, 1, 2, 3, 5, 10];
for (const k of ks) {
    const names = tools.slice(0, k).map((t) => t.name);
    const describedPayload =
        k === 0 ? '' : JSON.stringify(server.describeTools({ names }));
    const combined = catalogPayload + describedPayload;
    rows.push({
        label: `tools/catalog + tools/describe(k=${k})`,
        bytes: combined.length,
        tokens: countTokensTiktoken(combined),
        legacyCharsDiv4: estimateTokensCharsDiv4(combined),
        legacyJsonAware: estimateTokensJsonAware(combined)
    });
}

// Steady-state cache: catalog round-tripped, all schemas already cached.
// On a list_changed notification we still pay tools/catalog, but tools/describe
// is skipped entirely if no hashes changed.
rows.push(measure('Steady state (full cache hit, catalog only)', catalogPayload));

console.log('# Progressive Tool Disclosure — Benchmark');
console.log();
console.log(`Catalog: ${tools.length} synthetic tools modelled on the MindStaq MCP service`);
console.log(`Domains: projects, tasks, issues, OKRs, meta (auth/workspace/comments/activity)`);
console.log(`Tokenizer: cl100k_base via js-tiktoken (proxy for GPT-3.5/4/4o; reasonable proxy for Anthropic on JSON payloads)`);
console.log();
console.log(table(rows));
console.log();

console.log('## Markdown table (paste-ready for SEP §Performance)');
console.log();
console.log(markdownTable(rows));
console.log();

console.log('## Heuristic comparison (reference — not used for SEP numbers)');
console.log();
console.log(comparisonTable(rows));
console.log();

console.log('## Notes');
console.log();
console.log('- Primary tokenizer: cl100k_base via js-tiktoken. This is the encoding');
console.log('  used by GPT-3.5-turbo, GPT-4, and GPT-4o, and is a reasonable proxy');
console.log('  for Anthropic\'s tokenizer on schema-heavy payloads (the two differ by');
console.log('  single-digit percentages on JSON-shaped content).');
console.log('- The two legacy heuristic estimators (chars/4 and JSON-aware) are');
console.log('  retained in `bench/tokenize.ts` for sanity-check comparison only.');
console.log('  All numbers cited in the SEP are the tiktoken column.');
