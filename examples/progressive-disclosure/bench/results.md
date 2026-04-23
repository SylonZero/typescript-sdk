# Progressive Tool Disclosure — Benchmark

Catalog: 37 synthetic tools modelled on the MindStaq MCP service
Domains: projects, tasks, issues, OKRs, meta (auth/workspace/comments/activity)
Tokenizer: cl100k_base via js-tiktoken (proxy for GPT-3.5/4/4o; reasonable proxy for Anthropic on JSON payloads)

Scenario                                     Bytes   Tokens (cl100k_base)
-------------------------------------------  ------  --------------------
Baseline tools/list (n=37)                   20,709  5,238               
tools/catalog only (n=37)                    9,639   2,919               
tools/catalog + tools/describe(k=0)          9,639   2,919               
tools/catalog + tools/describe(k=1)          10,796  3,223               
tools/catalog + tools/describe(k=2)          11,206  3,323               
tools/catalog + tools/describe(k=3)          11,771  3,458               
tools/catalog + tools/describe(k=5)          12,938  3,767               
tools/catalog + tools/describe(k=10)         16,654  4,732               
Steady state (full cache hit, catalog only)  9,639   2,919               

## Markdown table (paste-ready for SEP §Performance)

| Scenario | Bytes | Tokens (cl100k_base) | Savings vs baseline |
|---|---:|---:|---:|
| Baseline tools/list (n=37) | 20,709 | 5,238 | — |
| tools/catalog only (n=37) | 9,639 | 2,919 | 44.3% |
| tools/catalog + tools/describe(k=0) | 9,639 | 2,919 | 44.3% |
| tools/catalog + tools/describe(k=1) | 10,796 | 3,223 | 38.5% |
| tools/catalog + tools/describe(k=2) | 11,206 | 3,323 | 36.6% |
| tools/catalog + tools/describe(k=3) | 11,771 | 3,458 | 34.0% |
| tools/catalog + tools/describe(k=5) | 12,938 | 3,767 | 28.1% |
| tools/catalog + tools/describe(k=10) | 16,654 | 4,732 | 9.7% |
| Steady state (full cache hit, catalog only) | 9,639 | 2,919 | 44.3% |

## Heuristic comparison (reference — not used for SEP numbers)

| Scenario | tiktoken | chars/4 (legacy) | JSON-aware (legacy) |
|---|---:|---:|---:|
| Baseline tools/list (n=37) | 5,238 | 5,178 | 7,882 |
| tools/catalog only (n=37) | 2,919 | 2,410 | 3,289 |
| tools/catalog + tools/describe(k=0) | 2,919 | 2,410 | 3,289 |
| tools/catalog + tools/describe(k=1) | 3,223 | 2,699 | 3,714 |
| tools/catalog + tools/describe(k=2) | 3,323 | 2,802 | 3,871 |
| tools/catalog + tools/describe(k=3) | 3,458 | 2,943 | 4,089 |
| tools/catalog + tools/describe(k=5) | 3,767 | 3,235 | 4,528 |
| tools/catalog + tools/describe(k=10) | 4,732 | 4,164 | 5,928 |
| Steady state (full cache hit, catalog only) | 2,919 | 2,410 | 3,289 |

## Notes

- Primary tokenizer: cl100k_base via js-tiktoken. This is the encoding
  used by GPT-3.5-turbo, GPT-4, and GPT-4o, and is a reasonable proxy
  for Anthropic's tokenizer on schema-heavy payloads (the two differ by
  single-digit percentages on JSON-shaped content).
- The two legacy heuristic estimators (chars/4 and JSON-aware) are
  retained in `bench/tokenize.ts` for sanity-check comparison only.
  All numbers cited in the SEP are the tiktoken column.
