# Ship Escrow - Architecture & Consensus Design

## 1. The Core Consensus Primitive

In GenLayer Intelligent Contracts, multi-validator consensus is achieved when independent validators execute the contract code and agree on the return value of the non-deterministic block wrapped in `gl.eq_principle.strict_eq`.

### What Validators Compare
The function passed to `gl.eq_principle.strict_eq` returns strictly **ONE** canonical string:
```
"<VERDICT>|<evidence_sha16>"
```
Where:
- `VERDICT`: One of six strictly defined enum strings:
  - `RELEASE_100`: Full payout (100% of escrowed amount to contributor).
  - `RELEASE_75`: 75% payout to contributor, 25% refunded to creator.
  - `RELEASE_50`: 50% payout to contributor, 50% refunded to creator.
  - `RELEASE_25`: 25% payout to contributor, 75% refunded to creator.
  - `REFUND`: 0% payout, attempt consumed (or refunded if exhausted/cancelled).
  - `REVIEW`: Inconclusive, gated, or truncated without full verification; attempt consumed without financial movement.
- `evidence_sha16`: The first 16 hexadecimal characters of `sha256(diff_bytes)` of the exact public GitHub pull request diff retrieved by the validator.

### Why Include `evidence_sha16`?
Including the evidence hash forces validators to prove they fetched and evaluated the exact same textual evidence. If a GitHub edge node serves stale or mismatched diff text to one validator, consensus fails (`MAJORITY_DISAGREE`) rather than recording an inconsistent state.

### What Is Deliberately Excluded From Consensus
1. **Free-form LLM Explanations / Thoughts**: Large language model prose reasoning naturally varies across runs and validator model seeds. Forcing equality on textual explanations causes false consensus splits.
2. **Per-criterion Intermediate Labels**: The model's raw intermediate labels (`YES`, `PARTIAL`, `NO`, `UNCLEAR`) and structural facts are recorded in the leader-reported informational field (`criterion_results`) for UI display, but are not in the primary consensus equality check.
3. **Execution Timestamps and System Metrics**: Dynamic timestamps vary between nodes and are strictly prohibited from consensus values.

---

## 2. The Verification Pipeline

Each submission via `submit_work(bounty_id, pr_url, head_sha)` executes the following deterministic sequential pipeline:

```
[User Submission: bounty_id, pr_url, head_sha]
                   │
                   ▼
       1. Pre-Execution Validation (UserErrors)
       - Bounty must exist and be OPEN
       - Sender cannot be creator
       - attempts < 3
       - head_sha is 40 lowercase hex
       - pr_url strict structured validation (scheme, host, userinfo, port, path)
       - sha256(bounty_id|head_sha) must not be previously seen
                   │
                   ▼
     2. Non-Deterministic Consensus Block (strict_eq)
       - Source A Fetch: https://github.com/<owner>/<repo>/pull/<n>.diff
       - Source B Fetch: https://github.com/<owner>/<repo>/pull/<n>.patch
       - Patch Commit SHA Cross-Check (must match submitted head_sha -> else REVIEW)
                   │
                   ▼
       3. Structural Facts Extraction (diff_facts)
       - changed_files, added_lines, deleted_lines
       - deleted_files, test_files_touched, test_files_deleted
       - 14,000 char cap check and deterministic truncation
                   │
                   ▼
       4. Hard Deterministic Gates (No LLM)
       - Gate A: required_paths untouched? ───────► REFUND
       - Gate B: any test file deleted?   ───────► REVIEW
                   │
                   ▼
       5. Isolated LLM Adjudication (If no gate fired)
       - Diff isolated as untrusted data in JSON prompt
       - Strict parser: exact 'results' key, exact N items
       - Fallback: unparseable / malformed -> all UNCLEAR
                   │
                   ▼
       6. Pure Decision Arithmetic (decide)
       - MUST == NO ──────────────────────────────► REFUND
       - MUST == UNCLEAR ─────────────────────────► REVIEW
       - Weighted Points / Max Points Percentage
       - Thresholds: 90% (100), 65% (75), 40% (50), 15% (25)
       - Truncation Safety Cap: max RELEASE_50
                   │
                   ▼
       7. Post-Consensus State Mutations
       - Submission record written
       - Balance credits updated
       - If RELEASE_x -> Bounty SETTLED, Settlement record written
       - If attempts >= 3 -> Bounty EXHAUSTED
```

---

## 3. Pure Decision Arithmetic

Each criterion carries a weight:
- `MUST`: Weight = 3
- `SHOULD`: Weight = 1

Values assigned to model labels:
- `YES`: 2 points
- `PARTIAL`: 1 point
- `NO`: 0 points
- `UNCLEAR`: 0 points

Formulas:
- $\text{points} = \sum (\text{weight} \times \text{value})$
- $\text{max\_points} = 2 \times \sum \text{weight}$
- $\text{pct} = \lfloor \frac{\text{points} \times 100}{\text{max\_points}} \rfloor$ (integer division)

### Threshold Table
| Percentage Range | Verdict | Ledger Action |
| :---: | :---: | :---: |
| $\ge 90\%$ | `RELEASE_100` | 100% to dev, 0% to creator |
| $65\% \le \text{pct} < 90\%$ | `RELEASE_75` | 75% to dev, 25% to creator |
| $40\% \le \text{pct} < 65\%$ | `RELEASE_50` | 50% to dev, 50% to creator |
| $15\% \le \text{pct} < 40\%$ | `RELEASE_25` | 25% to dev, 75% to creator |
| $< 15\%$ | `REFUND` | No money moves, attempt + 1 |

---

## 4. Cross-Contract Architecture: ShipReputation

`ShipReputation.py` consumes data from `ShipEscrow.py` using synchronous cross-contract view calls:
```python
escrow = gl.get_contract_at(self.escrow_address)
raw_settlement = escrow.view().get_settlement(bounty_id)
```
- **Pull Model**: Reputation state is updated when `sync(bounty_id)` is called.
- **Idempotency**: `self.processed[bounty_id]` prevents double-counting.
- **Integrity**: Verifies `dev`, `head_sha`, and `criteria_hash` are non-empty before updating scores.
