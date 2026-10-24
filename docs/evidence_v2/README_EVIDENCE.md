# Ship Escrow V2 Evidence Directory Reference

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  

This directory contains empirical evidence receipts, test results, deployment records, and source artifacts supporting the Ship Escrow V2 evaluation.

---

## 1. Directory Structure

- **`source/`**:
  - `shipescrowv2_onchain.py`: Source extracted from deployment transaction [`0xa47ecee0c8108c12baf8a71acfb87ce3aff22ee2aa85d73bfa0e26a67d67d733`](https://explorer-studio.genlayer.com/tx/0xa47ecee0c8108c12baf8a71acfb87ce3aff22ee2aa85d73bfa0e26a67d67d733). SHA256: `c00b1366e960882367bf1f3e3c99b975691c28cb29750b7e16a0646e5e353048`. Byte-for-byte identical to active [`contracts/ShipEscrowV2.py`](file:///E:/ShipEscrow_V2/contracts/ShipEscrowV2.py).
  - `shipreputationv2_onchain.py`: Source extracted from deployment transaction [`0x5046e6d602dac897980c852b651aa9ab44fea2a0a7762a7dd34523742f5a3b5c`](https://explorer-studio.genlayer.com/tx/0x5046e6d602dac897980c852b651aa9ab44fea2a0a7762a7dd34523742f5a3b5c). SHA256: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`. Byte-for-byte identical to active [`contracts/ShipReputationV2.py`](file:///E:/ShipEscrow_V2/contracts/ShipReputationV2.py).
  - `shipescrowv2_2_not_adopted_onchain.py`: Extracted candidate source for [`0x5e403fCB8d05166A132cB9c8885bDc90b767EC6F`](https://explorer-studio.genlayer.com/address/0x5e403fCB8d05166A132cB9c8885bDc90b767EC6F) from [`0xc8c5459d3670a6824a58a1436ba3b6f4f84ce18fc8b1071236b8743a505616a9`](https://explorer-studio.genlayer.com/tx/0xc8c5459d3670a6824a58a1436ba3b6f4f84ce18fc8b1071236b8743a505616a9). SHA256: `7b14e4399dd99cff65a47ece067a8cea9d6bcbff55f1ad8debfcdb730c12b3bf` (LF normalized) / `f2e5cd407e493763154307b77c65ad5c058d3985dec625d483991e1e85340f6c` (raw Windows CRLF deploy payload). Byte-for-byte identical to [`contracts/candidates/ShipEscrowV2_2_not_adopted.py`](file:///E:/ShipEscrow_V2/contracts/candidates/ShipEscrowV2_2_not_adopted.py).
- **`robustness/`**:
  - Contains all 30 successful robustness records and 20 failure receipts across F1, F4, and F5 on active deployment `ShipEscrowV2` (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`).
- **`robustness_v2_2/`**:
  - Contains all 30 candidate gate runs (23 successes, 7 rate limit failures) on candidate contract `0x5e403fCB8d05166A132cB9c8885bDc90b767EC6F`.
  - Gate evaluation summary: [`docs/evidence_v2/robustness_v2_2/gate_evaluation_summary.json`](file:///E:/ShipEscrow_V2/docs/evidence_v2/robustness_v2_2/gate_evaluation_summary.json).
- **`finalization/`**:
  - Complete check of 183 receipts confirming 100% transition to `FINALIZED` (status: 7).

---

## 2. Evidence Notes & Retractions

### Retraction: `probe_old_owner_receipt.json`
- **Notice**: wrong URL, not used.
- **Details**: The probe transaction [`0x089d44840f418c00de1fc48e628f7aab1a72dd384b0c9af40ee7d527a6b30e30`](https://explorer-studio.genlayer.com/tx/0x089d44840f418c00de1fc48e628f7aab1a72dd384b0c9af40ee7d527a6b30e30) invoked the probe contract using the endpoint `https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pull/2` (singular `pull` instead of the required GitHub REST API route `pulls`). GitHub returned HTTP 404 Not Found solely because of the incorrect path segment. This file has been retracted from all claims.

### Context: `probe_owner_measurement.json`
- **Notice**: measured from a local script, not from validators.
- **Details**: The 40-sample distribution measurement (`20x 301 Moved Permanently` on old-owner URL, `20x 200 OK` on canonical owner URL) was executed by a local Node.js script via fetch. The HTTP status codes received by individual validator nodes on Studionet were not measured on validators.

### V2.2 Gate Outcome Statement
- `labels were identical in all successful runs; binding was not adopted because the pre-registered success threshold was not met under GitHub unauthenticated rate limits; labels are stored, hash-committed, recomputable and leader-attested; validators compare head, base, diff hash, facts, gate, verdict and payout`
