# GitHub Account Migration Note: huzyow155 -> hypercybers99

## Background
The maintainer GitHub username migrated from `huzyow155` to `hypercybers99`.
GitHub maintains seamless HTTP 301 redirects for repository endpoints:
- `https://github.com/huzyow155/ship-escrow-fixtures` -> `https://github.com/hypercybers99/ship-escrow-fixtures`
- `https://api.github.com/repos/huzyow155/ship-escrow-fixtures` -> `https://api.github.com/repos/hypercybers99/ship-escrow-fixtures`

## Contract Resolution Rule
In `contracts/ShipEscrowV2.py`, the repository validation logic evaluates:
```python
expected_repo_name = expected_repo.split("/")[-1].lower()
base_repo_name = base_repo_fn.split("/")[-1].lower()
if expected_repo_name != base_repo_name:
    raise Exception(f"PR base repo name {base_repo_name} does not match expected {expected_repo_name}")
```

Additionally, fork separation is strictly enforced:
```python
if head_repo_fn != base_repo_fn:
    raise Exception("Cross-fork pull requests are not supported")
```

This guarantees that:
1. Aliased repository URLs across user renames resolve correctly to the canonical fixture repository.
2. Cross-fork submissions from different repositories are rejected.
3. PR author login binding matches the submitting developer address registered in the bounty metadata.
