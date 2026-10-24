# Pre-Registration: Multi-Commit Head Proof & Stale Head Rejection (Section 0)

> Status: **Pre-Registration (Committed Before Live On-Chain Runs)**  
> Target Contract: `ShipEscrowV2` at `0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> Scope: Joaquin (Contract Reviewer) Request for Multi-Commit Head Commit Authentication & Contrast

---

## 1. Background & Vulnerability in V1 Architecture

In Ship Escrow V1 (`archive/v1/ShipEscrowV1.py`), pull request revisions were fetched via `https://github.com/<owner>/<repo>/pull/<n>.patch`. V1 parsed the head commit using:
```python
for line in lines[:10]:
    if line.startswith("From "):
        parts = line.split()
        if len(parts) >= 2 and len(parts[1]) == 40:
            return parts[1].lower()
```
Because Git patch format formats the earliest patch in a series as `[PATCH 1/N]` with the initial commit on line 1, V1 extracted the **FIRST commit SHA** of a multi-commit pull request, treating the earliest skeleton commit as the PR head. Consequently:
- Submitting the real head commit resulted in a false mismatch revert (`patch_head_sha_mismatch`).
- Submitting the first commit was accepted as the head even if subsequent commits contained breaking bugs, deleted tests, or malicious code.

### ShipEscrowV2 Fix
ShipEscrowV2 queries the authoritative GitHub REST API endpoint `https://api.github.com/repos/<owner>/<repo>/pulls/<n>`, which exposes the true current branch head under `meta["head"]["sha"]`. The contract strictly asserts:
```python
auth_head_sha = meta.get("head", {}).get("sha", "").lower()
if not auth_head_sha or auth_head_sha != valid_head_sha:
    raise gl.vm.UserError("Head sha does not match the pull request head")
```
Furthermore, `valid_head_sha` is bound to:
1. Duplicate protection: `seen_key = hashlib.sha256(f"{bounty_id}|{valid_head_sha}".encode("utf-8")).hexdigest()`
2. Stored settlement record: `settlement_record["head_sha"] = valid_head_sha`
3. Stored submission record: `submission_record["head_sha"] = valid_head_sha`
4. Cross-contract consumer verification: `is_settled_for(bounty_id, criteria_hash, head_sha, dev, min_payout_pct)`

---

## 2. Multi-Commit Scenario: Fixture PR #7 (3 Commits)

- **Target PR**: `https://github.com/huzyow155/ship-escrow-fixtures/pull/7`
- **Wallet Marker**: `ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C`
- **Commits on PR #7**:
  1. First commit: `21c20625d3b919b2acce25f82339b7b54bdfba01` (`feat: initial slugify skeleton`)
  2. Middle commit: `b3b260f22889ea443bcdebd81cdc4c2a94688708` (`test: add slugify unit tests`)
  3. Real current head: `960fbf1ac0e73a099f4251512b5c2d569252ac39` (`feat: complete robust slugify implementation`)

### Expected Execution Steps (Fresh Bounty)
1. **Step a (First Commit SHA - V1 legacy behavior)**:
   - Call: `submit_work(bounty_id, PR#7_url, "21c20625d3b919b2acce25f82339b7b54bdfba01")`
   - Expected Result: `ERROR` (Revert with `gl.vm.UserError("Head sha does not match the pull request head")`)
   - State Snapshot: `attempts` remains `"0"`, status remains `"OPEN"`.
2. **Step b (Middle Commit SHA)**:
   - Call: `submit_work(bounty_id, PR#7_url, "b3b260f22889ea443bcdebd81cdc4c2a94688708")`
   - Expected Result: `ERROR` (Revert with `gl.vm.UserError("Head sha does not match the pull request head")`)
   - State Snapshot: `attempts` remains `"0"`, status remains `"OPEN"`.
3. **Step c (Random 40-hex SHA)**:
   - Call: `submit_work(bounty_id, PR#7_url, "0123456789abcdef0123456789abcdef01234567")`
   - Expected Result: `ERROR` (Revert with `gl.vm.UserError("Head sha does not match the pull request head")`)
   - State Snapshot: `attempts` remains `"0"`, status remains `"OPEN"`.
4. **Step d (Real Current Head)**:
   - Call: `submit_work(bounty_id, PR#7_url, "960fbf1ac0e73a099f4251512b5c2d569252ac39")`
   - Expected Result: `ACCEPTED`, `MAJORITY_AGREE`, `SUCCESS`, verdict `RELEASE_100`.
   - State Snapshot: `attempts` becomes `"1"`, status becomes `"SETTLED"`.

### Expected Post-Settlement Invariants
- `is_settled_for(bounty_id, criteria_hash, "960fbf1ac0e73a099f4251512b5c2d569252ac39", dev, 25) == True`
- `is_settled_for(bounty_id, criteria_hash, "21c20625d3b919b2acce25f82339b7b54bdfba01", dev, 25) == False`
- Stored `head_sha` in settlement == Stored `head_sha` in submission == Authoritative GitHub API head (`960fbf1ac0e73a099f4251512b5c2d569252ac39`)
- Duplicate submit of real head -> Reverts with `"Duplicate submission for head sha"` (or already settled)

---

## 3. Advancing Head Scenario: Fixture PR #8

- **Target PR**: `https://github.com/huzyow155/ship-escrow-fixtures/pull/8`
- **Wallet Marker**: `ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C`
- **Commits on PR #8**:
  1. Stale / Old head: `c4eb7b2a842c306b159e1c5d66d61575b67f1ef6`
  2. Real current head: `2332a887996496eed2f20ed63e2c3b51fefde204`

### Expected Execution Steps (Fresh Bounty)
1. **Step a (Stale Head SHA)**:
   - Call: `submit_work(bounty_id, PR#8_url, "c4eb7b2a842c306b159e1c5d66d61575b67f1ef6")`
   - Expected Result: `ERROR` (Revert with `gl.vm.UserError("Head sha does not match the pull request head")`)
   - State Snapshot: `attempts` remains `"0"`, status remains `"OPEN"`.
2. **Step b (Current Real Head SHA)**:
   - Call: `submit_work(bounty_id, PR#8_url, "2332a887996496eed2f20ed63e2c3b51fefde204")`
   - Expected Result: `ACCEPTED`, `MAJORITY_AGREE`, `SUCCESS`, evaluated.
