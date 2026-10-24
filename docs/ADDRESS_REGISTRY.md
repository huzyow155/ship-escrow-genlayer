# Ship Escrow Address Registry

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  
> RPC Endpoint: `https://studio.genlayer.com/api`  
> Explorer: `https://explorer-studio.genlayer.com`  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants. They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

---

## Active Contracts (V2.1 - Auditable Assessment Packet Storage & Rename-Resilient)

The following contracts are currently active and receive all live bounty escrow submissions:

### ShipEscrowV2
- **Address**: [`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`](https://explorer-studio.genlayer.com/address/0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF)
- **Deployment Tx**: [`0xa47ecee0c8108c12baf8a71acfb87ce3aff22ee2aa85d73bfa0e26a67d67d733`](https://explorer-studio.genlayer.com/tx/0xa47ecee0c8108c12baf8a71acfb87ce3aff22ee2aa85d73bfa0e26a67d67d733)
- **Source File**: `contracts/ShipEscrowV2.py`
- **Source SHA256**: `c00b1366e960882367bf1f3e3c99b975691c28cb29750b7e16a0646e5e353048`
- **Byte-for-Byte Exact Match**: `true`
- **Deployment Status**: `ACCEPTED` / `MAJORITY_AGREE` / `SUCCESS`

### ShipReputationV2
- **Address**: [`0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`](https://explorer-studio.genlayer.com/address/0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81)
- **Deployment Tx**: [`0x5046e6d602dac897980c852b651aa9ab44fea2a0a7762a7dd34523742f5a3b5c`](https://explorer-studio.genlayer.com/tx/0x5046e6d602dac897980c852b651aa9ab44fea2a0a7762a7dd34523742f5a3b5c)
- **Source File**: `contracts/ShipReputationV2.py`
- **Source SHA256**: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
- **Byte-for-Byte Exact Match**: `true`
- **Bound Escrow Address**: `0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`
- **Deployment Status**: `ACCEPTED` / `MAJORITY_AGREE` / `SUCCESS`

---

## Superseded Contracts (V2 Initial - Audited in PROMPT SE-V2d)

> [!WARNING]
> The following V2 initial contracts are superseded due to sandboxed consensus storage isolation of `_leader_extra` (`sub.criterion_results = []` and `sub.packet = {}`). Documented as superseded for audit completeness.

### ShipEscrowV2 (Superseded)
- **Address**: [`0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`](https://explorer-studio.genlayer.com/address/0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd)
- **Deployment Tx**: [`0x6fe51f08455cda0f0fcb9ae35e19258ef062a389507d5d3b9888f6c21fd121c3`](https://explorer-studio.genlayer.com/tx/0x6fe51f08455cda0f0fcb9ae35e19258ef062a389507d5d3b9888f6c21fd121c3)
- **Source SHA256**: `28bd8f52f5874d58a1b415589ed78f9ee7d8f0a704a1380e7ae91e41e1486cb0`
- **Status**: Superseded by `0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`

### ShipReputationV2 (Superseded)
- **Address**: [`0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`](https://explorer-studio.genlayer.com/address/0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F)
- **Deployment Tx**: [`0x42d8611b053c77ea509344efb93962841c14448b81c19b6437e1dbda4561d60b`](https://explorer-studio.genlayer.com/tx/0x42d8611b053c77ea509344efb93962841c14448b81c19b6437e1dbda4561d60b)
- **Status**: Superseded by `0x8e6D0356F4Bf987E95eB3cC6e7DF84ce2f708C81`

---

## Superseded Contracts (V1 - Audit Only)

> [!WARNING]
> The following V1 contracts are SUPERSEDED and kept strictly for audit purposes. Do NOT submit new transactions to these addresses.

### ShipEscrow (V1 - Superseded)
- **Address**: [`0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`](https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F)
- **Deployment Tx**: [`0x0dcfc833e0379f1259cfcdad6ca1a7f3693e9a59bb5f72cf93be655d8d32d0c2`](https://explorer-studio.genlayer.com/tx/0x0dcfc833e0379f1259cfcdad6ca1a7f3693e9a59bb5f72cf93be655d8d32d0c2)
- **Archived Source**: `archive/v1/ShipEscrow.py`
- **Status**: Superseded by ShipEscrowV2

### ShipReputation (V1 - Superseded)
- **Address**: [`0x55c56f0dfFb8227345814A37c68394b05c26E901`](https://explorer-studio.genlayer.com/address/0x55c56f0dfFb8227345814A37c68394b05c26E901)
- **Deployment Tx**: [`0x0567e8feea6e4922158fe48d0859388df67119f35fbcc763b6a935be016ef42a`](https://explorer-studio.genlayer.com/tx/0x0567e8feea6e4922158fe48d0859388df67119f35fbcc763b6a935be016ef42a)
- **Archived Source**: `archive/v1/ShipReputation.py`
- **Status**: Superseded by ShipReputationV2

---

## Diagnostic & Probe Contracts

### Probe (V2 Runtime Diagnostic)
- **Address**: [`0x95e5A80dfC75829271DBc64Bf1A386c03ddcFA9f`](https://explorer-studio.genlayer.com/address/0x95e5A80dfC75829271DBc64Bf1A386c03ddcFA9f)
- **Deployment Tx**: [`0x9f150d5b4ca4e6b53abed8f9d22556bebec363569d61b573aea1ae89182cc20d`](https://explorer-studio.genlayer.com/tx/0x9f150d5b4ca4e6b53abed8f9d22556bebec363569d61b573aea1ae89182cc20d)
