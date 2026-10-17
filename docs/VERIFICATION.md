# On-Chain Verification & Deployment Records

> Network: **GenLayer Studionet** (Chain ID: 61999)  
> Status: **Preview**  
> RPC: `https://studio.genlayer.com/api`  
> Explorer Base: `https://explorer-studio.genlayer.com`  

This document details the on-chain addresses, deployment transactions, source code hash integrity, and studionet execution evidence for the Ship Escrow and Ship Reputation Intelligent Contracts.

---

## 1. Primary Contract: ShipEscrow

- **Contract Address**: [`0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`](https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F)
- **Deployment Transaction Hash**: `0x0dcfc833e0379f1259cfcdad6ca1a77c0783ba8a2eeb461e32c314a7086c16c3`
- **Deploy Status**: `status_name: ACCEPTED`, `result_name: MAJORITY_AGREE`, `leader execution_result: SUCCESS`
- **Saved Receipt**: `docs/evidence/deploy_receipt.json`
- **Local Source File**: `contracts/ShipEscrow.py`
- **Local SHA-256 Hash**: `2de0496eea2d940dd1985dcfa8e766abf0fbb56d36220297ddc6683b5f118b54`
- **On-Chain Decoded SHA-256 Hash**: `2de0496eea2d940dd1985dcfa8e766abf0fbb56d36220297ddc6683b5f118b54`
- **Source Integrity Verification**: **EXACT MATCH (Byte-for-byte verified)**

### Verification Method
1. Query RPC method `eth_getTransactionByHash` with the deployment transaction hash `0x0dcfc833e0379f1259cfcdad6ca1a77c0783ba8a2eeb461e32c314a7086c16c3`.
2. Extract `result.data.contract_code`.
3. Base64-decode the payload and compute `sha256(decoded_bytes)`.
4. Compare with local `contracts/ShipEscrow.py` SHA-256 hash. Result: `EXACT MATCH`.

---

## 2. Multi-Contract Consumer: ShipReputation

