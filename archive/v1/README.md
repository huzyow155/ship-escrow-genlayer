# Ship Escrow V1 - Archived (Superseded)

> **WARNING**: These contract sources are superseded by V2 (`contracts/ShipEscrowV2.py` and `contracts/ShipReputationV2.py`).
> They are kept here for audit reference only. Do NOT deploy or use these as the active contract.

## V1 Deployed Addresses (still on-chain, not the active version)

- ShipEscrow V1: `0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F`
- ShipReputation V1: `0x55c56f0dfFb8227345814A37c68394b05c26E901`
- Deploy tx (ShipEscrow V1): `0x0dcfc833e0379f1259cfcdad6ca1a77c0783ba8a2eeb461e32c314a7086c16c3`
- Deploy tx (ShipReputation V1): `0xca13e68ba0743939041b61985062b39fa95ef54c9134c5d47c65441dc03b1602`

## Why superseded

The V2 contracts address five steward findings:
1. Credits created from nothing (no conserved ledger)
2. Patch head SHA authentication weakness (multi-commit PRs, missing metadata bypass)
3. No attribution binding (any wallet can burn shared attempts)
4. Required-path gate checks ANY prefix instead of EVERY; `"test" in name` is too broad
5. Consensus commits only `verdict|sha16`, not the full packet
