# Pre-Registration: Steward Round 1 Section 4 Attack & Lifecycle Proofs

> Status: **Pre-Registration (Committed Before Live Run)**  
> Target Contract: `ShipEscrowV2` at `0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  

This document pre-registers the exact expected sequence, callers, parameters, error messages, and state transitions for the six on-chain proof cases required in Section 4.

---

## 1. Case S4-1: SHA Poisoning Defense

- **Objective**: Prove that an attacker submitting a forged or stale commit SHA to an open bounty is rejected before state mutation, leaving attempt counts at 0 and `seen` unpoisoned, so the genuine developer's subsequent submission succeeds.
- **Setup**: Creator creates Bounty S4-1 (escrow 10 credits).
- **Step 1 (Attack)**: Attacker (`0xd033...`) calls `submit_work(bounty_id, PR#2_url, "0000000000000000000000000000000000000000")`.
  - **Expected Outcome**: Reverts with `gl.vm.UserError("Head sha does not match the pull request head")` (or `"Pull request is not bound to the submitting wallet"`).
  - **State Snapshot**: Bounty `attempts` remains `"0"`; `seen` has no record for PR#2's true head SHA.
- **Step 2 (Genuine Submit)**: Legitimate Dev (`0x6325...`) calls `submit_work(bounty_id, PR#2_url, PR#2_head_sha)`.
  - **Expected Outcome**: `status_name: ACCEPTED`, `result_name: MAJORITY_AGREE`, `execution_result: SUCCESS`, verdict `RELEASE_100`.
  - **State Snapshot**: Bounty `attempts` becomes `"1"`, status `SETTLED`.

---

## 2. Case S4-2: Legitimate Recovery Flow

- **Objective**: Prove that an initial `REVIEW` verdict returns the developer's 50-credit submission bond, consumes 1 attempt, keeps the bounty `OPEN`, and allows a subsequent corrected submission to settle the bounty and pay out.
- **Setup**: Creator creates Bounty S4-2 (escrow 10 credits). Dev balance snapshot recorded.
- **Step 1 (First Submit - Inconclusive)**: Dev submits PR #4 (Trap Deleted Test Files) -> Evaluates to `REVIEW`.
  - **Expected Outcome**: `execution_result: SUCCESS`, verdict `REVIEW`.
  - **Bond Invariant**: 50 credits debited for bond are fully refunded back to Dev upon `REVIEW` verdict.
  - **State Snapshot**: Bounty `attempts` is `"1"`, status remains `"OPEN"`.
- **Step 2 (Second Submit - Corrected Work)**: Dev submits PR #2 (Clean slugify) to the same bounty.
  - **Expected Outcome**: `execution_result: SUCCESS`, verdict `RELEASE_100`.
  - **State Snapshot**: Bounty `attempts` is `"2"`, status becomes `"SETTLED"`, Dev receives bounty payout.

---

## 3. Case S4-3: Exhaustion & Escrow Refund Flow

- **Objective**: Prove that:
  1. A single developer is capped at 2 attempts on a single bounty (enforcing `Developer attempt limit reached`).
  2. Further attempts by other developers consume attempts up to the bounty cap of 6.
  3. Reaching 6 attempts transitions status to `EXHAUSTED`.
  4. The creator invokes `refund_exhausted` to reclaim escrowed credits.
  5. The ledger invariant holds across every transition.
- **Setup**: Creator creates Bounty S4-3 (escrow 20 credits).
- **Execution**:
  - Dev 1 submits Attempt 1 (PR #3, missing path) -> `REFUND` (attempts = 1).
  - Dev 1 submits Attempt 2 (PR #3, fresh commit / variant) -> `REFUND` (attempts = 2).
  - Dev 1 submits Attempt 3 -> Reverts with `gl.vm.UserError("Developer attempt limit reached")`.
  - Dev 2 (using separate wallet) takes 2 attempts -> `REFUND` (attempts = 4).
  - Dev 3 takes 2 attempts -> `REFUND` (attempts = 6).
  - Bounty status transitions to `EXHAUSTED`.
  - Creator calls `refund_exhausted(bounty_id)` -> Escrowed 20 credits refunded to Creator balance; status becomes `REFUNDED`.
- **Expected Ledger Invariant**: `total_balances + total_escrowed == total_minted` holds before and after refund.

---

## 4. Case S4-4: Copied Submission Defense

- **Objective**: Prove that a second wallet cannot hijack or re-submit a pull request bound to the genuine developer's address.
- **Setup**: Creator creates Bounty S4-4 (escrow 10 credits).
- **Step 1 (Theft Attempt)**: Attacker (`0xd033...`) calls `submit_work(bounty_id, PR#2_url, PR#2_head_sha)`. PR #2 body is bound to `0x6325...`.
  - **Expected Outcome**: Reverts with `gl.vm.UserError("Pull request is not bound to the submitting wallet")`.
  - **State Snapshot**: Attacker debited 0 credits, bounty attempts remain `"0"`.
- **Step 2 (Genuine Submit)**: Genuine Dev (`0x6325...`) calls `submit_work(bounty_id, PR#2_url, PR#2_head_sha)`.
  - **Expected Outcome**: `execution_result: SUCCESS`, verdict `RELEASE_100`.

---

## 5. Case S4-5: Sybil Exhaustion Resistance

- **Objective**: Prove that multiple attacker wallets spamming unbound or fake PRs cannot consume bounty attempts or DOS legitimate contributors.
- **Setup**: Creator creates Bounty S4-5 (escrow 10 credits).
- **Attack Phase**:
  - Attacker Wallet 1 submits unbound PR #10 (no marker) -> Reverts with `UserError("Pull request is not bound to the submitting wallet")`.
  - Attacker Wallet 2 submits unbound PR #10 -> Reverts with `UserError("Pull request is not bound to the submitting wallet")`.
  - Attacker Wallet 3 submits unbound PR #10 -> Reverts with `UserError("Pull request is not bound to the submitting wallet")`.
- **Post-Attack State**: Bounty `attempts` remains strictly `"0"`, status `"OPEN"`.
- **Resolution**: Legitimate Dev submits valid bound PR #2 -> Settles to `RELEASE_100`.

---

## 6. Case S4-6: Submission Bond Accounting Invariants

- **Objective**: Explicitly trace balance changes proving that:
  - Submission bond (50 credits) is forfeited to the Creator on `REFUND`.
  - Submission bond (50 credits) is returned to the Developer on `RELEASE_x`.
- **Trace 1 (Bond Forfeiture on REFUND)**:
  - Bounty S4-6A created with escrow 10.
  - Creator bal $C_0$, Dev bal $D_0$.
  - Dev submits PR #3 (missing path) -> `REFUND`.
  - Post-state: Dev bal becomes $D_0 - 50$ (bond lost). Creator bal becomes $C_0 + 50$ (bond received).
  - Invariant $\sum \text{balances} + \sum \text{escrowed} == \text{total\_minted}$ preserved.
- **Trace 2 (Bond Refund on RELEASE)**:
  - Bounty S4-6B created with escrow 10.
  - Creator bal $C_1$, Dev bal $D_1$.
  - Dev submits PR #2 (clean release) -> `RELEASE_100`.
  - Post-state: Dev bond refunded (+50) + bounty payout (+10) = Dev bal $D_1 + 10$. Creator bal unchanged.
  - Invariant preserved.
