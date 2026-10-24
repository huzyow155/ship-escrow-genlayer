# Ship Escrow Address Registry

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  
> RPC Endpoint: `https://studio.genlayer.com/api`  
> Explorer: `https://explorer-studio.genlayer.com`  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants. They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

---

## Active Contracts (V2.1 - Auditable Assessment Packet Storage)

The following contracts are currently active and receive all live bounty escrow submissions:

### ShipEscrowV2
- **Address**: [`0xE52656081f95B7efa3F7566bd9e8Ace850729adb`](https://explorer-studio.genlayer.com/address/0xE52656081f95B7efa3F7566bd9e8Ace850729adb)
- **Deployment Tx**: [`0xd7017ed1aae313367fc9f0d60988f694f6bea6335b0df1495b5e32b97cbde2de`](https://explorer-studio.genlayer.com/tx/0xd7017ed1aae313367fc9f0d60988f694f6bea6335b0df1495b5e32b97cbde2de)
- **Source File**: `contracts/ShipEscrowV2.py`
- **Source SHA256**: `3ab778a17c06a4e969d30e01f13409353ff39c3bd7f43439950177e2c4365860`
- **Byte-for-Byte Exact Match**: `true`
- **Deployment Status**: `ACCEPTED` / `MAJORITY_AGREE` / `SUCCESS`

### ShipReputationV2
- **Address**: [`0x453abD58F96b19b8F22716b538bF1F94e8aef17D`](https://explorer-studio.genlayer.com/address/0x453abD58F96b19b8F22716b538bF1F94e8aef17D)
- **Deployment Tx**: [`0x9d66fd59dc39acbe41565b25ef9af977ba31de9b66e8710902bb7622ae404dc4`](https://explorer-studio.genlayer.com/tx/0x9d66fd59dc39acbe41565b25ef9af977ba31de9b66e8710902bb7622ae404dc4)
- **Source File**: `contracts/ShipReputationV2.py`
- **Source SHA256**: `12e4c5e9cf8f480823ff778181b6a0d50ae7d37ec7c3a5b079cf6275779d1ed7`
- **Byte-for-Byte Exact Match**: `true`
- **Bound Escrow Address**: `0xE52656081f95B7efa3F7566bd9e8Ace850729adb`
- **Deployment Status**: `ACCEPTED` / `MAJORITY_AGREE` / `SUCCESS`

---

## Superseded Contracts (V2 Initial - Audited in PROMPT SE-V2d)

> [!WARNING]
> The following V2 initial contracts are superseded due to sandboxed consensus storage isolation of `_leader_extra` (`sub.criterion_results = []` and `sub.packet = {}`). Documented as superseded for audit completeness.

### ShipEscrowV2 (Superseded)
- **Address**: [`0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`](https://explorer-studio.genlayer.com/address/0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd)
- **Deployment Tx**: [`0x6fe51f08455cda0f0fcb9ae35e19258ef062a389507d5d3b9888f6c21fd121c3`](https://explorer-studio.genlayer.com/tx/0x6fe51f08455cda0f0fcb9ae35e19258ef062a389507d5d3b9888f6c21fd121c3)
- **Source SHA256**: `28bd8f52f5874d58a1b415589ed78f9ee7d8f0a704a1380e7ae91e41e1486cb0`
- **Status**: Superseded by `0xE52656081f95B7efa3F7566bd9e8Ace850729adb`

### ShipReputationV2 (Superseded)
- **Address**: [`0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`](https://explorer-studio.genlayer.com/address/0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F)
- **Deployment Tx**: [`0x42d8611b053c77ea509344efb93962841c14448b81c19b6437e1dbda4561d60b`](https://explorer-studio.genlayer.com/tx/0x42d8611b053c77ea509344efb93962841c14448b81c19b6437e1dbda4561d60b)
- **Status**: Superseded by `0x453abD58F96b19b8F22716b538bF1F94e8aef17D`

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
