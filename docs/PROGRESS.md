# PROGRESS - PROMPT SE-V2d

## Current State
- HEAD: `e3d6d97`
- Initial Active Contracts:
  - ShipEscrowV2: `0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`
  - ShipReputationV2: `0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`
- Task 3960: executing `scripts/read_stored_assessments.mjs` to fetch all 54 submissions from chain.
- Finding so far: Outcome (a) confirmed. Submissions on-chain have `criterion_results: []` and `packet: {}` because `_leader_extra` module-level dictionary in `contracts/ShipEscrowV2.py` is not shared across the nondet sandbox and outer execution frame.
- Planned resolution: Implement `gl.vm.run_nondet(leader_fn, validator_fn)` in `ShipEscrowV2.py` so leader returns the complete canonical packet JSON, validator independently validates, and outer frame unpacks and persists the full packet, packet_sha256, criterion_results, and gate.
- Next steps:
  1. Complete chain reads, save raw JSON files to `docs/evidence_v2/assessments_raw/`.
  2. Document diagnosis (a) with raw JSON excerpts (F1, F4, F5, F3, F2).
  3. Pre-register `docs/ROBUSTNESS_V2_PLAN_ADDENDUM.md`.
  4. Implement `gl.vm.run_nondet(leader_fn, validator_fn)` in `contracts/ShipEscrowV2.py`.
  5. Deploy new contracts (ShipEscrowV2, ShipReputationV2) to Studionet, save deploy payloads, verify source byte-for-byte.
  6. Execute on-chain test suite on new address: F1-F12, Section 0 (multi-commit), Section 4 (S4_1 to S4_6), ledger invariants & reputation, 30 robustness runs with real label vectors.
  7. Implement `scripts/recompute_packet.mjs` verifying offline SHA-256 match.
  8. Update finalization checks, doc references, scans, CI run, git tag `se-v2-1`.