- **Contract Address**: [`0x55c56f0dfFb8227345814A37c68394b05c26E901`](https://explorer-studio.genlayer.com/address/0x55c56f0dfFb8227345814A37c68394b05c26E901)
- **Deployment Transaction Hash**: `0xca13e68ba0743939041b61985062b39fa95ef54c9134c5d47c65441dc03b1602`
- **Target Escrow Address Bound**: `0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`
- **Deploy Status**: `status_name: ACCEPTED`, `result_name: MAJORITY_AGREE`, `leader execution_result: SUCCESS`
- **Saved Receipt**: `docs/evidence/deploy_reputation_receipt.json`
- **Local Source File**: `contracts/ShipReputation.py`
- **Local SHA-256 Hash**: `6dc14ae2714d93cae2fe152112ca0f9ff69fa58284f25b77ea02fa9db647381e`
- **On-Chain Decoded SHA-256 Hash**: `6dc14ae2714d93cae2fe152112ca0f9ff69fa58284f25b77ea02fa9db647381e`
- **Source Integrity Verification**: **EXACT MATCH (Byte-for-byte verified)**

---

## 3. Real On-Chain Transactions & Measured Latencies

> **Transaction Hash Provenance Note**: Earlier documentation drafts displayed transaction hashes typed from memory; every hash listed below is strictly verified and corresponds 1:1 with an existing JSON receipt saved under `docs/evidence/`.

All transactions below were executed and accepted by validators on Studionet during Milestone 4 & 5 validation runs:

| Case | Description | Target / Method | Tx Hash | Saved Receipt | Leader Latency | Execution Result / Outcome |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Case A** | Positive Payout (F1 Good PR) | `submit_work(14, PR#2, 5db0441...)` | `0x1913d363e055b53406c719cb3c3f284523ce2805956139a13b7e0596f2e18dd8` | `f1_submit_receipt.json` | 41.76s | `SUCCESS` -> `RELEASE_100` (Dev: 1000, Creator: 0) |
| **Case B** | Fast Gate Exit (F2 Trap README) | `submit_work(15, PR#3, 3de6b56...)` | `0xfb293d53abc031627c96c5d3c0a0d6953202d7913a99bfac8c2abf14fe9b329c` | `f2_submit_receipt.json` | 8.55s | `SUCCESS` -> `REFUND` (fast gate exit) |
| **Case C** | CI Gaming Defense (F3 Trap Deleted Tests) | `submit_work(16, PR#4, aa9a2af...)` | `0xba2725497e7a4a80b116bbbbccf3648fc63db2f8c94e3c0f2c22717494b770c6` | `f3_submit_receipt.json` | 15.21s | `SUCCESS` -> `REVIEW` (gate: test_deleted) |
| **Case D** | Partial Payout (F4 Partial PR) | `submit_work(17, PR#5, 73fbd16...)` | `0x2b09d96cdf48beb7eb6f59e92594552bd4a262cc457cc6db54df810ee6ce84e0` | `f4_submit_receipt.json` | 18.61s | `SUCCESS` -> `RELEASE_75` (Dev: 750, Creator: 250) |
| **Case E** | Injection Resistance (F5 Injection) | `submit_work(18, PR#6, b9e0991...)` | `0xb8ce66ede840e86a349e8d220ff83006f1060fbf4df1f16e49f4a38b52c7eb20` | `f5_submit_receipt.json` | 25.16s | `SUCCESS` -> `REFUND` (injection defeated) |
| **Case F** | Non-Existent PR (HTTP 404) | `submit_work(19, PR#99999, ...)` | `0xc8ece3c59413fcb9b77f70b6192641184f2ff5373cc0f530be72f6eba47f0180` | `case_f_404_receipt.json` | 8.55s | `ERROR` -> `"PR not found on GitHub (HTTP 404)"` |
| **Case F** | Invalid Head SHA format | `submit_work(19, PR#2, "shortsha123")` | `0xc6305c9cb6a001d4d95da9eefe9e9a25577ff2483dfc168e00ac46712fb7210d` | `case_f_bad_sha_receipt.json` | 5.25s | `ERROR` -> `"Invalid head sha: must be 40 lowercase hex characters"` |
| **Case F** | Wrong Repo PR URL | `submit_work(19, torvalds/linux, ...)` | `0x361fb598445ee04e9219ab3829219a19419ab70e551e2ab319561a03cb977678` | `case_f_wrong_repo_receipt.json` | 5.23s | `ERROR` -> `"PR URL owner/repo mismatch"` |
| **Case G** | Duplicate Head SHA check | `submit_work(19, PR#3, 3de6b56...)` | `0x4b3ba968f059e5cd8cbd6b9f2cbab3317e50310d019be10924d0184fe2b0e359` | `case_g_receipt.json` | 8.52s | `ERROR` -> `"Duplicate submission for head sha: existing submission 14"` |
| **Case H** | Exhaustion Flow (Attempt 1) | `submit_work(19, PR#3, 3de6b56...)` | `0x4505c25d920e613f3a8359e66a083f344263ab5b071749c88b8300ec71ad7202` | `case_h_att1_receipt.json` | 15.18s | `SUCCESS` -> Attempt 1 recorded (`REFUND`) |
| **Case H** | Exhaustion Flow (Attempt 2) | `submit_work(19, PR#4, aa9a2af...)` | `0xa754c4f0ef27c096a04caa47f8c5b4c154e66d02b0ba4e6e43b7ed1da29c6a43` | `case_h_att2_receipt.json` | 15.22s | `SUCCESS` -> Attempt 2 recorded (`REVIEW`) |
| **Case H** | Exhaustion Flow (Attempt 3) | `submit_work(19, PR#6, b9e0991...)` | `0x9488be35cfffd234bc6864e104a3f38102b45adba29203c50e3f40c9628fedc5` | `case_h_att3_receipt.json` | 15.20s | `SUCCESS` -> Attempt 3 recorded; bounty transitions to `EXHAUSTED` |
| **Case H** | Refund Exhausted | `refund_exhausted(19)` | `0x001501cb9ea23d16623290f59d502718794c9f05decaf9a6d01b54188c47a921` | `case_h_refund_exhausted_receipt.json` | 8.67s | `SUCCESS` -> Status `REFUNDED` (1000 credits to creator) |
| **Case I** | Voluntary Cancellation | `cancel_bounty(20)` | `0xe3c3b4407af759d68c0468a7b66c09366871f505b6605b0de1db282a1d9fe24e` | `case_i_cancel_receipt.json` | 5.30s | `SUCCESS` -> Status `CANCELLED` (750 credits to creator) |
| **Case L** | Reputation Synchronization | `ShipReputation.sync(14)` | `0xdd4e5fcee29bc404094bbab06e30bebbabf62d3d3372816cc22d6175c96ab28c` | `reputation_sync_receipt.json` | 5.26s | `SUCCESS` -> Dev & creator scores synchronized |
| **Case L** | Sync Idempotency Enforcement | `ShipReputation.sync(14)` | `0x68d38f9e8a5616e690c39977d47c09fb3b36214ddff6d82e656b8588523d089b` | `case_l_sync_dup_receipt.json` | 5.21s | `ERROR` -> `"Bounty settlement already processed"` |

---

## 4. Explorer Observations

Opening [`https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`](https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F) renders the contract overview panel displaying the contract address, transaction history for each write execution, status `ACCEPTED`, consensus result `MAJORITY_AGREE`, and the contract creator address.
