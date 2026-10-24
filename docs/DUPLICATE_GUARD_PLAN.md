# Duplicate Submission Guard Verification Plan on OPEN Bounty

> Status: **Pre-Registration**  
> Target Contract: ShipEscrowV2 (`0x8a9c079a7E1F756e07e8FbE392a5E93106DE28bF`)  
> Target PR: PR #4 (`https://github.com/huzyow155/ship-escrow-fixtures/pull/4`)  
> Target Head SHA: `aa9a2af9ccb0fa6d13b030a8f176c5235d15a982`  

## 1. Objective
Test the internal duplicate submission guard (`self.seen[seen_key]`) on an **OPEN** bounty.
In a settled bounty, re-submitting returns `"Bounty is not open for submission"`, which masks the internal duplicate guard.
On an OPEN bounty where a submission has executed without settling (e.g. Non-fatal gate `test_deleted` yielding verdict `REVIEW`), re-submitting the exact same HEAD SHA must trigger the specific duplicate guard.

## 2. Protocol Steps
1. Creator creates a fresh bounty on the active escrow contract.
2. Developer submits PR #4 (head `aa9a2af9ccb0fa6d13b030a8f176c5235d15a982`).
   - Execution result: `SUCCESS`
   - Gate: `test_deleted`
   - Verdict: `REVIEW`
   - Bounty status remains `OPEN`, bounty attempts incremented from `0` to `1`.
   - Submission recorded on chain with ID `sub_N`.
3. Developer immediately submits the EXACT same head SHA `aa9a2af9ccb0fa6d13b030a8f176c5235d15a982` to the same bounty.
   - Expected Result: Reverted (`exec=ERROR`)
   - Exact Error String: `"Duplicate submission for head sha: existing submission <sub_N>"`
   - Bounty status remains `OPEN`
   - Bounty attempts remain unchanged at `1` (duplicate attempt is rejected prior to attempt increment)
4. Record raw transaction receipts and bounty snapshots before and after.
