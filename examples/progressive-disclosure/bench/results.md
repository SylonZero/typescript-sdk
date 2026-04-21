# Progressive Tool Disclosure — Benchmark

Catalog: 37 synthetic tools modelled on the MindStaq MCP service
Domains: projects, tasks, issues, OKRs, meta (auth/workspace/comments/activity)

Scenario                                     Bytes   Tokens (chars/4)  Tokens (JSON-aware)
-------------------------------------------  ------  ----------------  -------------------
Baseline tools/list (n=37)                   20,709  5,178             7,882              
tools/catalog only (n=37)                    9,639   2,410             3,289              
tools/catalog + tools/describe(k=0)          9,639   2,410             3,289              
tools/catalog + tools/describe(k=1)          10,796  2,699             3,714              
tools/catalog + tools/describe(k=2)          11,206  2,802             3,871              
tools/catalog + tools/describe(k=3)          11,771  2,943             4,089              
tools/catalog + tools/describe(k=5)          12,938  3,235             4,528              
tools/catalog + tools/describe(k=10)         16,654  4,164             5,928              
Steady state (full cache hit, catalog only)  9,639   2,410             3,289              

## Savings vs baseline (chars/4 estimate)

| Scenario | Tokens | Savings vs baseline |
|---|---:|---:|
| tools/catalog only (n=37) | 2,410 | 53.5% |
| tools/catalog + tools/describe(k=0) | 2,410 | 53.5% |
| tools/catalog + tools/describe(k=1) | 2,699 | 47.9% |
| tools/catalog + tools/describe(k=2) | 2,802 | 45.9% |
| tools/catalog + tools/describe(k=3) | 2,943 | 43.2% |
| tools/catalog + tools/describe(k=5) | 3,235 | 37.5% |
| tools/catalog + tools/describe(k=10) | 4,164 | 19.6% |
| Steady state (full cache hit, catalog only) | 2,410 | 53.5% |

## Markdown table (paste-ready for SEP §Performance)

| Scenario | Bytes | Tokens (chars/4) | Tokens (JSON-aware) |
|---|---:|---:|---:|
| Baseline tools/list (n=37) | 20,709 | 5,178 | 7,882 |
| tools/catalog only (n=37) | 9,639 | 2,410 | 3,289 |
| tools/catalog + tools/describe(k=0) | 9,639 | 2,410 | 3,289 |
| tools/catalog + tools/describe(k=1) | 10,796 | 2,699 | 3,714 |
| tools/catalog + tools/describe(k=2) | 11,206 | 2,802 | 3,871 |
| tools/catalog + tools/describe(k=3) | 11,771 | 2,943 | 4,089 |
| tools/catalog + tools/describe(k=5) | 12,938 | 3,235 | 4,528 |
| tools/catalog + tools/describe(k=10) | 16,654 | 4,164 | 5,928 |
| Steady state (full cache hit, catalog only) | 9,639 | 2,410 | 3,289 |

## Notes on tokenizer choice

- "chars/4" is the conservative GPT-style heuristic for English-dominated text.
- "JSON-aware" treats `{}[]:,` as 1 token each + ~3.5 chars/token for the rest;
  empirically closer to cl100k_base on schema-heavy payloads.
- For final SEP numbers, re-run with a real tokenizer (tiktoken/anthropic-tokenizer).
