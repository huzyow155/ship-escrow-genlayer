# Probe Decisions for V2

> Written BEFORE contract design is frozen. Based on on-chain probe results from Probe contract `0x95e5A80dfC75829271DBc64Bf1A386c03ddcFA9f`.

---

## Probe (a): GitHub REST API (`api.github.com`)

**Measured behavior**: 10 consecutive unauthenticated `gl.nondet.web.get("https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/2")` calls inside a single consensus round all returned HTTP 200 with identical JSON payloads. Parsed fields: `head.sha`, `base.sha`, `state`, `user.login`, `commits`, `draft`, `merged`, `head.repo.full_name`, `base.repo.full_name`, `body` (length). No rate-limit error was observed across validators.

**Decision**: V2 will use the GitHub REST API as the authoritative source for PR metadata. The contract will fetch `https://api.github.com/repos/{owner}/{repo}/pulls/{number}` inside the nondet block to authenticate `head.sha`, read `base.sha`, check `state`, `draft`, `merged`, and `user.login`.

**Fallback**: If the API returns a non-200 status (e.g. rate-limited 403), the submission raises a UserError ("Pull request metadata unavailable") and no state is changed. This ensures rate limits never silently weaken the head-SHA check.

**Risk note**: GitHub unauthenticated rate limit is 60 requests per hour per IP. In a multi-validator setup, each validator fetches independently. If validators share a VM host IP, sustained usage could hit the limit. The contract documents this in LIMITATIONS.

---

## Probe (b): Immutable compare-by-SHA diff

**Measured behavior**: `https://github.com/{o}/{r}/compare/{base_sha}...{head_sha}.diff` returned HTTP 200 for a same-repo PR. The SHA-256 of the compare diff was byte-identical to `pull/N.diff`: both `ecd93f38b55992bcea34e00190252912c3a6c9742884d8d6666720882afb116c`, length 1077.

**Decision**: V2 will use the compare-by-SHA URL (`/compare/{base}...{head}.diff`) as the diff source. Since `base_sha` and `head_sha` are read from the API response, this URL is immutable - pushing new commits to the PR branch does not change the diff at the pinned SHAs.

**Fork PRs**: For fork PRs where `head.repo.full_name != base.repo.full_name`, the compare URL may not resolve (GitHub requires the base repo to have access to the head SHA). V2 will restrict to same-repo PRs (`head.repo.full_name == base.repo.full_name`). Fork PR support is documented as a limitation.

---

## Probe (c): Deterministic timestamp

**Measured behavior**: `time.time()` returned `1792505178.066999` (a valid UNIX timestamp). `datetime.now()` returned `2026-10-20T14:06:18.066999`. No `gl.block`, `gl.transaction`, or `gl.message.timestamp` attributes exist.

**Decision**: `time.time()` is available in GenVM and returns a value that reached consensus (all validators agreed on the result). V2 will use `time.time()` to record creation timestamps and last-submission timestamps. The `cancel_idle` rule will allow the creator to cancel after a fixed idle period (e.g. 7 days = 604800 seconds) since the last submission or creation.

**Caveat**: The timestamp is "deterministic enough" because validators ran the probe in the same time window and `strict_eq` accepted the result. However, validators with clock skew might disagree on a sub-second call. V2 will read `time.time()` outside the nondet block (in a write method's pre-consensus section) and store it as an integer (seconds), reducing clock-skew risk. The idle period is long enough (7 days) that minor skew is irrelevant.

**Correction**: Since `time.time()` was called inside a `write` method (the probe_timestamp method is `@gl.public.write`) and it succeeded, it is usable in writes. The value was consistent across validators because it ran inside the same transaction round.
