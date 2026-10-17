# Ship Escrow Intelligent Contract

> Status: **Preview**  
> Target Network: **GenLayer Studionet** (Chain ID: 61999)  
> License: MIT (Copyright 2026 Hyper, huzyow155)  
> ShipEscrow Address: [`0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`](https://explorer-studio.genlayer.com/address/0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F)  
> ShipReputation Address: [`0x55c56f0dfFb8227345814A37c68394b05c26E901`](https://explorer-studio.genlayer.com/address/0x55c56f0dfFb8227345814A37c68394b05c26E901)  
> Web app (Preview): https://ship-escrow-app.vercel.app  
> App repository: https://github.com/huzyow155/ship-escrow-app  
> Fixtures: https://github.com/huzyow155/ship-escrow-fixtures  

Ship Escrow is an Intelligent Contract on GenLayer that automates bounty escrow settlement for GitHub pull requests. It combines deterministic structural diff parsing, hard safety gates, and multi-validator LLM consensus to evaluate code against human-written acceptance criteria.

---

## How to try it in 2 minutes

No wallet is needed to read:
1. Open the web app: https://ship-escrow-app.vercel.app
2. Inspect Bounty 14 (settled, `RELEASE_100` verdict).
3. Scroll to the **Settlement Verification Tool**: click **Verify Settlement On-Chain** to see `✓ VERIFIED: TRUE`.
4. Click **Mutate 1 Char** and verify it returns `✗ MISMATCH: FALSE`.
5. Open the **Evidence** page to review all pre-registered fixture predictions against on-chain transaction receipts.

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

- **`ShipEscrow.py`**: The primary Intelligent Contract handling bounty lifecycle (`create_bounty`, `submit_work`, `cancel_bounty`, `refund_exhausted`), hard gate checks, diff parsing, and balance bookkeeping.
- **`ShipReputation.py`**: A cross-contract consumer contract that synchronizes settlement records via synchronous view calls (`sync(bounty_id)`) to maintain public contributor and creator reputation scores.

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
│   ├── ERROR_CODES.md         # Categorized list of all UserError strings
│   └── evidence/              # Raw transaction receipt captures
├── scripts/
│   ├── deploy/                # Deployment and verification scripts
│   ├── scan_ascii.py          # Enforces pure ASCII contract files
│   ├── scan_banned_words.py   # Enforces honest phrasing standards
│   └── scan_secrets.py        # Prevents credential leaks
└── tests/                     # Multi-layered test suites
```

---

## 6. Step-by-Step: Deploy to Studionet

```bash
# 1. Install dependencies
npm install

# 2. Deploy ShipEscrow
node scripts/deploy/deploy_ship_escrow.js

# 3. Deploy ShipReputation (pointing to ShipEscrow)
node scripts/deploy/deploy_reputation.js

# 4. Verify source code on-chain (byte-for-byte exact match)
node scripts/verify_source.js

# 5. Run the studionet evidence suite
node scripts/deploy/run_live_evidence.js
```

---

## 7. Testing & Verification

```bash
# Run all unit test suites (Layer 1 pure, Layer 2 mocked, Layer 3 consensus, Star Test)
python -m unittest discover tests

# Run security, ASCII compliance, and honest phrasing scanners
npm run check
```
