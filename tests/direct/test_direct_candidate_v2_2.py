import json
import pytest
from pathlib import Path


@pytest.fixture
def candidate_direct_env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """
    Setup fixture for candidate V2.2 tests using genlayer-test.
    Deploys ShipEscrowV2_2_not_adopted.py and sets up credited test accounts.
    """
    creator = direct_alice
    dev = direct_bob
    attacker = direct_charlie

    dev_hex = "0x" + dev.hex().lower()
    attacker_hex = "0x" + attacker.hex().lower()

    escrow = direct_deploy("contracts/candidates/ShipEscrowV2_2_not_adopted.py", sdk_version="v0.2.12")

    with direct_vm.prank(creator):
        escrow.claim_demo_credits()
    with direct_vm.prank(dev):
        escrow.claim_demo_credits()
    with direct_vm.prank(attacker):
        escrow.claim_demo_credits()

    crit = json.dumps([
        {"level": "MUST", "text": "Implement slugify in src/slug.py"},
        {"level": "MUST", "text": "Add unit tests in tests/test_slug.py"}
    ])

    return {
        "vm": direct_vm,
        "escrow": escrow,
        "creator": creator,
        "dev": dev,
        "attacker": attacker,
        "dev_hex": dev_hex,
        "attacker_hex": attacker_hex,
        "crit": crit,
    }


def test_candidate_case1_error_string_repo_moved_301(candidate_direct_env):
    """1. Pinned error string for HTTP 301/302/307/308 in Candidate V2.2 (Repository moved)"""
    vm = candidate_direct_env["vm"]
    escrow = candidate_direct_env["escrow"]
    creator = candidate_direct_env["creator"]
    dev = candidate_direct_env["dev"]
    crit = candidate_direct_env["crit"]

    with vm.prank(creator):
        bid = escrow.create_bounty("Moved Bounty", "owner/repo", crit, "[]", "50")

    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/13", "Moved Permanently", status=301)

    with vm.prank(dev):
        with pytest.raises(Exception, match="Repository moved: use the current owner/repo name in the bounty and the PR URL"):
            escrow.submit_work(bid, "https://github.com/owner/repo/pull/13", "13" + "0" * 38)


def test_candidate_case2_error_string_rate_limit_403(candidate_direct_env):
    """2. Pinned error string for HTTP 403/429 in Candidate V2.2 (GitHub rate limit reached)"""
    vm = candidate_direct_env["vm"]
    escrow = candidate_direct_env["escrow"]
    creator = candidate_direct_env["creator"]
    dev = candidate_direct_env["dev"]
    crit = candidate_direct_env["crit"]

    with vm.prank(creator):
        bid = escrow.create_bounty("Rate Limit Bounty", "owner/repo", crit, "[]", "50")

    vm.mock_web("https://api.github.com/repos/owner/repo/pulls/14", "Forbidden Rate Limit", status=403)

    with vm.prank(dev):
        with pytest.raises(Exception, match="GitHub rate limit reached, retry later"):
            escrow.submit_work(bid, "https://github.com/owner/repo/pull/14", "14" + "0" * 38)
