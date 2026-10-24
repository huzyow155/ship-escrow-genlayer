# Robustness V2 Plan Addendum 3: Gated Consensus Label-Binding on Contract V2.2

> Status: **Pre-Registration**  
> Deployment Target: ShipEscrowV2 (V2.2 Candidate) & ShipReputationV2 (V2.2 Candidate)  
> Fixtures Tested: F1 (PR #2), F4 (PR #5), F5 (PR #6)  
> Submission URLs: Canonical (`https://github.com/hypercybers99/ship-escrow-fixtures/pull/<n>`)  
> Target Spacing: 6–8 seconds between transactions  

---

## 1. Rationale & Contract Changes

Under the pre-registered protocol of Addendum 2, the label vector achieved 10/10 identical results across successful runs for F1, F4, and F5 on V2.1. However, contract V2.1 compared `verdict`, `payout_pct`, `facts`, `gate`, and `diff_sha256`, preserving the label vector as leader-attested with packet hash commitment.

To enforce the pre-registered consensus label-binding rule, contract V2.2 introduces two targeted changes:

### A. Consensus Label-Vector Equality Check

In `contracts/ShipEscrowV2.py`, within `validator_fn`:
```python
# Criterion results consensus binding (list equality)
if validator_packet.get("criterion_results", []) != leader_packet.get("criterion_results", []):
    return False
```
Validators will now independently evaluate the prompt against the diff and verify exact equality of their own `criterion_results` vector with the leader's.

### B. Diagnosable HTTP Error Messages

To eliminate ambiguity between rate limits, username redirections, and genuine network outages, the nondet HTTP client replaces generic error messages with distinct `gl.vm.UserError` exceptions:

1. **HTTP 301, 302, 307, 308**:
   `"Repository moved: use the current owner/repo name in the bounty and the PR URL"`
2. **HTTP 403, 429**:
   `"GitHub rate limit reached, retry later"`
3. **Other Non-200 / Network Exceptions**:
   `"Pull request metadata unavailable"`

---

## 2. Gate Protocol & Adoption Criteria

A new contract pair (V2.2) will be deployed on GenLayer Studionet. Before becoming active, it must pass the following gate:

### Execution Protocol
1. Exactly 10 fresh bounty submissions each for F1, F4, and F5 (30 transactions total).
2. All submissions use canonical repository URLs (`https://github.com/hypercybers99/...`).
3. Transactions are paced with 6–8 seconds spacing to respect validator egress quotas.

### Adoption Gate Rule
The new contract pair V2.2 will become **ACTIVE** if and only if for **every** fixture (F1, F4, F5):
1. **Success Rate**: At least 9 of 10 attempts succeed (`exec=SUCCESS`).
2. **Label Vector Consistency**: At least 9 of the successful runs yield an identical `criterion_results` vector.

### Fallback Condition
If any fixture fails the gate (fewer than 9 successes or fewer than 9 identical label vectors):
1. V2.2 will be permanently documented in [`docs/ADDRESS_REGISTRY.md`](file:///E:/ShipEscrow_V2/docs/ADDRESS_REGISTRY.md) as **"Tried, Not Adopted"** with its measured numbers.
2. Contract pair V2.1 remains the **ACTIVE** production pair.
3. The report will document that label vectors remain leader-attested with packet SHA256 commitment.
