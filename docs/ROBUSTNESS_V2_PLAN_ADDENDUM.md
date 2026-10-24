# Pre-Registration Plan Addendum: Stored Assessment Packets & Label Vector Robustness (PROMPT SE-V2d)

> Status: **Pre-Registration (Committed Before Code Modification & Redeployment)**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> Pre-Registration Timestamp: 2026-10-24T03:30:00Z  

---

## 1. Context & Diagnosis of Previous Deployment

In the initial V2 deployment (`0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`), assessment packets were structured inside the non-deterministic block and assigned to a module-level variable `_leader_extra`. Because `gl.eq_principle.strict_eq` executes the nondet closure inside an isolated sandbox, modifications to module-level state were not preserved in the outer execution frame. Consequently:
- Submissions stored `criterion_results = []` and `packet = {}`.
- While verdicts (`verdict`), payout percentages (`payout_pct`), and packet hashes (`packet_sha256`) were correctly agreed upon and persisted, the detailed label vectors were not recorded in contract storage.
- An empirical assessment of the label vector stability rule could not be evaluated on empty vectors.

---

## 2. Architectural Upgrade via `gl.vm.run_nondet`

To make assessment records fully auditable as requested by the steward, the consensus mechanism is upgraded from `gl.eq_principle.strict_eq` to `gl.vm.run_nondet(leader_fn, validator_fn)`:

1. **Leader Execution (`leader_fn`)**:
   - Fetches authoritative GitHub API metadata and validates PR state, same-repository constraint, head SHA match, and wallet marker.
   - Fetches the immutable compare-by-SHA diff.
   - Computes structural facts (`diff_facts`).
   - Evaluates safety gates (`diff_truncated`, `test_deleted`, `required_path_untouched`).
   - If no gate fires, executes the semantic LLM prompt and parses criteria labels (`YES`, `PARTIAL`, `NO`, `UNCLEAR`).
   - Determines `verdict` and `payout_pct` via `decide()`.
   - Constructs the complete canonical assessment packet dictionary including `criterion_results`, `gate`, `gate_reason`, `facts`, `metadata`, `diff_sha256`, `criteria_hash`, `head_sha`, `base_sha`, `body_sha256`, `verdict`, and `payout_pct`.
   - Returns the canonical JSON string `canonical_json(packet)` as the leader's return value.

2. **Validator Validation (`validator_fn`)**:
   - Unpacks leader return data `gl.vm.unpack_result(result)` and parses `leader_packet`.
   - Independently fetches GitHub PR metadata and re-authenticates state, repo, head SHA, base SHA, and wallet marker.
   - Independently fetches compare-by-SHA diff and verifies `diff_sha256 == leader_packet["diff_sha256"]`.
   - Recomputes structural facts and verifies exact equality with `leader_packet["facts"]`.
   - Re-evaluates safety gates and verifies `gate == leader_packet["gate"]`.
   - If a gate fired, verifies that leader's `verdict` and `payout_pct` match the gate requirements.
   - If no gate fired, independently executes the LLM prompt and checks that the validator's verdict and payout percentage agree with the leader (`val_verdict == leader_packet["verdict"]` and `val_payout == leader_packet["payout_pct"]`).
   - Returns `True` if all validations hold, rejecting the block if any condition fails.

3. **Outer Storage Mutation**:
   - The outer write function `submit_work` receives `leader_json` directly from `gl.vm.run_nondet`.
   - Computes `packet_sha256 = hashlib.sha256(leader_json.encode("utf-8")).hexdigest()`.
   - Stores `packet`, `packet_sha256`, `criterion_results`, and `gate` directly into `self.submissions[sub_id]`.

---

## 3. Label-Vector Stability Rule (Unchanged from Plan 1)

Fresh on-chain robustness runs will be executed on the newly deployed contract:
- 10 runs on Fixture F1 (PR #2).
- 10 runs on Fixture F4 (PR #5).
- 10 runs on Fixture F5 (PR #6).

Evaluation criteria (read from on-chain `criterion_results`):
1. If the label vector is identical in at least 9 of 10 runs for **EVERY ONE** of the three fixtures ($\ge 9/10$ on F1, $\ge 9/10$ on F4, $\ge 9/10$ on F5):
   - The label vector is considered stable across validators.
   - Validator comparison will enforce strict label equality (`val_labels == leader_packet["criterion_results"]`).
2. If ANY fixture exhibits fewer than 9 of 10 identical label vectors:
   - Consensus comparison enforces `verdict` and `payout_pct`.
   - The criterion labels are recorded on-chain as **"leader-attested, packet-hash committed, not consensus-bound"**.

---

## 4. Offline Packet Hash Recomputation Verification

To prove that the stored packet is genuinely auditable without relying on live GitHub API or chain transactions:
- `scripts/recompute_packet.mjs` will iterate through every on-chain submission record.
- For each submission, it takes the stored `packet` dictionary, encodes it via canonical JSON, and hashes it with SHA-256.
- It asserts `sha256(canonical_json(packet)) === packet_sha256` for 100% of stored submissions.
