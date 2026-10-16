# Ship Escrow - Error Codes Reference

Every user error raised by `ShipEscrow.py` and `ShipReputation.py` is a distinct, descriptive `gl.vm.UserError`. Layer 2 tests assert these exact error strings.

---

## 1. ShipEscrow Error Codes

### Bounty Creation Errors
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
- `Attempt limit reached`: Raised if bounty attempts count >= 3.
- `Invalid head sha: must be 40 lowercase hex characters`: Raised if `head_sha` is not 40 lowercase hexadecimal characters.
- `PR URL must use https scheme`: Raised if scheme is not `https`.
- `PR URL host must be github.com`: Raised if host is not `github.com`.
- `PR URL must not contain userinfo`: Raised if URL contains username or password.
- `PR URL must not specify non-standard port`: Raised if port is specified and not 443.
- `PR URL path shape invalid`: Raised if path is not of shape `/<owner>/<repo>/pull/<n>`.
- `PR URL owner/repo mismatch`: Raised if PR URL repo does not match bounty repo.
- `PR URL must not contain query or fragment`: Raised if URL contains query string or fragment.
- `Duplicate submission for head sha: existing submission <sub_id>`: Raised if the same `(bounty_id, head_sha)` was previously submitted.

### Submission Fetch & Network Errors
- `GitHub source unreachable`: Raised if GitHub diff or patch endpoint returns non-200 or raises network exception.
- `PR not found on GitHub (HTTP 404)`: Raised if GitHub returns HTTP 404 for PR diff.
- `PR diff is empty`: Raised if PR diff has 0 characters or only whitespace.

### Lifecycle & Cancellation Errors
- `Only bounty creator can cancel`: Raised if non-creator attempts `cancel_bounty`.
- `Only bounty creator can refund exhausted bounty`: Raised if non-creator attempts `refund_exhausted`.
- `Bounty is not exhausted`: Raised if `refund_exhausted` is called while bounty is not in `"EXHAUSTED"` state.

---

## 2. ShipReputation Error Codes

- `Bounty id cannot be empty`: Raised if `bounty_id` argument is empty.
- `Bounty settlement already processed`: Raised if `sync` is called a second time for the same bounty.
- `Settlement not found in escrow`: Raised if escrow contract returns empty settlement string.
- `Failed to decode settlement JSON`: Raised if escrow settlement is not valid JSON.
- `Invalid settlement record: missing required fields`: Raised if settlement lacks `dev`, `head_sha`, or `criteria_hash`.
- `Invalid settlement amounts`: Raised if settlement amounts are not valid integers.
