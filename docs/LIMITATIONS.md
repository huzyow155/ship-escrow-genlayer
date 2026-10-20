# Ship Escrow V2 - Honest Limitations & Trust Boundaries

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants (`total_balances + total_escrowed == total_minted`). They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

This document outlines the architectural trust assumptions, honest boundaries, and deliberate constraints of Ship Escrow V2 on GenLayer Studionet.

---

## 1. Trust Assumptions & Attribution Binding

### PR Body Wallet Marker (`ship-escrow-wallet: 0x<address>`)
- **Mechanism**: The submitter must ensure the PR body on GitHub contains the exact line:
  ```
  ship-escrow-wallet: 0x<caller_address>
  ```
- **Trust Model**: Ship Escrow trusts GitHub's access control: only the PR creator or repository maintainers with write permissions can edit the PR body.
- **Threat Mitigated**: Third parties cannot observe an open PR and submit it to claim another contributor's reward (attempt fails before consensus with `"Pull request is not bound to the submitting wallet"`).
- **Residual Risk**: A malicious repository maintainer could theoretically edit a contributor's PR description on GitHub to hijack attribution before on-chain submission. Contributors should submit on-chain immediately after opening their pull request.

---

## 2. GitHub REST API & Rate Limits

- **Unauthenticated Endpoint Usage**: Validators independently query `https://api.github.com/repos/<owner>/<repo>/pulls/<n>`. Unauthenticated requests on GitHub are subject to IP-based rate limits (60 requests per hour per egress IP).
- **Failure Mode**: If a validator experiences rate limiting or HTTP 403/404, the validator raises `gl.vm.UserError("Pull request metadata unavailable")`.
- **Safety Guarantee**: State mutations only happen after consensus. A rate limit failure causes the transaction to revert with zero credits debited and zero attempt counters consumed.

---

## 3. Same-Repository Pull Request Restriction

- **Requirement**: The pull request `head.repo.full_name` must equal `base.repo.full_name`.
- **Rationale**: Fetching immutable revision diffs via `https://github.com/<owner>/<repo>/compare/<base_sha>...<head_sha>.diff` requires both commits to reside within the same repository. Cross-fork compare diffs can produce ambiguous merge bases or 404 responses across independent validator network routes.
- **Integration Impact**: Bounties require contributors to push branches directly to the repository (e.g. feature branches) or maintainers to mirror fork branches before on-chain submission.

---

## 4. Stuck-Bounty Boundary (No On-Chain Clock)

- **Root Cause**: GenVM currently does not expose a deterministic block timestamp, transaction timestamp, or clock oracle (`gl.block`, `gl.transaction`, and `gl.message.timestamp` do not exist in the runtime; `time.time()` reads non-deterministic host system wall clocks).
- **Design Decision**: To prevent consensus divergence across validators with differing local clocks, Ship Escrow V2 does NOT invent or simulate a clock.
- **Cancel Boundary**: The bounty creator can invoke `cancel_bounty` ONLY while `attempts == 0`.
- **Trade-off**: If a developer submits work that yields `REVIEW` (payout 0%, attempts = 1), the creator cannot unilaterally cancel the bounty to reclaim escrowed funds. The bounty remains open until subsequent submissions either settle (`RELEASE_x`), reject (`REFUND`), or reach the total cap of 6 attempts (`EXHAUSTED`), at which point `refund_exhausted` unlocks the creator's deposit. This design prioritizes protecting developers against malicious maintainer cancellations over creator liquidity.

---

## 5. Diff Cap & Truncation Safety

- **14,000 Character Boundary**: Diff texts are capped at 14,000 characters to prevent GenVM out-of-memory faults and keep LLM context evaluation bounded.
- **Fail-Safe Rule**: If a diff is truncated, the contract strictly forbids releasing funds or failing on missing files. Any truncated diff evaluation automatically yields `REVIEW` with 0% payout.

---

## 6. Simulated Accounting Ledger, Not External Custody

- **Ledger Invariant**: Balances are conserved internally (`total_balances + total_escrowed == total_minted`).
- **No Native Token Custody**: No ERC-20 tokens, wrapped assets, or native gas coins are held in smart contract custody. The contract provides verifiable settlement accounting, not financial asset custody.
