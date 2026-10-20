# Ship Escrow V2 - Error Codes Reference

> Status: **Preview**  
> Network: **GenLayer Studionet** (Chain ID: 61999)  

> [!IMPORTANT]
> **DISCLAIMER: SIMULATED CREDITS, NOT CUSTODY-BACKED TOKENS**  
> Credits in Ship Escrow V2 are maintained on an internal, conserved accounting ledger with auditable deposit, release, and refund invariants. They do not represent custody-backed tokens, cryptocurrencies, or monetary value.

Every user error raised by `ShipEscrowV2.py` and `ShipReputationV2.py` is a distinct, descriptive `gl.vm.UserError`. Layer 1, 2, and 3 tests and Direct Mode suites pin these exact error strings.

---

## 1. ShipEscrowV2 Error Codes

### Ledger & Demo Credit Errors
- `Demo credits already claimed`: Raised if an address calls `claim_demo_credits` more than once.
- `Insufficient credits to escrow bounty`: Raised if creator balance is less than the bounty amount at `create_bounty`.
- `Insufficient credits for submission bond`: Raised if developer balance is less than 50 credits at `submit_work`.

### Bounty Creation Validation Errors
- `Title must be between 3 and 80 ASCII characters`: Raised if `title` is shorter than 3 or longer than 80 characters.
- `Invalid owner/repo format`: Raised if `owner_repo` fails regex `^[A-Za-z0-9._-]{1,39}/[A-Za-z0-9._-]{1,100}$`.
- `Criteria count must be between 1 and 5`: Raised if criteria JSON is not a list or has length < 1 or > 5.
- `Criterion text must be between 5 and 200 characters`: Raised if criterion text length is outside `[5, 200]`.
- `Criterion level must be MUST or SHOULD`: Raised if criterion level is not `"MUST"` or `"SHOULD"`.
- `At least one criterion must have level MUST`: Raised if no criterion has level `"MUST"`.
- `Amount must be integer between 1 and 1000000`: Raised if `amount` is not an integer string between 1 and 1,000,000.
- `Required paths must have between 0 and 3 items`: Raised if `required_paths` list length > 3.
- `Invalid required path prefix`: Raised if any required path is empty, contains `..`, or starts with `/`.

### Submission Pre-Execution Errors
- `Bounty not found`: Raised if `bounty_id` does not exist in `self.bounties`.
- `Bounty is not open`: Raised if bounty status is not `"OPEN"`.
- `Creator cannot submit to own bounty`: Raised if caller equals bounty creator.
- `Developer attempt limit reached`: Raised if developer has already submitted 2 authenticated attempts to this bounty.
- `Attempt limit reached`: Raised if bounty has reached the total cap of 6 authenticated attempts.
- `Invalid head sha: must be 40 lowercase hex characters`: Raised if `head_sha` is not 40 lowercase hexadecimal characters.
- `PR URL must use https scheme`: Raised if scheme is not `https`.
- `PR URL host must be github.com`: Raised if host is not `github.com`.
- `PR URL must not contain userinfo`: Raised if URL contains username or password.
- `PR URL must not specify non-standard port`: Raised if port is specified and not 443.
- `PR URL path shape invalid`: Raised if path is not of shape `/<owner>/<repo>/pull/<n>`.
- `PR URL owner/repo mismatch`: Raised if PR URL repo does not match bounty repo.
- `PR URL must not contain query or fragment`: Raised if URL contains query string or fragment.
- `Duplicate submission for head sha: existing submission <sub_id>`: Raised if the same `(bounty_id, head_sha)` was previously submitted.

### Submission Consensus Authentication Errors
These errors are raised in consensus before any state mutation occurs (no attempts consumed, no bond forfeited):
- `Pull request metadata unavailable`: Raised if GitHub REST API returns non-200 or fails to parse.
- `Pull request is not open or merged`: Raised if PR is in `draft` state or is closed without being merged.
- `Pull request must be same-repository`: Raised if head repository does not match base repository.
- `Head sha does not match the pull request head`: Raised if authoritative API `head.sha` does not equal the claimed `head_sha`.
- `Pull request is not bound to the submitting wallet`: Raised if the PR body lacks `ship-escrow-wallet: 0x<caller_address>`.
- `GitHub source unreachable`: Raised if GitHub compare-by-SHA diff endpoint returns non-200.
- `PR diff is empty`: Raised if PR diff has 0 characters or only whitespace.

### Lifecycle & Cancellation Errors
- `Only bounty creator can cancel`: Raised if non-creator attempts `cancel_bounty`.
- `Bounty is not open`: Raised if `cancel_bounty` is called on a non-OPEN bounty.
- `Cannot cancel bounty after submissions have been made`: Raised if creator attempts `cancel_bounty` when `attempts > 0`.
- `Only bounty creator can refund exhausted bounty`: Raised if non-creator attempts `refund_exhausted`.
- `Bounty is not exhausted`: Raised if `refund_exhausted` is called while bounty status is not `"EXHAUSTED"`.

---

## 2. ShipReputationV2 Error Codes

- `Bounty id cannot be empty`: Raised if `bounty_id` argument is empty.
- `Bounty settlement already processed`: Raised if `sync` is called a second time for the same bounty.
- `Settlement not found in escrow`: Raised if escrow contract returns empty settlement string.
- `Failed to decode settlement JSON`: Raised if escrow settlement is not valid JSON.
- `Invalid settlement record: missing required fields`: Raised if settlement lacks `dev`, `head_sha`, or `criteria_hash`.
- `Invalid settlement amounts`: Raised if settlement amounts are not valid integers.
- `Settlement does not meet minimum payout threshold`: Raised if settlement payout percentage is strictly less than the requested `min_payout_pct`.
