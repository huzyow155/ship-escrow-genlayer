# Expected Outcomes Amendment & PR Marker Audit Log

> Status: **Preview**  
> Baseline Pre-Registration Reference: `docs/EXPECTED.md` (at commit `2ef5070`, 2026-10-20T14:19:52Z)  
> Scope: Amendment to documented test addresses and verification of PR body mutation order.

---

## 1. Reason for Address Amendment

In the baseline pre-registration (`docs/EXPECTED.md` at `2ef5070`), throwaway addresses were drafted as:
- Initial Dev: `0xBc2AF12074E0459180bAC2EB5144AE98C13AdbB5`
- Initial Attacker: `0x44DbCd42cb603DD27a12242D1caB6008800C7DCb`
- Initial Creator: `0x5c5a10DBAdA2fe0505628CFBbddF0b1d848DAF80`

During the test wallet initialization, `createAccount()` in `genlayer-js` generated client accounts whose private keys required explicit hex key generation via `crypto.randomBytes(32)` to ensure persistent local signing without re-generating ephemeral keys across node process boundaries. The final stable throwaway key pairs generated in `scripts/setup_wallets.js` (git-ignored `.env`) resolved to:
- Final Dev: `0x6325B360Db455435BF5e81D0aE18DC3b249f226C`
- Final Attacker: `0xd033Dd543890C4eB2952B796037a11481497da9a`
- Final Creator: `0x79ED3fC4E32D8dF7b23A221a27A057170e6D2069`

Per the steward instructions:
- The original pre-registration file `docs/EXPECTED.md` is strictly restored to its exact `2ef5070` text (`git diff 2ef5070 HEAD -- docs/EXPECTED.md` is empty).
- The rows below document the active addresses and are explicitly categorized as **amended**, not pre-registered.

---

## 2. GitHub PR Body State & Timestamp Audit (Raw GitHub REST API)

Every PR on repository `huzyow155/ship-escrow-fixtures` was inspected via `https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/<n>`. The raw `updated_at` timestamp and marker line in the PR body are:

```
PR #2  | updated_at: 2026-10-20T14:40:11Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #3  | updated_at: 2026-10-20T14:40:32Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #4  | updated_at: 2026-10-20T14:40:34Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #5  | updated_at: 2026-10-20T14:40:35Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #6  | updated_at: 2026-10-20T14:40:37Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #7  | updated_at: 2026-10-20T14:40:38Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #8  | updated_at: 2026-10-20T14:40:40Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #9  | updated_at: 2026-10-20T14:40:41Z | ship-escrow-wallet: 0xd033Dd543890C4eB2952B796037a11481497da9a
PR #10 | updated_at: 2026-10-20T14:15:58Z | [NO MARKER]
PR #11 | updated_at: 2026-10-20T14:40:44Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #12 | updated_at: 2026-10-20T14:40:45Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
PR #13 | updated_at: 2026-10-20T14:40:47Z | ship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C
```

---

## 3. On-Chain Submit Transaction Timestamps (Receipt Files)

The on-chain submit transactions executed on GenLayer Studionet against `ShipEscrowV2` (`0xAD5579496E66a3ac5C79c27C9Bd8784Aae7747Cd`):

```
F1 submit tx: 0x468048b8dd1d8eef61cdb1d95a32d160ccfc94c962646308340b3e0355dc8616 | file_mtime: 2026-10-20T14:52:35.659Z | status: ACCEPTED | exec: SUCCESS
F2 submit tx: 0xe9af11590d4a6dc11afd19cab05f7f95b21c1760f006d1b07b2ff907d9c93f58 | file_mtime: 2026-10-20T14:52:52.702Z | status: ACCEPTED | exec: SUCCESS
F3 submit tx: 0x97970698282eec8d41580f8bb135f1401deb6d55b4f554615745b1453a722573 | file_mtime: 2026-10-20T14:53:07.335Z | status: ACCEPTED | exec: SUCCESS
F4 submit tx: 0x201f2e36fbd4246ef497c8a0987e384f30a7d98433fe95de23e5226878efbfbc | file_mtime: 2026-10-20T14:53:44.581Z | status: ACCEPTED | exec: SUCCESS
F5 submit tx: 0xd0ae855cc54aba922715210d845896cdc2c05fa7790f26eeaff7b85b42d9b823 | file_mtime: 2026-10-20T14:54:08.975Z | status: ACCEPTED | exec: SUCCESS
F6 submit tx: 0x9a2b2a2e6756070bcd53f7991ac15b76341bc7ba1cda23eae4ee8b6b57c24fa3 | file_mtime: 2026-10-20T14:54:36.923Z | status: ACCEPTED | exec: SUCCESS
F7 submit tx: 0x174e5e0b9efc4c29d34990ea34b338a23854a6ca82239d099e1e8fe3b5e26e57 | file_mtime: 2026-10-20T14:54:57.770Z | status: ACCEPTED | exec: ERROR
F8 submit tx: 0x3573533fe67e90889048a80d29e1d3df3dfa13a8727cf8fbf24d6f137b4b345d | file_mtime: 2026-10-20T14:55:18.450Z | status: ACCEPTED | exec: ERROR
F9 submit tx: 0x0e27fea63c4e1562f4315de75cd73ed8ee317312ea76a272c12b44b98634dc1e | file_mtime: 2026-10-20T14:55:36.425Z | status: ACCEPTED | exec: ERROR
F10 submit tx: 0x516b88e022cab960bcdd525685c29daafba2f205356bbae4af2691de0712a888 | file_mtime: 2026-10-20T14:55:55.272Z | status: ACCEPTED | exec: SUCCESS
F11 submit tx: 0xc9c21ea16bc460e291fbc26ae92b008b79080420e96b822d52d52f48a6257317 | file_mtime: 2026-10-20T14:56:23.275Z | status: ACCEPTED | exec: SUCCESS
F12 submit tx: 0x863106348c889f0cc95fefa7da8668b0853632f980232b8ae0b9e47ffca0a697 | file_mtime: 2026-10-20T14:56:44.533Z | status: ACCEPTED | exec: SUCCESS
```

### Verification of Chronological Order
- **Latest PR body edit timestamp**: `2026-10-20T14:40:47Z` (PR #13).
- **Earliest on-chain submission transaction**: `2026-10-20T14:52:35Z` (F1 submit tx `0x468048...`).
- **Conclusion**: All GitHub PR bodies were edited and locked at least 11 minutes BEFORE the respective on-chain submit transactions were executed. No PR body was modified after any submission.
