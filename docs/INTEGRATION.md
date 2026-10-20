# Ship Escrow V2 & Ship Reputation V2 - Integration Guide

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  
> RPC Endpoint: `https://studio.genlayer.com/api`  
> Explorer Base: `https://explorer-studio.genlayer.com`  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants (`total_balances + total_escrowed == total_minted`). They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

---

## 1. Network & Active V2 Contract Addresses

- **ShipEscrowV2**: [`0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`](https://explorer-studio.genlayer.com/address/0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd)
- **ShipReputationV2**: [`0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F`](https://explorer-studio.genlayer.com/address/0x88F9Bb007266f4e35Ad50a6a244117EC61BC446F)

*(Superseded V1 addresses for audit reference: Escrow `0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`, Reputation `0x55c56f0dfFb8227345814A37c68394b05c26E901`)*

---

## 2. Transaction Receipt Success Rule

A write transaction is successful **ONLY IF**:
1. `receipt.status_name` is `'ACCEPTED'` or `'FINALIZED'`
2. `receipt.result_name` is `'MAJORITY_AGREE'`
3. `receipt.consensus_data.leader_receipt[0].execution_result` is `'SUCCESS'`

```typescript
function isTxSuccess(receipt: any): boolean {
  const statusOk = receipt.status_name === 'ACCEPTED' || receipt.status_name === 'FINALIZED';
  const consensusOk = receipt.result_name === 'MAJORITY_AGREE';
  const execOk = receipt.consensus_data?.leader_receipt?.[0]?.execution_result === 'SUCCESS';
  return statusOk && consensusOk && execOk;
}
```

---

## 3. Public Write Methods

### `claim_demo_credits() -> str`
- **Caller**: Any address (restricted to once per address).
- **Effect**: Credits 1,000 demo units to caller; increases `total_minted` by 1,000.
- **Returns**: Amount minted (`"1000"`).

### `create_bounty(title, owner_repo, criteria_json, required_paths_json, amount) -> str`
- **Parameters**:
  - `title` (`str`): 3-80 ASCII chars. E.g. `"Implement slugify(text) in src/slug.py"`
  - `owner_repo` (`str`): Format `"owner/repo"`. E.g. `"huzyow155/ship-escrow-fixtures"`
  - `criteria_json` (`str`): JSON array of 1-5 criteria objects `[{"text": "...", "level": "MUST"|"SHOULD"}]`. At least one MUST required.
  - `required_paths_json` (`str`): JSON array of 0-3 path prefixes `["src/"]`.
  - `amount` (`str`): Integer string `1` to `1000000`. E.g. `"50"`.
- **Pre-condition**: Caller must have `balance >= amount`.
- **Returns**: `bounty_id` (decimal string).

### `submit_work(bounty_id, pr_url, head_sha) -> str`
- **Parameters**:
  - `bounty_id` (`str`): ID of an OPEN bounty.
  - `pr_url` (`str`): Public GitHub pull request URL. E.g. `"https://github.com/huzyow155/ship-escrow-fixtures/pull/2"`
  - `head_sha` (`str`): 40-character lowercase commit hash. E.g. `"5db0441e76af93606fd82feebbe49c5a2f145326"`
- **Pre-conditions**:
  - Caller must have `balance >= 50` for refundable submission bond.
  - Caller developer attempts on bounty < 2; total bounty attempts < 6.
  - PR description on GitHub must contain `ship-escrow-wallet: 0x<caller_address>`.
- **Returns**: Verdict string (`"RELEASE_100"`, `"RELEASE_75"`, `"RELEASE_50"`, `"RELEASE_25"`, `"REFUND"`, `"REVIEW"`).

### `cancel_bounty(bounty_id) -> None`
- **Caller**: Creator only.
- **Pre-condition**: Bounty must be `OPEN` and `attempts == 0`.
- **Effect**: Unlocks escrowed balance back to creator; marks status `CANCELLED`.

### `refund_exhausted(bounty_id) -> None`
- **Caller**: Creator only.
- **Pre-condition**: Bounty status must be `EXHAUSTED` (all 6 attempts consumed).
- **Effect**: Unlocks escrowed balance back to creator; marks status `REFUNDED`.

### `ShipReputationV2.sync(bounty_id, min_payout_pct) -> None`
- **Parameters**:
  - `bounty_id` (`str`): Settled bounty ID.
  - `min_payout_pct` (`int`): Required payout threshold (25 to 100).
- **Effect**: Verifies settlement with `is_settled_for` and accumulates verified metrics.

---

## 4. Public View Methods

- `get_ledger_invariant() -> str`: Returns `{"invariant_holds": true, "total_balances": "...", "total_escrowed": "...", "total_minted": "..."}`.
- `get_balance(addr) -> str`: Returns credit balance of address.
- `get_escrowed(bounty_id) -> str`: Returns credits locked in bounty.
- `get_bounty(bounty_id) -> str`: Returns canonical JSON bounty record.
- `get_submission(sub_id) -> str`: Returns canonical JSON submission record with `packet_sha256`.
- `is_settled_for(bounty_id, criteria_hash, head_sha, dev, min_payout_pct) -> bool`: Verifies settlement facts.
- `get_limits() -> str`: Returns operational constants and rules.
- `get_stats() -> str`: Returns aggregated protocol counters.
