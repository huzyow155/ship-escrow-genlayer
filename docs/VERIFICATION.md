# On-Chain Verification & Deployment Records

> Network: **GenLayer Studionet** (Chain ID: 61999)  
> Status: **Preview**  
> RPC: `https://studio.genlayer.com/api`  
> Explorer Base: `https://explorer-studio.genlayer.com`  

This document details the on-chain addresses, deployment transactions, source code hash integrity, and live execution evidence for the Ship Escrow and Ship Reputation Intelligent Contracts.

---

## 1. Primary Contract: ShipEscrow

- **Contract Address**: [`0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`](https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F)
- **Deployment Transaction Hash**: `0x0dcfc833e0379f1259cfcdad6ca1a77c0783ba8a2eeb461e32c314a7086c16c3`
- **Deploy Status**: `status_name: ACCEPTED`, `result_name: MAJORITY_AGREE`, `leader execution_result: SUCCESS`
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
- **Local Source File**: `contracts/ShipReputation.py`
- **Local SHA-256 Hash**: `6dc14ae2714d93cae2fe152112ca0f9ff69fa58284f25b77ea02fa9db647381e`
- **On-Chain Decoded SHA-256 Hash**: `6dc14ae2714d93cae2fe152112ca0f9ff69fa58284f25b77ea02fa9db647381e`
- **Source Integrity Verification**: **EXACT MATCH (Byte-for-byte verified)**

---

## 3. Real On-Chain Transactions & Measured Latencies

All transactions below were executed and accepted by validators on Studionet during Milestone 4 & 5 validation runs:

| Case | Description | Target / Method | Tx Hash | Leader Latency | Execution Result / Outcome |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Case A** | Positive Payout (F1 Good PR) | `submit_work(14, PR#2, 5db0441...)` | `0x1913d363e055b53406c719cb3c3f284523ce2805956139a13b7e0596f2e18dd8` | 41.76s | `SUCCESS` -> `RELEASE_100` (Dev: 1000, Creator: 0) |
| **Case B** | Fast Deterministic Exit (F2 Trap README) | `submit_work(15, PR#3, 3de6b56...)` | `0xfb293d53abc031627c96c5d3c0a0d6953202d7913a99bfac8c2abf14fe9b329c` | 8.55s | `SUCCESS` -> `REFUND` (fast gate exit) |
| **Case C** | CI Gaming Defense (F3 Trap Deleted Tests) | `submit_work(16, PR#4, aa9a2af...)` | `0xba2725497e7a4a80b116bbbbccf3648fc63db2f8c94e3c0f2c22717494b770c6` | 15.21s | `SUCCESS` -> `REVIEW` (gate: test_deleted) |
| **Case D** | Partial Payout (F4 Partial PR) | `submit_work(17, PR#5, 73fbd16...)` | `0x2b09d96cdf48beb7eb6f59e92594552bd4a262cc457cc6db54df810ee6ce84e0` | 18.61s | `SUCCESS` -> `RELEASE_75` (Dev: 750, Creator: 250) |
| **Case E** | Injection Resistance (F5 Injection) | `submit_work(18, PR#6, b9e0991...)` | `0xb8ce66ede840e86a349e8d220ff83006f1060fbf4df1f16e49f4a38b52c7eb20` | 25.16s | `SUCCESS` -> `REFUND` (injection defeated) |
| **Case F** | Non-Existent PR (HTTP 404) | `submit_work(19, PR#99999, ...)` | `0x89ad0c14bdfc9197ad67ecf45bb65324ecab280287a2a5efc32e01dfc14041b6` | 8.55s | `ERROR` -> `"PR not found on GitHub (HTTP 404)"` |
| **Case F** | Invalid Head SHA format | `submit_work(19, PR#2, "shortsha123")` | `0x9e731da8118d451ceb83e4a9e5251664188b0a9443e0d86a42a03f444fecb27a` | 5.25s | `ERROR` -> `"Invalid head sha: must be 40 lowercase hex characters"` |
| **Case F** | Wrong Repo PR URL | `submit_work(19, torvalds/linux, ...)` | `0xf81d655f524c965646f9d3161c875d69ce1121d102e3b33da07d30773d2fbc13` | 5.23s | `ERROR` -> `"PR URL owner/repo mismatch"` |
| **Case G** | Duplicate Head SHA check | `submit_work(19, PR#3, 3de6b56...)` | `0xf4d3140026e63dfab91c496c1da8c4847c229cfb76920f0e74f261ee9ec80242` | 8.52s | `ERROR` -> `"Duplicate submission for head sha: existing submission 14"` |
| **Case H** | Exhaustion Flow (Att 3) | `submit_work(19, PR#6, b9e0991...)` | `0x9488be35cfffd234bc6864e104a3f38102b45adba29203c50e3f40c9628fedc5` | 15.20s | `SUCCESS` -> Bounty status transitions to `EXHAUSTED` |
| **Case H** | Refund Exhausted | `refund_exhausted(19)` | `0x001501cb9ea23d16623290f59d502718794c9f05decaf9a6d01b54188c47a921` | 8.67s | `SUCCESS` -> Status `REFUNDED` (1000 credits to creator) |
| **Case I** | Voluntary Cancellation | `cancel_bounty(20)` | `0xe3c3b4407af759d68c0468a7b66c09366871f505b6605b0de1db282a1d9fe24e` | 5.30s | `SUCCESS` -> Status `CANCELLED` (750 credits to creator) |
| **Case L** | Reputation Synchronization | `ShipReputation.sync(14)` | `0xdd4e5fcee29bc404094bbab06e30bebbabf62d3d3372816cc22d6175c96ab28c` | 5.26s | `SUCCESS` -> Dev & creator scores synchronized |
| **Case L** | Sync Idempotency Enforcement | `ShipReputation.sync(14)` | `0xb1b1ce6107316fc1b47ceae3ef2ba8985dc7417e1329c37265eb62ad9bfaeaec` | 5.21s | `ERROR` -> `"Bounty settlement already processed"` |

---

## 4. Explorer Observations

Opening [`https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`](https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F) renders the contract overview panel displaying the contract address, transaction history for each write execution, status `ACCEPTED`, consensus result `MAJORITY_AGREE`, and the contract creator address.
