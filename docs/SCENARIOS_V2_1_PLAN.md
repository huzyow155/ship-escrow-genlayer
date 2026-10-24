# Pre-Registration Plan: On-Chain Execution Suites for V2.1 Deployment

> Status: **Pre-Registration (Committed Prior to On-Chain Suite Execution)**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  
> Active ShipEscrowV2: `0xE52656081f95B7efa3F7566bd9e8Ace850729adb`  
> Active ShipReputationV2: `0x453abD58F96b19b8F22716b538bF1F94e8aef17D`  
> Plan Timestamp: 2026-10-24T03:45:00Z  

---

## 1. Overview of Execution Plan

Following the upgrade of `ShipEscrowV2` to use `gl.vm.run_nondet(leader_fn, validator_fn)` for full assessment packet persistence and label vector storage, all operational scenarios and audits are executed on the new contract instances.

### Execution Phases:
1. **Phase 1: Core Scenarios (F1 to F12), Ledger Invariant & Reputation Sync**
   - Script: `scripts/deploy/run_live_evidence_v2.js`
   - Scenarios:
     - Demo credit claims (Creator, Dev, Attacker)
     - F1 (PR #2): Clean full release (RELEASE_100, 100%)
     - F2 (PR #3): Missing required path gate (REFUND, 0%)
     - F3 (PR #4): Deleted test files gate (REVIEW, 0%)
     - F4 (PR #5): Partial criteria fulfillment (RELEASE_75, 75%)
     - F5 (PR #6): Prompt injection attempt resisted (REFUND, 0%)
     - F6 (PR #7): Multi-commit PR (RELEASE_100, 100%)
     - F7 (PR #8): Advancing head stale SHA rejected by API auth
     - F8 (PR #9): Wrong wallet marker in body rejected
     - F9 (PR #10): Missing wallet marker rejected
     - F10 (PR #11): Incomplete required prefix matching (REFUND, 0%)
     - F11 (PR #12): Legitimate non-test deletion allowed (RELEASE_100, 100%)
     - F12 (PR #13): Oversize diff truncation safety gate (REVIEW, 0%)
     - Cancel lifecycle: Refusal when attempts > 0; success when attempts == 0
     - Cross-contract reputation sync: min_payout filtering, duplicate rejection, and score updates
     - Conservation invariant verification across all operations

2. **Phase 2: Section 0 Multi-Commit Proofs**
   - Script: `scripts/run_multicommit_proofs.mjs`
   - Scenarios:
     - PR #7 iterative inspection across commits a, b, c, d
     - PR #8 advancing head contrast: stale SHA rejected vs authoritative tip accepted

3. **Phase 3: Section 4 Attack Defense & Lifecycle Proofs**
   - Script: `scripts/run_section4_proofs.js`
   - Scenarios:
     - S4-1: Unauthenticated head SHA poisoning defense
     - S4-2: Sybil attempt exhaustion defense (per-dev and per-bounty caps)
     - S4-3: Copied submission replay defense
     - S4-4: Legitimate developer recovery workflow
     - S4-5: Multi-commit atomic evaluation
     - S4-6: Fair cancellation rule defense

4. **Phase 4: Real Robustness Batches (30 Runs)**
   - Script: `scripts/run_real_robustness_batches.js`
   - Scenarios:
     - 10 runs on F1 (PR #2)
     - 10 runs on F4 (PR #5)
     - 10 runs on F5 (PR #6)
   - Evaluated on-chain from stored `criterion_results` and `packet`

5. **Phase 5: Chain Reads & Assessment Verification**
   - Script: `scripts/read_stored_assessments.mjs`
   - Reads all stored submissions from `0xE52656081f95B7efa3F7566bd9e8Ace850729adb`
   - Asserts non-empty `packet`, `criterion_results`, and `packet_sha256`

6. **Phase 6: Offline Packet Hash Recomputation**
   - Script: `scripts/recompute_packet.mjs`
   - Asserts `sha256(canonical_json(sub.packet)) === sub.packet_sha256` offline

7. **Phase 7: Full Recursive Finalization Check**
   - Script: `scripts/check_finalization_v2.js`
   - Recursively queries all saved receipts across `docs/evidence_v2/`
