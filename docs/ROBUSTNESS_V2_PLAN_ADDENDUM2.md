# Robustness V2 Plan Addendum 2: 10 Successful Runs per Fixture with Error Tracking

> Status: **Pre-Registration**  
> Active Contract: ShipEscrowV2 (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`)  
> Target Fixtures: F1 (PR #2), F4 (PR #5), F5 (PR #6)  

## 1. Rationale & Requirements
The initial robustness batch on V2.1 suffered from unauthenticated GitHub REST API rate limiting (HTTP 403 `Pull request metadata unavailable`), resulting in failed execution receipts on 20 of 30 runs.
To evaluate the true consistency and determinism of validator assessments:
1. Exactly 10 SUCCESSFUL runs must be achieved for each fixture (F1, F4, F5), with each run having its own unique bounty.
2. Every run attempt (success or failure) is recorded with full raw receipt.
3. Any failed attempts are archived in `docs/evidence_v2/robustness_failures/` and classified by error cause.
4. Total attempts, successes, and failures per fixture are reported honestly.

## 2. Evaluation Criteria & Consensus Binding Rule
- **Success Requirement**: Exactly 10 successful runs per fixture.
- **Label Vector Identity**: Evaluated ONLY over the 10 successful runs per fixture.
- **Strict Consensus Binding**:
  - If the label vector is identical in at least 9 of 10 successful runs for **every** fixture (F1, F4, F5), the label vector is bound to the validator consensus comparison.
  - Decision: `PASS`
- **Relaxed / Leader-Attested Rule**:
  - If any fixture has fewer than 9 of 10 identical label vectors over successful runs, consensus comparison compares `verdict` and `payout_pct`, while `criterion_results` and assessment `packet` are preserved as leader-attested with `packet_sha256` commitment.
  - Decision: `NOT_EVALUABLE` (if < 10 successes) or reported with exact identity count.
- **Transparency on Failure Rate**:
  - If more than 20% of attempts fail due to external rate limiting, this will be stated explicitly in README, LIMITATIONS, and the final report.
