# PR #8 Two-Step Advancing Head Verification Plan

> Status: **Pre-Registration**  
> Target Contract: ShipEscrowV2 (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`)  
> Target Fixture: PR #8 (`https://github.com/huzyow155/ship-escrow-fixtures/pull/8`)  
> Target Bounty: Bounty ID 19  

## 1. Scenario Protocol

PR #8 represents an advancing pull request where new commits were pushed after an initial commit:
- Stale commit SHA: `c4eb7b2a842c306b159e1c5d66d61575b67f1ef6`
- Current real HEAD SHA (from git refs / GitHub): `2332a887996496eed2f20ed63e2c3b51fefde204`

### Step a: Stale Head SHA Rejection (Completed & Verified)
- Developer submits stale commit SHA `c4eb7b2a842c306b159e1c5d66d61575b67f1ef6`
- Expected: Reverted with error `"Head sha does not match the pull request head"`
- Bounty attempts remain `0`, bounty status remains `OPEN`
- Recorded in: `docs/evidence_v2/multicommit/pr8_step_a_stale_receipt.json`

### Step b: Current Real Head SHA Acceptance (To Be Executed)
- Developer submits authentic current head SHA `2332a887996496eed2f20ed63e2c3b51fefde204`
- Expected: Consensus reached, execution result `SUCCESS`
- Bounty status transitions from `OPEN` to `SETTLED` (`RELEASE_100`)
- Bounty snapshot before and after recorded raw
- Stored settlement and submission record verified on-chain
