/**
 * Benchmark — compares baseline `tools/list` cost vs the progressive
 * `tools/catalog` + `tools/describe(k)` flow.
 *
 * Run: pnpm bench  (or: tsx bench/runBench.ts)
 *
 * Output is a markdown table suitable for pasting into the SEP and a
 * second cleartext table for stdout readability.
 */

import { ProgressiveDisclosureServer } from '../src/server.js';
import type { Tool } from '../src/types.js';
import { SAMPLE_TOOLS } from './sampleTools.js';
import { estimateTokensCharsDiv4, estimateTokensJsonAware, type TokenEstimator } from './tokenize.js';

interface Row {
    label: string;
    bytes: number;
    tokensCharsDiv4: number;
    tokensJsonAware: number;
}

function serializeBaseline(tools: Tool[]): string {
    // Approximates the wire format of `ListToolsResult` as the LLM sees it.
    return JSON.stringify({ tools });
}

function measure(label: string, payload: string, char4: TokenEstimator, jsonAware: TokenEstimator): Row {
    return {
        label,
        bytes: payload.length,
        tokensCharsDiv4: char4(payload),
        tokensJsonAware: jsonAware(payload)
    };
}

function table(rows: Row[]): string {
    const headers = ['Scenario', 'Bytes', 'Tokens (chars/4)', 'Tokens (JSON-aware)'];
    const widths = headers.map((h) => h.length);
    for (const r of rows) {
        widths[0] = Math.max(widths[0]!, r.label.length);
        widths[1] = Math.max(widths[1]!, r.bytes.toLocaleString().length);
        widths[2] = Math.max(widths[2]!, r.tokensCharsDiv4.toLocaleString().length);
        widths[3] = Math.max(widths[3]!, r.tokensJsonAware.toLocaleString().length);
    }
    const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ');
    const lines: string[] = [];
    lines.push(fmt(headers));
    lines.push(widths.map((w) => '-'.repeat(w)).join('  '));
    for (const r of rows) {
        lines.push(
            fmt([
                r.label,
                r.bytes.toLocaleString(),
                r.tokensCharsDiv4.toLocaleString(),
                r.tokensJsonAware.toLocaleString()
            ])
        );
    }
    return lines.join('\n');
}

function markdownTable(rows: Row[]): string {
    const lines: string[] = [];
    lines.push('| Scenario | Bytes | Tokens (chars/4) | Tokens (JSON-aware) |');
    lines.push('|---|---:|---:|---:|');
    for (const r of rows) {
        lines.push(
            `| ${r.label} | ${r.bytes.toLocaleString()} | ${r.tokensCharsDiv4.toLocaleString()} | ${r.tokensJsonAware.toLocaleString()} |`
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
rows.push(measure(`Baseline tools/list (n=${tools.length})`, baselinePayload, estimateTokensCharsDiv4, estimateTokensJsonAware));
rows.push(measure(`tools/catalog only (n=${tools.length})`, catalogPayload, estimateTokensCharsDiv4, estimateTokensJsonAware));

// Progressive scenarios for various k (number of tool schemas actually pulled this turn).
const ks = [0, 1, 2, 3, 5, 10];
for (const k of ks) {
    const names = tools.slice(0, k).map((t) => t.name);
    const describedPayload =
        k === 0 ? '' : JSON.stringify(server.describeTools({ names }));
    const combinedBytes = catalogPayload.length + describedPayload.length;
    rows.push({
        label: `tools/catalog + tools/describe(k=${k})`,
        bytes: combinedBytes,
        tokensCharsDiv4: estimateTokensCharsDiv4(catalogPayload + describedPayload),
        tokensJsonAware: estimateTokensJsonAware(catalogPayload + describedPayload)
    });
}

// Steady-state cache: catalog round-tripped, all schemas already cached.
// On a list_changed notification we still pay tools/catalog, but tools/describe
// is skipped entirely if no hashes changed.
rows.push({
    label: 'Steady state (full cache hit, catalog only)',
    bytes: catalogPayload.length,
    tokensCharsDiv4: estimateTokensCharsDiv4(catalogPayload),
    tokensJsonAware: estimateTokensJsonAware(catalogPayload)
});

console.log('# Progressive Tool Disclosure — Benchmark');
console.log();
console.log(`Catalog: ${tools.length} synthetic tools modelled on the MindStaq MCP service`);
console.log(`Domains: projects, tasks, issues, OKRs, meta (auth/workspace/comments/activity)`);
console.log();
console.log(table(rows));
console.log();

// Per-scenario savings vs baseline.
const baseline = rows[0]!;
console.log('## Savings vs baseline (chars/4 estimate)');
console.log();
const savingsRows: string[] = [];
savingsRows.push('| Scenario | Tokens | Savings vs baseline |');
savingsRows.push('|---|---:|---:|');
for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const saved = baseline.tokensCharsDiv4 - r.tokensCharsDiv4;
    savingsRows.push(`| ${r.label} | ${r.tokensCharsDiv4.toLocaleString()} | ${pct(saved, baseline.tokensCharsDiv4)} |`);
}
console.log(savingsRows.join('\n'));
console.log();

console.log('## Markdown table (paste-ready for SEP §Performance)');
console.log();
console.log(markdownTable(rows));
console.log();

console.log('## Notes on tokenizer choice');
console.log();
console.log('- "chars/4" is the conservative GPT-style heuristic for English-dominated text.');
console.log('- "JSON-aware" treats `{}[]:,` as 1 token each + ~3.5 chars/token for the rest;');
console.log('  empirically closer to cl100k_base on schema-heavy payloads.');
console.log('- For final SEP numbers, re-run with a real tokenizer (tiktoken/anthropic-tokenizer).');
