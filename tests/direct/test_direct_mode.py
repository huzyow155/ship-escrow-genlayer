import json
import pytest
import re
from pathlib import Path


def test_direct_edge_cases(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """
    Official Direct Mode test suite using genlayer-test.
    Covers all 10 required edge cases:
    1. Multi-commit PR (3 commits, final head authenticated via API)
    2. Changed head (stale SHA submission rejected)
    3. Missing metadata (GitHub API 404/failure reverts with no state change)
    4. SHA poisoning (fake SHA rejected, subsequent genuine submit works)
    5. Sybil exhaustion (unbound PRs reject for free without consuming attempts)
    6. Copied submission (third-party submission rejected by wallet binding)
    7. Legitimate recovery (REVIEW followed by corrected head to RELEASE_100)
    8. Diff truncation safety (oversized diff > 14k strictly yields REVIEW)
    9. Mixed add/delete (non-test file with 'test' in name does not fire false gate)
    10. Required-all-prefixes (touching 1 of 2 required prefixes triggers REFUND)
    """
    creator = direct_alice
    dev = direct_bob
    attacker = direct_charlie

    dev_hex = "0x" + dev.hex().lower()
    attacker_hex = "0x" + attacker.hex().lower()

    # Deploy ShipEscrowV2 via direct_deploy
    escrow = direct_deploy("contracts/ShipEscrowV2.py")

    # Claim demo credits for creator and dev
    with direct_vm.prank(creator):
        escrow.claim_demo_credits()
    with direct_vm.prank(dev):
        escrow.claim_demo_credits()
    with direct_vm.prank(attacker):
        escrow.claim_demo_credits()

    # -------------------------------------------------------------------------
    # 1. Multi-commit PR (F6)
    # -------------------------------------------------------------------------
    crit = json.dumps([
        {"level": "MUST", "text": "Implement slugify in src/slug.py"},
        {"level": "MUST", "text": "Add unit tests in tests/test_slug.py"}
    ])
    with direct_vm.prank(creator):
        bid1 = escrow.create_bounty("Multi-commit Bounty", "owner/repo", crit, "[]", "50")

    meta_multi = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "c" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}\nThree commits in this PR",
        "user": {"login": "dev"},
        "commits": 3,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/1", json.dumps(meta_multi))
    direct_vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'c'*40}.diff", "diff --git a/src/slug.py b/src/slug.py\n+code\n")
    direct_vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with direct_vm.prank(dev):
        v1 = escrow.submit_work(bid1, "https://github.com/owner/repo/pull/1", "c" * 40)
    assert v1 == "RELEASE_100"

    # -------------------------------------------------------------------------
    # 2. Changed head / Stale SHA submission (F7)
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        bid2 = escrow.create_bounty("Changed Head Bounty", "owner/repo", crit, "[]", "50")

    meta_changed = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "2" * 40, "repo": {"full_name": "owner/repo"}},  # Current head
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 2,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/2", json.dumps(meta_changed))

    with direct_vm.prank(dev):
        try:
            escrow.submit_work(bid2, "https://github.com/owner/repo/pull/2", "1" * 40)  # Submitting with stale head
            assert False, "Must revert on stale head sha"
        except Exception as e:
            assert "Head sha does not match the pull request head" in str(e)

    # -------------------------------------------------------------------------
    # 3. Missing metadata (GitHub API failure)
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        bid3 = escrow.create_bounty("Missing Meta Bounty", "owner/repo", crit, "[]", "50")

    # API returns 404 or throws
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/999", "Not Found", status=404)

    with direct_vm.prank(dev):
        try:
            escrow.submit_work(bid3, "https://github.com/owner/repo/pull/999", "a" * 40)
            assert False, "Must revert when metadata is unavailable"
        except Exception as e:
            assert "Pull request metadata unavailable" in str(e)

    # -------------------------------------------------------------------------
    # 4. SHA poisoning defense
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        bid4 = escrow.create_bounty("Poisoning Bounty", "owner/repo", crit, "[]", "50")

    meta_poison = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "7" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/4", json.dumps(meta_poison))
    direct_vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'7'*40}.diff", "diff --git a/a.py b/a.py\n+code\n")

    # Attacker tries to submit fake SHA "8"*40
    with direct_vm.prank(attacker):
        try:
            escrow.submit_work(bid4, "https://github.com/owner/repo/pull/4", "8" * 40)
            assert False, "Must revert on wrong sha"
        except Exception as e:
            assert ("Head sha does not match the pull request head" in str(e) or
                    "Pull request is not bound to the submitting wallet" in str(e))

    # Dev submits genuine SHA "7"*40 -> succeeds!
    with direct_vm.prank(dev):
        v4 = escrow.submit_work(bid4, "https://github.com/owner/repo/pull/4", "7" * 40)
    assert v4 == "RELEASE_100"

    # -------------------------------------------------------------------------
    # 5. Sybil exhaustion defense
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        bid5 = escrow.create_bounty("Sybil Bounty", "owner/repo", crit, "[]", "50")

    meta_unbound = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "5" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": "No wallet marker in this PR",
        "user": {"login": "random"},
        "commits": 1,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/5", json.dumps(meta_unbound))

    with direct_vm.prank(attacker):
        try:
            escrow.submit_work(bid5, "https://github.com/owner/repo/pull/5", "5" * 40)
            assert False, "Unbound PR must revert"
        except Exception as e:
            assert "Pull request is not bound to the submitting wallet" in str(e)

    b5 = json.loads(escrow.get_bounty(bid5))
    assert b5["attempts"] == "0", "Failed sybil attempt must NOT consume attempt counter"

    # -------------------------------------------------------------------------
    # 6. Copied submission defense
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        bid6 = escrow.create_bounty("Copied Bounty", "owner/repo", crit, "[]", "50")

    meta_dev_only = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "6" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/6", json.dumps(meta_dev_only))

    with direct_vm.prank(attacker):
        try:
            escrow.submit_work(bid6, "https://github.com/owner/repo/pull/6", "6" * 40)
            assert False, "Attacker cannot submit PR bound to dev"
        except Exception as e:
            assert "Pull request is not bound to the submitting wallet" in str(e)

    # -------------------------------------------------------------------------
    # 7. Legitimate recovery flow (REVIEW then RELEASE_100)
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        bid7 = escrow.create_bounty("Recovery Bounty", "owner/repo", crit, "[]", "50")

    meta_rec1 = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "e1" + "0" * 38, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/7", json.dumps(meta_rec1))
    direct_vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'e1'+'0'*38}.diff", "diff --git a/a.py b/a.py\n+partial\n")
    direct_vm.mock_llm(r".*", '{"results": ["UNCLEAR", "YES"]}')

    with direct_vm.prank(dev):
        v7_1 = escrow.submit_work(bid7, "https://github.com/owner/repo/pull/7", "e1" + "0" * 38)
    assert v7_1 == "REVIEW"

    # Push correction -> new head
    meta_rec2 = dict(meta_rec1)
    meta_rec2["head"] = {"sha": "e2" + "0" * 38, "repo": {"full_name": "owner/repo"}}
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/7", json.dumps(meta_rec2))
    direct_vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'e2'+'0'*38}.diff", "diff --git a/a.py b/a.py\n+complete\n")
    direct_vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with direct_vm.prank(dev):
        v7_2 = escrow.submit_work(bid7, "https://github.com/owner/repo/pull/7", "e2" + "0" * 38)
    assert v7_2 == "RELEASE_100"

    # -------------------------------------------------------------------------
    # 8. Diff truncation safety (strictly REVIEW)
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        bid8 = escrow.create_bounty("Truncation Bounty", "owner/repo", crit, "[]", "50")

    meta_trunc = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "8" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/8", json.dumps(meta_trunc))
    # Oversized diff > 14k chars
    direct_vm.mock_web(
        f"https://github.com/owner/repo/compare/{'0'*40}...{'8'*40}.diff",
        "diff --git a/a.py b/a.py\n" + ("+ line of padding\n" * 900)
    )

    with direct_vm.prank(dev):
        v8 = escrow.submit_work(bid8, "https://github.com/owner/repo/pull/8", "8" * 40)
    assert v8 == "REVIEW", "Truncated diff must strictly evaluate to REVIEW"

    # -------------------------------------------------------------------------
    # 9. Mixed add/delete (non-test file with 'test' in name)
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        bid9 = escrow.create_bounty("Non-test Deleted Bounty", "owner/repo", crit, "[]", "50")

    meta_del = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "9" * 40, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/9", json.dumps(meta_del))
    diff_del = (
        "diff --git a/contest_rules.md b/contest_rules.md\n"
        "deleted file mode 100644\n"
        "--- a/contest_rules.md\n"
        "+++ /dev/null\n"
        "-obsolete\n"
        "diff --git a/src/slug.py b/src/slug.py\n"
        "--- /dev/null\n"
        "+++ b/src/slug.py\n"
        "+code\n"
    )
    direct_vm.mock_web(f"https://github.com/owner/repo/compare/{'0'*40}...{'9'*40}.diff", diff_del)
    direct_vm.mock_llm(r".*", '{"results": ["YES", "YES"]}')

    with direct_vm.prank(dev):
        v9 = escrow.submit_work(bid9, "https://github.com/owner/repo/pull/9", "9" * 40)
    assert v9 == "RELEASE_100", "Deleted non-test file must not fire test_deleted gate"

    # -------------------------------------------------------------------------
    # 10. Required-all-prefixes gate
    # -------------------------------------------------------------------------
    with direct_vm.prank(creator):
        # Requires BOTH src/ and docs/
        bid10 = escrow.create_bounty(
            "Required Paths Bounty", "owner/repo", crit, json.dumps(["src/", "docs/"]), "300"
        )

    meta_req = {
        "state": "open",
        "draft": False,
        "merged": False,
        "head": {"sha": "10" + "0" * 38, "repo": {"full_name": "owner/repo"}},
        "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
        "body": f"ship-escrow-wallet: {dev_hex}",
        "user": {"login": "dev"},
        "commits": 1,
    }
    direct_vm.mock_web("https://api.github.com/repos/owner/repo/pulls/10", json.dumps(meta_req))
    # Diff touches ONLY src/, does NOT touch docs/
    direct_vm.mock_web(
        f"https://github.com/owner/repo/compare/{'0'*40}...{'10'+'0'*38}.diff",
        "diff --git a/src/slug.py b/src/slug.py\n+code\n"
    )

    with direct_vm.prank(dev):
        v10 = escrow.submit_work(bid10, "https://github.com/owner/repo/pull/10", "10" + "0" * 38)
    assert v10 == "REFUND", "Failing any required prefix must trigger REFUND"
