# GenLayer Studionet Runtime Diagnostic Notes (Milestone 0 Probe)

This document contains empirical findings and benchmarks recorded directly from the execution of the `Probe` contract (`0x1f5545920bff1a7ca41cF935F87f689985976A14`, deploy tx `0x0f537f07ba4aa362239b540f5174bbe24dcdc70fdf0fb982f682319832cfe024`) on GenLayer Studionet (Chain ID 61999).

---

## 1. Summary of Confirmed Runtime Facts

| Probe Target | Observed Behavior | Status / Notes |
| :--- | :--- | :--- |
| **Contract Deployment** | Succeeded in 7.04s | `status_name: ACCEPTED`, `result_name: MAJORITY_AGREE`, `leader execution_result: SUCCESS` |
| **Sender Accessor** | `gl.message.sender_address.as_hex` | Returned caller hex `0xc65Fe5142D02933Ed61e50F54515E9F3F518703E` matching throwaway address |
| **Public View Return Types** | `bool`, `str`, `list[str]` | Native support confirmed without error: `probe_bool` returned `true`, `probe_str` returned `"studionet_probe_ok"`, `probe_list` returned `["alpha", "beta", "gamma"]` |
| **Standard Library Module Imports** | Module-level import works | `import json`, `import hashlib`, `import re`, `import urllib.parse`, `import ipaddress` all loaded and executed successfully at top-level |
| **`gl.eq_principle.strict_eq`** | Reliable consensus agreement | Evaluated multiple write methods with stringified return values; all reached `MAJORITY_AGREE` |
| **`gl.nondet.exec_prompt`** | Returns plain text string | Model returned JSON with standard markdown code fences (e.g. ````json ... ````); stripped cleanly via `.replace()` |
| **Diff Stability Across Fetches** | 100% byte-for-byte stable | 2 fetches in one write yielded identical SHA-256 (`ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c`) |
| **Consecutive Fetch Rate Limits** | 5 consecutive fetches at 200 OK | Zero rate-limiting observed on GitHub `.diff` endpoints; response sizes and hashes identical |

---

## 2. Web Target Diagnostics (`gl.nondet.web.get`)

All targets were evaluated inside non-deterministic blocks through `strict_eq`:

1. **GitHub PR Diff (`https://github.com/huzyow155/ship-escrow-fixtures/pull/2.diff`)**:
   - Status: `200`
   - Content Length: `1,077 bytes`
   - SHA-256: `ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c`
   - Execution Time: `15.29s`

2. **GitHub PR Patch (`https://github.com/huzyow155/ship-escrow-fixtures/pull/2.patch`)**:
   - Status: `200`
   - Content Length: `1,524 bytes`
   - SHA-256: `f14e6142b406df3424305eeaf40289c418fc940e621c1a28d98b764971650dc3`
   - Header Content: First line contains commit SHA directly (`From 5db0441e76af93606fd82feebbe49c5a2f145326 Mon Sep 17 00:00:00 2001`)
   - Execution Time: `11.80s`

3. **GitHub API (`https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/2`)**:
   - Status: `200`
   - Content Length: `16,595 bytes`
   - Execution Time: `8.52s`
   - Note: Unauthenticated GitHub API requests carry strict 60 requests/hour IP quotas. Using the `.patch` endpoint as Source B provides higher resilience against shared validator IP exhaustion.

4. **Raw GitHub User Content (`https://raw.githubusercontent.com/.../README.md`)**:
   - Status: `200`
   - Content Length: `133 bytes`
   - Execution Time: `11.99s`

5. **Large Public Web Page (Wikipedia Main Page)**:
   - Status: `200`
   - Content Length: `258,665 bytes`
   - Execution Time: `8.41s`
   - Proves GenVM handles 250+ KB responses without gas exhaustion or buffer crashes.

6. **Missing PR (HTTP 404)**:
   - Status: `404`
   - Content Length: `9 bytes` (`"Not Found"`)
   - Execution Time: `11.82s`
   - Confirms non-200 responses return status code and short body without crashing the VM.

---

## 3. Five-Fetch Consecutive Rate-Limit Test

Five consecutive write transactions fetching `pull/2.diff`:

| Fetch # | Latency (s) | HTTP Status | Response Length | SHA-256 Hash |
| :---: | :---: | :---: | :---: | :---: |
| 1 | 12.15 | 200 | 1,077 bytes | `ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c` |
| 2 | 11.66 | 200 | 1,077 bytes | `ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c` |
| 3 | 11.63 | 200 | 1,077 bytes | `ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c` |
| 4 | 11.95 | 200 | 1,077 bytes | `ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c` |
| 5 | 11.67 | 200 | 1,077 bytes | `ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c` |

Byte stability is absolute. No rate-limiting triggered across consecutive requests.

---

## 4. LLM Execution Latency Benchmarks

Tested with different diff excerpt lengths passed to `gl.nondet.exec_prompt`:

| Diff Size Attached | Leader Latency (s) | Model Output | Consensus Result |
| :---: | :---: | :---: | :---: |
| 0 bytes (instructions only) | 15.11 | `{"results": ["YES", "YES"]}` | `MAJORITY_AGREE` |
| 1,000 bytes diff | 28.36 | `{"results": ["YES", "YES"]}` | `MAJORITY_AGREE` |
| 3,000 bytes diff | 21.77 | `{"results": ["YES", "YES"]}` | `MAJORITY_AGREE` |

LLM execution adds ~10 to 20 seconds overhead on top of deterministic execution (~8 to 11s).

---

## 5. Value Transfer / Payable Check

GenVM Intelligent Contracts operate in a deterministic sandbox without native ERC-20 or native gas asset custody primitives. There is no `gl.message.value` balance transfer API in the runtime header (`v0.2.16`). Consequently, token custody is an anti-pattern on Studionet; Ship Escrow's internal credit ledger (`balances: TreeMap[str, str]`) is the correct, intended accounting architecture.

---

## 6. Decision Gate Outcome

- GitHub `.diff` endpoints return HTTP 200 with 100% byte-stable responses across repeated validator executions.
- Diff SHA-256 stability allows including the evidence hash (`<VERDICT>|<diff_sha16>`) in the consensus comparison string.
- Decision Gate: **PASSED (UNBLOCKED)**. Proceeding directly to Milestone 1.
