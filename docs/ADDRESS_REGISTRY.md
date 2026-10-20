# Ship Escrow Address Registry

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  
> RPC Endpoint: `https://studio.genlayer.com/api`  
> Explorer: `https://explorer-studio.genlayer.com`  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants. They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

---

## Active Contracts (V2)

The following contracts are currently active and receive all live bounty escrow submissions:

### ShipEscrowV2
- **Address**: [`0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`](https://explorer-studio.genlayer.com/address/0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd)
- **Deployment Tx**: [`0x6fe51f08455cda0f0fcb9ae35e19258ef062a389507d5d3b9888f6c21fd121c3`](https://explorer-studio.genlayer.com/tx/0x6fe51f08455cda0f0fcb9ae35e19258ef062a389507d5d3b9888f6c21fd121c3)
- **Source File**: `contracts/ShipEscrowV2.py`
- **Source SHA256**: `28bd8f52f5874d58a1b415589ed78f9ee7d8f0a704a1380e7ae91e41e1486cb0`
- **Byte-for-Byte Exact Match**: `true`
- **Deployment Status**: `ACCEPTED` / `MAJORITY_AGREE` / `SUCCESS`

### ShipReputationV2
- **Address**: [`0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`](https://explorer-studio.genlayer.com/address/0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F)
- **Deployment Tx**: [`0x42d8611b053c77ea509344efb93962841c14448b81c19b6437e1dbda4561d60b`](https://explorer-studio.genlayer.com/tx/0x42d8611b053c77ea509344efb93962841c14448b81c19b6437e1dbda4561d60b)
- **Source File**: `contracts/ShipReputationV2.py`
- **Source SHA256**: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
- **Byte-for-Byte Exact Match**: `true`
- **Bound Escrow Address**: `0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`
- **Deployment Status**: `ACCEPTED` / `MAJORITY_AGREE` / `SUCCESS`

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
- **Source File**: `contracts/Probe.py`
- **Findings Recorded in**: `docs/PROBE_DECISIONS.md`
