# Changelog

All notable changes to the Ship Escrow intelligent contracts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.2.0] - 2026-10-24

### Added
- **Pre-Registered Addendum 3 (Consensus Label Binding Gate)**: Added `docs/ROBUSTNESS_V2_PLAN_ADDENDUM3.md` specifying consensus label vector equality (`criterion_results`) and HTTP diagnostic error messages.
- **Diagnosable HTTP Error Discrimination**: Discriminates HTTP 301/302/307/308 redirects (`"Repository moved: use the current owner/repo name in the bounty and the PR URL"`) and HTTP 403/429 rate limits (`"GitHub rate limit reached, retry later"`), pinned across unit and direct mode tests.
- **Candidate V2.2 Deployment & Empirical Gate Evaluation**: Deployed candidate pair `0x5e403fCB8d05166A132cB9c8885bDc90b767EC6F` and `0xF4b6649e7213874140451e01Faa4d9632A8edDA2`. Executed 30-run Gate Batch across F5, F4, F1 on Studionet. Reached 100% modal label identity on all successful runs (F5: 10/10 `["NO"]`, F4: 7/7 `["YES","YES","NO"]`, F1: 6/6 `["YES","YES","YES"]`), but under sequential bursts multi-criteria fixtures encountered validator IP rate limits (7/10 and 6/10 successes). In accordance with pre-registered gate protocol (requiring >= 9/10 successes), gate outcome evaluated to `REJECT_V2_2_KEEP_V2_1`. V2.2 preserved for audit; V2.1 contracts remain active.
- **Root-Cause Claim Measurements**: Captured `probe_rate_limit_403_receipt.json`, `probe_old_owner_receipt.json`, and 40-sample HTTP measurement `probe_owner_measurement.json` (old owner `{"301": 20}`, canonical owner `{"200": 20}`).
- **Diagnosable Error Catalog**: Added troubleshooting guide and error catalog table to `README.md` and `docs/LIMITATIONS.md`.

## [2.1.0] - 2026-10-24

### Added
- **Stored Assessment Packets**: Added `criterion_results`, `gate`, and `packet` dictionary storage in `ShipEscrowV2` on-chain storage with matching `scripts/recompute_packet.mjs` verification.
- **GitHub Account Rename Resilience**: Added support for GitHub repository owner alias (`huzyow155` -> `hypercybers99`).
- **Active V2.1 Deployment**: Deployed active pair `0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF` and `0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`.
- **Honest Robustness Attempts Table**: Reconciled all 23 failure receipts, recording true attempt counts (F1: 19, F4: 17, F5: 14) and error distributions in `scripts/robustness_report.mjs`.

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
