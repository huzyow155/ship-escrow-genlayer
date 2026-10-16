# Ship Escrow - Honest Limitations and Trade-offs

This document outlines the known boundaries, failure modes, and trade-offs of the Ship Escrow intelligent contract on GenLayer Studionet. These limitations are intentional architectural constraints and must be understood before deploying or integrating.

---

### 1. No Code Execution or Test Execution
Ship Escrow evaluates code strictly through static textual artifacts (the PR diff and metadata) interpreted by deterministic structural analysis and an LLM. It does not execute the code, run compilers, build binaries, or execute test suites. It cannot detect dynamic bugs, infinite loops, runtime memory leaks, or behavioral flaws that only dynamic execution would reveal.

### 2. Diff Cap and Truncation Behavior
To maintain consensus stability and GenVM gas/memory bounds, PR diffs are capped at 14,000 characters. If a diff exceeds this cap, it is deterministically truncated along file boundaries with a `[TRUNCATED]` marker. Under truncated conditions:
- The maximum verdict is capped at `RELEASE_50`.
- Any MUST criterion that the LLM does not mark as an explicit `YES` yields a `REVIEW` verdict rather than auto-release.
Large PRs spanning thousands of lines should be split into smaller, modular pull requests to be fully evaluated.

### 3. GitHub Availability and Rate Limits
Ship Escrow relies on reading public PR artifacts via HTTP from GitHub (`github.com/<owner>/<repo>/pull/<n>.diff` and metadata via `.patch` or API). If GitHub experiences outages, network latency spikes, or IP rate-limiting, validator fetches may fail.
- Fetch failures and non-200 responses are treated as contract `UserError`, NOT as negative verdicts (`REFUND`).
- This ensures network outages never unfairly burn developer attempt counts or trigger unintended forfeits.

### 4. Accounting Ledger, Not Token Custody
Ship Escrow implements an internal credit accounting ledger. Amounts are tracked as balance credits (`TreeMap[str, str]`) on Studionet. No actual ERC-20 tokens or native GEN coins are locked in cryptographic custody or debited from external wallets upon creation. Payouts and refunds credit balances within the contract state.

### 5. No Time Dimension (No Deadlines)
GenVM contracts do not have a trusted native clock or timestamp oracle on Studionet. Consequently, Ship Escrow does not enforce expiry timestamps, submission deadlines, or timeout-based auto-refunds. Bounty creators retain the right to cancel an open bounty if no valid submission has settled it.

### 6. Validator Majority Consensus, Not Absolute Determinism
While structural facts and gate checks are purely deterministic, borderline code evaluations rely on an LLM called across multiple independent validators. While GenLayer enforces consensus across validator executions via `strict_eq`, non-deterministic edge cases may lead to validators disagreeing (`MAJORITY_DISAGREE`), triggering retry or non-acceptance.

### 7. Criteria Quality Sensitivity
The accuracy of the evaluation depends heavily on the clarity, specificity, and testability of the creator's written acceptance criteria. Vague requirements like "make it good" or "refactor nicely" can lead to `UNCLEAR` or divergent interpretations.

### 8. Attempt Limits (Max 3 Attempts)
Each bounty allows up to 3 evaluation attempts. If 3 submissions fail to reach a `RELEASE_x` verdict, the bounty transitions to `EXHAUSTED`. Once exhausted, the bounty creator can invoke `refund_exhausted` to reclaim escrowed credits.

### 9. Sybil Submissions / Address Separation
The contract strictly forbids the creator from submitting to their own bounty (`gl.message.sender_address.as_hex != creator`). However, like all permissionless blockchain systems without proof-of-humanity, a creator could theoretically use a secondary address. The transparent submission log and public reputation scores serve as social disincentives.

### 10. Public Repositories Only
Because validators must fetch diffs and commit metadata over public HTTPS without private credentials or OAuth bearer tokens, Ship Escrow strictly supports public GitHub repositories. Private repositories and enterprise on-premise instances are out of scope.
