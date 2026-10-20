# SHIP ESCROW V2 & REPUTATION V2 - LIVE VERIFICATION REPORT
STATUS: Preview

## 1. Deployed Contracts & Source Verification
- **ShipEscrowV2**: `0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`
  - Deploy Tx: `0x6fe51f08455cda0f0fcb9ae35e19258ef062a389507d5d3b9888f6c21fd121c3`
  - Source SHA256: `28bd8f52f5874d58a1b415589ed78f9ee7d8f0a704a1380e7ae91e41e1486cb0`
  - Byte-for-byte exact match: `true`
- **ShipReputationV2**: `0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`
  - Deploy Tx: `0x42d8611b053c77ea509344efb93962841c14448b81c19b6437e1dbda4561d60b`
  - Source SHA256: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
  - Byte-for-byte exact match: `true`

## 2. On-Chain Scenario Verification Table (F1 - F12)
| ID | PR | Description | Expected Verdict | Actual Verdict | Payout % | Tx Hash | Receipt Triple | Match |
|:---|:---|:------------|:-----------------|:---------------|:---------|:--------|:---------------|:------|
| F1 | #2 | Clean Full Release | RELEASE_100 | RELEASE_100 | 100% | `0x468048b8dd1d8eef61cdb1d95a32d160ccfc94c962646308340b3e0355dc8616` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |
| F2 | #3 | Missing Required Path Gate | REFUND | REFUND | 0% | `0xe9af11590d4a6dc11afd19cab05f7f95b21c1760f006d1b07b2ff907d9c93f58` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |
| F3 | #4 | Deleted Test Files Gate | REVIEW | REVIEW | 0% | `0x97970698282eec8d41580f8bb135f1401deb6d55b4f554615745b1453a722573` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |
| F4 | #5 | Partial Release | RELEASE_75 | RELEASE_75 | 75% | `0x201f2e36fbd4246ef497c8a0987e384f30a7d98433fe95de23e5226878efbfbc` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |
| F5 | #6 | Prompt Injection Defense | REFUND | REFUND | 0% | `0xd0ae855cc54aba922715210d845896cdc2c05fa7790f26eeaff7b85b42d9b823` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |
| F6 | #7 | Multi-Commit PR Authentication | RELEASE_100 | RELEASE_100 | 100% | `0x9a2b2a2e6756070bcd53f7991ac15b76341bc7ba1cda23eae4ee8b6b57c24fa3` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |
| F7 | #8 | Advancing Head Stale SHA | REVERT (ERROR) | REVERT (ERROR) | N/A | `0x174e5e0b9efc4c29d34990ea34b338a23854a6ca82239d099e1e8fe3b5e26e57` | ACCEPTED / MAJORITY_AGREE / ERROR | **TRUE** |
| F8 | #9 | Wrong-Wallet Marker Rejection | REVERT (ERROR) | REVERT (ERROR) | N/A | `0x3573533fe67e90889048a80d29e1d3df3dfa13a8727cf8fbf24d6f137b4b345d` | ACCEPTED / MAJORITY_AGREE / ERROR | **TRUE** |
| F9 | #10 | No Wallet Marker Rejection | REVERT (ERROR) | REVERT (ERROR) | N/A | `0x0e27fea63c4e1562f4315de75cd73ed8ee317312ea76a272c12b44b98634dc1e` | ACCEPTED / MAJORITY_AGREE / ERROR | **TRUE** |
| F10 | #11 | Partial Required Prefix Gate | REFUND | REFUND | 0% | `0x516b88e022cab960bcdd525685c29daafba2f205356bbae4af2691de0712a888` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |
| F11 | #12 | Non-Test Deleted File Mode | RELEASE_100 | RELEASE_100 | 100% | `0xc9c21ea16bc460e291fbc26ae92b008b79080420e96b822d52d52f48a6257317` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |
| F12 | #13 | Oversize Diff (> 14k chars) | REVIEW | REVIEW | 0% | `0x863106348c889f0cc95fefa7da8668b0853632f980232b8ae0b9e47ffca0a697` | ACCEPTED / MAJORITY_AGREE / SUCCESS | **TRUE** |

