# Ship Escrow Intelligent Contract

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> License: MIT (Copyright 2026 Hyper, huzyow155)

Ship Escrow is an Intelligent Contract on GenLayer that automates bounty escrow settlement for GitHub pull requests. It combines deterministic structural diff parsing, hard safety gates, and multi-validator LLM consensus to evaluate code against human-written acceptance criteria.

---

## 1. Problem Statement

Open-source bounty programs traditionally suffer from two failure modes:
1. **Maintainer Centralization & Delay**: Payouts require human maintainers to manually evaluate PRs. Maintainers can delay indefinitely, arbitrarily reject valid work, or merge PRs without releasing funds.
2. **Naive Automation Vulnerability**: Automated bots that rely solely on "green CI" or keyword matching ("fixes #1") are easily gamed by contributors who delete failing tests or modify only documentation without implementing requested features.

---

## 2. Why GenLayer

Ship Escrow requires two capabilities impossible on traditional EVM chains:
- **Direct Web Access**: Validators independently fetch public GitHub pull request diffs and commit metadata over HTTPS.
- **Natural Language & Semantic Judgment**: Validators interpret whether code changes fulfill written acceptance criteria using an LLM.

Consensus is reached when independent validators agree on a single canonical verdict string and evidence hash (`<VERDICT>|<diff_sha16>`) via `gl.eq_principle.strict_eq`.

---

## 3. Non-Goals

- **No Token Custody**: Studionet does not provide external token custody. Balances are tracked as credit accounts in an on-contract ledger.
- **No Dynamic Code Execution**: Ship Escrow does not run compilers, execute tests, or execute arbitrary code. It judges textual diffs and metadata.
- **Public GitHub Repositories Only**: Private repositories, GitLab, and other code hosts are out of scope.
- **Majority Consensus, Not Absolute Certainty**: Borderline code changes may result in split votes or `REVIEW` verdicts.
- **No Native Deadlines**: Due to lack of a trusted on-chain clock in GenVM, time-based expirations are not enforced.
- **Criteria Dependent**: Evaluation quality is strictly bound to the quality and precision of the creator's written criteria.

---

## 4. Contract Architecture

- **`ShipEscrow.py`**: The main bounty escrow contract handling bounty lifecycle (`create_bounty`, `submit_work`, `cancel_bounty`, `refund_exhausted`), hard gate checks, diff parsing, and balance bookkeeping.
- **`ShipReputation.py`**: A cross-contract consumer contract that synchronizes settlement records via synchronous view calls to maintain public contributor and creator reputation scores.

---

## 5. Repository Structure

```
.
├── contracts/
│   ├── ShipEscrow.py          # Primary Intelligent Contract
│   ├── ShipReputation.py      # Reputation Consumer Contract
│   └── Probe.py               # Runtime diagnostic probe
├── fixtures/
│   ├── bounty.json            # Reference bounty definition
│   ├── EXPECTED.md            # Pre-registered fixture predictions
│   └── diffs/                 # Raw PR diffs for offline evaluation
├── docs/
│   ├── PRIOR_ART.md           # Prior art comparison and honest differences
│   ├── DESIGN.md              # Consensus primitive & architectural design
│   ├── LIMITATIONS.md         # Comprehensive list of honest limitations
│   ├── RUNTIME_NOTES.md       # Empirical runtime diagnostic findings
│   ├── INTEGRATION.md         # Full frontend and SDK integration guide
│   ├── VERIFICATION.md        # Source code verification and on-chain hashes
│   └── evidence/              # Raw transaction receipt captures
├── scripts/
│   ├── deploy/                # Deployment and verification scripts
│   ├── scan_ascii.py          # Enforces pure ASCII contract files
│   ├── scan_banned_words.py   # Enforces honest phrasing standards
│   └── scan_secrets.py        # Prevents credential leaks
└── tests/                     # Multi-layered test suites
```

---

## 6. Testing & Deployment

```bash
# Run unit tests
python -m unittest discover tests

# Run security and compliance scans
npm run check
```
