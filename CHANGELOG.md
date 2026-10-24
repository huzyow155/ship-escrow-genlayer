# Changelog

All notable changes to the Ship Escrow intelligent contracts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.0.0] - 2026-10-21

### Added
- **Multi-Commit Head Proof & Contrast**: Pre-registered and verified on-chain multi-commit proof (`docs/EXPECTED_MULTICOMMIT.md` and `docs/CONTRACT_SUBMISSION.md`). Proved PR #7 rejects first commit, middle commit, and random SHA before consuming attempts; settles real head SHA with `RELEASE_75` (75% payout) and verifies parameter-bound view `is_settled_for`. Proved PR #8 advancing head rejects stale SHA and accepts real head SHA.
- **Section 4 Steward Attack Defense & Lifecycle Proofs**: Executed 6 on-chain proof cases on Studionet: SHA poisoning defense (S4-1), legitimate recovery flow (S4-2), exhaustion flow & escrow refund (S4-3), copied submission defense (S4-4), Sybil exhaustion resistance (S4-5), and submission bond accounting invariants (S4-6).
- **30 Real On-Chain Robustness Batches**: Executed 30 real on-chain transactions across F1, F4, and F5 with 10/10 verdict consistency (`docs/ROBUSTNESS_V2_PLAN.md`). Formally evaluated and confirmed decision `DO_NOT_BIND_LABELS_KEEP_LEADER_ATTESTED`.
- **True Studionet Finalization Verification**: Implemented `scripts/check_finalization_v2.js` querying GenLayer `getTransaction`, confirming 36/36 transactions transitioned to `FINALIZED`.
- **Discrete Direct Mode Suite**: Refactored `tests/direct/test_direct_mode.py` into 10 discrete named test functions passing 10/10 in pytest.
- **Conserved Accounting Ledger**: Added `claim_demo_credits`, debited deposits on `create_bounty`, refundable submission bond (50 credits), and `get_ledger_invariant` view asserting `total_balances + total_escrowed == total_minted`.
- **Authoritative REST API Metadata Authentication**: Fetch `head.sha`, `base.sha`, `body`, `state`, and `user.login` via GitHub REST API, verifying `head.sha == submitted head_sha` before state mutations.
- **Immutable Revision Diff**: Fetch diffs via `compare/<base_sha>...<head_sha>.diff` permanently bound to commit SHAs.
- **Attribution Binding**: Require `ship-escrow-wallet: 0x<caller_address>` marker in the PR body.
- **Attempt Limits**: Implemented per-developer cap (2 attempts) and bounty-level cap (6 attempts), ensuring only authenticated attempts consume counters.
- **Fair Cancellation**: Enforce `attempts == 0` for `cancel_bounty`; added `refund_exhausted` when bounty status reaches `EXHAUSTED`.
- **Multi-Prefix Path Matching**: `required_paths` now checks EVERY mandatory prefix at path segment boundaries.
- **Per-File Deletion Tracking**: Fixed false positives by tracking deletion state per file header (`diff --git`); removed broad `"test" in name` heuristic.
- **Diff Truncation Safety**: Diffs exceeding 14,000 characters deterministically evaluate to `REVIEW`.
- **Consensus Packet Commitments**: Upgraded consensus string from `verdict|sha16` to canonical packet commitment `verdict|payout_pct|packet_sha256`.
- **Parameter-Bound Settlement Verification**: Enhanced `is_settled_for` to accept `min_payout_pct`, checking criteria hash, head SHA, developer address, and payout threshold.
- **Official Direct Mode Test Suite**: Implemented `genlayer-test` Direct Mode covering 10 edge cases.
- **Public CI Workflow**: Added `.github/workflows/ci.yml` running lint, scans, and unit test suites on push.

### Changed
- Superseded V1 contracts (`ShipEscrow.py`, `ShipReputation.py`) and archived in `archive/v1/`.
- Deployed active V2 contracts: `ShipEscrowV2` at `0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd` and `ShipReputationV2` at `0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`.

## [1.0.0] - 2026-10-16

### Added
- Initial implementation of `ShipEscrow` and `ShipReputation` on GenLayer Studionet.
- Basic diff parsing, LLM semantic evaluation, and multi-validator consensus.
- Fixtures F1-F5.
