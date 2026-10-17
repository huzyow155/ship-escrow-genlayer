# Ship Escrow & Ship Reputation - Integration Guide

This guide describes how frontend clients and external dApps interact with the deployed `ShipEscrow` and `ShipReputation` Intelligent Contracts on GenLayer Studionet.

---

## 1. Network & Contract Addresses

- **Network**: GenLayer Studionet
- **Chain ID**: `61999`
- **RPC Endpoint**: `https://studio.genlayer.com/api`
- **Explorer Base**: `https://explorer-studio.genlayer.com`
- **ShipEscrow Address**: `0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`
- **ShipReputation Address**: `0x55c56f0dfFb8227345814A37c68394b05c26E901`

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

### `create_bounty(title, owner_repo, criteria_json, required_paths_json, amount) -> str`
- **Parameters**:
  - `title` (`str`): 3-80 ASCII chars. E.g. `"Implement slugify(text) in src/slug.py"`
  - `owner_repo` (`str`): Format `"owner/repo"`. E.g. `"huzyow155/ship-escrow-fixtures"`
  - `criteria_json` (`str`): JSON string of 1-5 criteria objects `[{"text": "...", "level": "MUST"|"SHOULD"}]`. At least one MUST required.
  - `required_paths_json` (`str`): JSON string of 0-3 path prefixes `["src/slug.py"]`.
  - `amount` (`str`): Integer string `1` to `1000000`. E.g. `"1000"`.
- **Returns**: `bounty_id` (string).
- **Average Latency**: ~5.3 to 7.5 seconds.

### `submit_work(bounty_id, pr_url, head_sha) -> str`
- **Parameters**:
  - `bounty_id` (`str`): ID of an OPEN bounty.
  - `pr_url` (`str`): Public GitHub pull request URL. E.g. `"https://github.com/huzyow155/ship-escrow-fixtures/pull/2"`
  - `head_sha` (`str`): 40-character lowercase commit hash. E.g. `"5db0441e76af93606fd82feebbe49c5a2f145326"`
- **Returns**: Verdict string (`"RELEASE_100"`, `"RELEASE_75"`, `"RELEASE_50"`, `"RELEASE_25"`, `"REFUND"`, `"REVIEW"`).
- **Latency**:
  - Hard Gate triggered: ~11 to 14 seconds (fast exit without LLM).
  - LLM Evaluation: ~20 to 35 seconds.

### `cancel_bounty(bounty_id) -> None`
- Creator only; refunds amount back to creator credit balance; marks status `CANCELLED`.

### `refund_exhausted(bounty_id) -> None`
- Creator only; callable only when attempts reach 3 (`EXHAUSTED`); refunds amount back to creator.

### `ShipReputation.sync(bounty_id) -> None`
- Synchronizes settlement record from `ShipEscrow` into reputation counters for developer and creator. Idempotent.

---

## 4. Public View Methods & Example Responses

### `get_bounty(bounty_id: str) -> str`
```json
{
  "amount": "1000",
  "attempts": "0",
  "creator": "0x720203a9fc938ef561290f024485a4a5d3b6d885",
  "criteria": [
    {
      "level": "MUST",
      "text": "Adds a function slugify(text) in src/slug.py that lowercases and collapses runs of non-alphanumeric characters into a single hyphen"
    },
    {
      "level": "MUST",
      "text": "Adds at least one test under tests/ that calls slugify"
    },
    {
      "level": "SHOULD",
      "text": "Updates README.md with a usage example"
    },
    {
      "level": "SHOULD",
      "text": "Changes no unrelated files"
    }
  ],
  "criteria_hash": "a360be5e7af9cd6f7e1b07f6113c1366657efc9e53a9da3ec1fd97607165eda8",
  "id": "1",
  "owner_repo": "huzyow155/ship-escrow-fixtures",
  "required_paths": [
    "src/slug.py"
  ],
  "schema_version": "1",
  "seq": "1",
  "status": "OPEN",
  "title": "Implement slugify(text) in src/slug.py"
}
```

### `get_settlement(bounty_id: str) -> str`
```json
{
  "bounty_id": "1",
  "creator": "0x720203a9fc938ef561290f024485a4a5d3b6d885",
  "creator_amount": "0",
  "criteria_hash": "a360be5e7af9cd6f7e1b07f6113c1366657efc9e53a9da3ec1fd97607165eda8",
  "dev": "0x43b2e597ba1828f0907d89052b04fbb1c7fe298b",
  "dev_amount": "1000",
  "evidence_sha16": "ecd93f38b55992bc",
  "head_sha": "5db0441e76af93606fd82feebbe49c5a2f145326",
  "pr_url": "https://github.com/huzyow155/ship-escrow-fixtures/pull/2",
  "schema_version": "1",
  "submission_id": "1",
  "verdict": "RELEASE_100"
}
```

### `get_stats() -> str`
```json
{
  "cancelled": 0,
  "exhausted": 0,
  "open": 1,
  "refunded": 0,
  "schema_version": "1",
  "settled": 0,
  "verdict_refund": 0,
  "verdict_release_100": 0,
  "verdict_release_25": 0,
  "verdict_release_50": 0,
  "verdict_release_75": 0,
  "verdict_review": 0
}
```

### `is_settled_for(bounty_id, criteria_hash, head_sha, dev) -> bool`
Returns `true` if and only if the settlement matches all four arguments. Third-party smart contracts and automated bots MUST use this view to safely gate downstream execution.