## 3. Attack & Lifecycle Protection Tests
| Test Description | Caller | Target | Expected Outcome | Actual On-Chain Outcome | Tx Hash | Result |
|:-----------------|:-------|:-------|:-----------------|:------------------------|:--------|:-------|
| Stale SHA submission (F7) | Dev | Bounty 7 | Revert before attempt consumed | ERROR (Consensus agree) | `0x174e5e0b9efc4c29d34990ea34b338a23854a6ca82239d099e1e8fe3b5e26e57` | **PASSED** |
| Attribution hijacking (F8) | Dev | Bounty 8 | Revert: not bound to submitter | ERROR (Consensus agree) | `0x3573533fe67e90889048a80d29e1d3df3dfa13a8727cf8fbf24d6f137b4b345d` | **PASSED** |
| Unmarked PR spam (F9) | Dev | Bounty 9 | Revert: missing wallet marker | ERROR (Consensus agree) | `0x0e27fea63c4e1562f4315de75cd73ed8ee317312ea76a272c12b44b98634dc1e` | **PASSED** |
| Cancel after submission | Creator | Bounty 3 | Revert: attempts > 0 | ERROR (Consensus agree) | `0x7f979fb5fecf4c6da3398fe32391caecdcc7432d22763d0abf5ca8ad01483739` | **PASSED** |
| Cancel at attempts == 0 | Creator | Bounty 13 | Success: escrow refunded | SUCCESS | `0x23ef16c657be7aec348ef9aae0c86f063219927f25b69d98424c8c703ce58c5a` | **PASSED** |
| Reputation sync duplicate | Dev | Bounty 1 | Revert: already synced | ERROR (Consensus agree) | `0x23fdcc69e351bc7722334085de0746dba372f1c9cc0c259355bb7c58de1ae2f0` | **PASSED** |
| Reputation sync low payout | Dev | Bounty 4 | Revert: payout < required | ERROR (Consensus agree) | `0xfb0273a690977630578cfe68e0585fcb3902b37e54bacfd7300636cdc39fbb75` | **PASSED** |
| Reputation sync valid threshold | Dev | Bounty 4 | Success: scores updated | SUCCESS | `0x31aedd5b196463f3b397eb867557a293de18e95aa11b9e4c36ef0fc6d816bdc5` | **PASSED** |

## 4. Conserved Ledger Invariant & Statistics
```json
{
  "invariant_holds": true,
  "total_balances": "2600",
  "total_escrowed": "400",
  "total_minted": "3000"
}
```
- **Invariant Holds**: `true`
- **Formula**: `total_balances (2600) + total_escrowed (400) == total_minted (3000)`

### On-Chain Final Stats (`get_stats`):
```json
{
  "cancelled": 1,
  "exhausted": 0,
  "open": 8,
  "refunded": 0,
  "schema_version": "2",
  "settled": 4,
  "total_bonds_forfeited": 3,
  "verdict_refund": 3,
  "verdict_release_100": 3,
  "verdict_release_25": 0,
  "verdict_release_50": 0,
  "verdict_release_75": 1,
  "verdict_review": 2
}
```

## 5. Robustness Batches (10 runs on F1, F4, F5)
| Fixture | Runs | Label-Vector Identical Count | Verdict Matches | Expected Label Vector | Actual Label Vector | Verdict |
|:--------|:-----|:-----------------------------|:----------------|:----------------------|:--------------------|:--------|
| F1 | 10 | 10 / 10 | 10 / 10 | `["YES","YES","YES"]` | `["YES","YES","YES"]` | `RELEASE_100` |
| F4 | 10 | 10 / 10 | 10 / 10 | `["YES","YES","NO"]` | `["YES","YES","NO"]` | `RELEASE_75` |
| F5 | 10 | 10 / 10 | 10 / 10 | `["NO"]` | `["NO"]` | `REFUND` |

## 6. Finalization Log Summary
- **Checked At**: `2026-10-20T15:00:33.505Z`
- **Receipts Checked**: `36`
- **Initial Status**: `ACCEPTED` (36 / 36)
- **Re-fetched Status**: `ACCEPTED` (All write transactions confirmed on Studionet with `MAJORITY_AGREE` and leader SUCCESS/ERROR)
- **Reached FINALIZED**: `0` (Honest observation: studionet node consensus reaches ACCEPTED; transactions do not transition to FINALIZED on current studionet node RPC)
