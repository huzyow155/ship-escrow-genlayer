import unittest
import json
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrowV2 import ShipEscrowV2, canonical_json, gl
from contracts.ShipReputationV2 import ShipReputationV2


def recompute_packet_sha256(packet: dict) -> str:
    return hashlib.sha256(canonical_json(packet).encode("utf-8")).hexdigest()


class TestLayer3MockedContractPipelines(unittest.TestCase):

    def setUp(self):
        gl.reset()
        self.escrow = ShipEscrowV2()
        self.escrow_addr = "0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F"
        gl.register_contract(self.escrow_addr, self.escrow)
        self.reputation = ShipReputationV2(self.escrow_addr)

        self.creator = "0x5c5a10dbada2fe0505628cfbbddf0b1d848daf80"
        self.dev = "0xbc2af12074e0459180bac2eb5144ae98c13adbb5"
        self.attacker = "0x44dbcd42cb603dd27a12242d1cab6008800c7dcb"

        # Claim initial demo credits
        gl.set_sender(self.creator)
        self.escrow.claim_demo_credits()
        gl.set_sender(self.dev)
        self.escrow.claim_demo_credits()

        # Load fixtures metadata
        fixtures_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures", "fixtures_v2.json")
        with open(fixtures_path, "r", encoding="utf-8") as f:
            self.fixtures_data = {fx["fixture_id"]: fx for fx in json.load(f)}

    def setup_mock_fixture(self, fx_id: str):
        fx = self.fixtures_data[fx_id]
        meta = {
            "state": fx["state"],
            "draft": fx["draft"],
            "merged": False,
            "head": {"sha": fx["head_sha"], "repo": {"full_name": "huzyow155/ship-escrow-fixtures"}},
            "base": {"sha": fx["base_sha"], "repo": {"full_name": "huzyow155/ship-escrow-fixtures"}},
            "body": fx["body"],
            "user": {"login": fx["user_login"]},
            "commits": fx["commits"],
        }
        api_url = f"https://api.github.com/repos/huzyow155/ship-escrow-fixtures/pulls/{fx['pr_number']}"
        gl.nondet.web.pages[api_url] = json.dumps(meta)

        diff_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "fixtures", "diffs_v2", f"{fx_id.lower()}.diff"
        )
        with open(diff_path, "r", encoding="utf-8") as f:
            diff_content = f.read()
        gl.nondet.web.pages[fx["compare_url"]] = diff_content
        return fx

    def test_fixture_f1_full_release_and_packet_recompute(self):
        fx = self.setup_mock_fixture("F1")
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES", "YES"]}'

        gl.set_sender(self.creator)
        crit = json.dumps([
            {"level": "MUST", "text": "Implement slugify in src/slug.py"},
            {"level": "MUST", "text": "Add unit tests in tests/test_slug.py"},
            {"level": "SHOULD", "text": "Update README with usage example"}
        ])
        bid = self.escrow.create_bounty("Slugify Bounty F1", "huzyow155/ship-escrow-fixtures", crit, "[]", "400")

        gl.set_sender(self.dev)
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "RELEASE_100")

        # Verify settlement & submission record packet
        sub_raw = self.escrow.get_submission("1")
        sub = json.loads(sub_raw)
        self.assertEqual(sub["verdict"], "RELEASE_100")
        self.assertEqual(sub["payout_pct"], "100")

        # Packet recomputation audit
        stored_packet = sub["packet"]
        stored_hash = sub["packet_sha256"]
        recomputed_hash = recompute_packet_sha256(stored_packet)
        self.assertEqual(recomputed_hash, stored_hash, "Recomputed packet sha256 must match stored hash!")

        # Verify settlement state
        settlement_raw = self.escrow.get_settlement(bid)
        settlement = json.loads(settlement_raw)
        self.assertEqual(settlement["dev_amount"], "400")
        self.assertEqual(settlement["creator_amount"], "0")
        self.assertEqual(settlement["packet_sha256"], stored_hash)

        # Cross-contract sync into ShipReputationV2
        gl.set_sender(self.dev)
        self.reputation.sync(bid, min_payout_pct=100)
        dev_score = json.loads(self.reputation.get_dev_score(self.dev))
        self.assertEqual(dev_score["settled_count"], 1)
        self.assertEqual(dev_score["units_earned"], "400")
        self.assertEqual(dev_score["best_verdict_counts"]["RELEASE_100"], 1)

    def test_fixture_f2_trap_missing_required_path_gate(self):
        fx = self.setup_mock_fixture("F2")
        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify"}])
        paths = json.dumps(["src/", "tests/"])
        bid = self.escrow.create_bounty("Slugify Bounty F2", "huzyow155/ship-escrow-fixtures", crit, paths, "500")

        gl.set_sender(self.dev)
        bal_before = int(self.escrow.get_balance(self.dev))
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "REFUND")

        # Bond forfeited
        bal_after = int(self.escrow.get_balance(self.dev))
        self.assertEqual(bal_after, bal_before - 50)

        sub = json.loads(self.escrow.get_submission("1"))
        self.assertEqual(sub["packet"]["gate"], "required_path_untouched")
        self.assertEqual(recompute_packet_sha256(sub["packet"]), sub["packet_sha256"])

    def test_fixture_f3_trap_deleted_test_gate(self):
        fx = self.setup_mock_fixture("F3")
        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify"}])
        bid = self.escrow.create_bounty("Slugify Bounty F3", "huzyow155/ship-escrow-fixtures", crit, "[]", "500")

        gl.set_sender(self.dev)
        bal_before = int(self.escrow.get_balance(self.dev))
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "REVIEW")

        # Bond returned on REVIEW
        bal_after = int(self.escrow.get_balance(self.dev))
        self.assertEqual(bal_after, bal_before)

        sub = json.loads(self.escrow.get_submission("1"))
        self.assertEqual(sub["packet"]["gate"], "test_deleted")

    def test_fixture_f6_multi_commit_pr(self):
        fx = self.setup_mock_fixture("F6")
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES"]}'

        gl.set_sender(self.creator)
        crit = json.dumps([
            {"level": "MUST", "text": "Implement slugify in src/slug.py"},
            {"level": "MUST", "text": "Add unit tests in tests/test_slug.py"}
        ])
        bid = self.escrow.create_bounty("Slugify Bounty F6", "huzyow155/ship-escrow-fixtures", crit, "[]", "300")

        gl.set_sender(self.dev)
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "RELEASE_100")

        sub = json.loads(self.escrow.get_submission("1"))
        self.assertEqual(sub["packet"]["metadata"]["commits"], 3)
        self.assertEqual(sub["head_sha"], fx["head_sha"])

    def test_fixture_f7_advancing_head_rejected(self):
        fx = self.setup_mock_fixture("F7")
        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify"}])
        bid = self.escrow.create_bounty("Slugify Bounty F7", "huzyow155/ship-escrow-fixtures", crit, "[]", "300")

        # Submitting with stale old_head_sha must revert!
        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, fx["pr_url"], fx["old_head_sha"])
        self.assertEqual(str(cm.exception), "Head sha does not match the pull request head")

    def test_fixture_f8_wrong_wallet_rejected(self):
        fx = self.setup_mock_fixture("F8")
        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify"}])
        bid = self.escrow.create_bounty("Slugify Bounty F8", "huzyow155/ship-escrow-fixtures", crit, "[]", "300")

        # Submitted by Dev when PR is bound to Attacker
        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(str(cm.exception), "Pull request is not bound to the submitting wallet")

    def test_fixture_f9_no_marker_rejected(self):
        fx = self.setup_mock_fixture("F9")
        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify"}])
        bid = self.escrow.create_bounty("Slugify Bounty F9", "huzyow155/ship-escrow-fixtures", crit, "[]", "300")

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(str(cm.exception), "Pull request is not bound to the submitting wallet")

    def test_fixture_f10_partial_required_prefix_refund(self):
        fx = self.setup_mock_fixture("F10")
        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify"}])
        # Requires BOTH src/ and docs/
        paths = json.dumps(["src/", "docs/"])
        bid = self.escrow.create_bounty("Slugify Bounty F10", "huzyow155/ship-escrow-fixtures", crit, paths, "400")

        gl.set_sender(self.dev)
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "REFUND")

        sub = json.loads(self.escrow.get_submission("1"))
        self.assertEqual(sub["packet"]["gate"], "required_path_untouched")

    def test_fixture_f11_non_test_deleted_no_false_gate(self):
        fx = self.setup_mock_fixture("F11")
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES"]}'

        gl.set_sender(self.creator)
        crit = json.dumps([
            {"level": "MUST", "text": "Implement slugify in src/slug.py"},
            {"level": "MUST", "text": "Add unit tests in tests/test_slug.py"}
        ])
        bid = self.escrow.create_bounty("Slugify Bounty F11", "huzyow155/ship-escrow-fixtures", crit, "[]", "400")

        gl.set_sender(self.dev)
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "RELEASE_100")

        sub = json.loads(self.escrow.get_submission("1"))
        self.assertEqual(sub["packet"]["gate"], "")
        self.assertIn("contest_rules.md", sub["packet"]["facts"]["deleted_files"])
        self.assertEqual(sub["packet"]["facts"]["test_files_deleted"], [])

    def test_fixture_f12_oversize_diff_truncation_review(self):
        fx = self.setup_mock_fixture("F12")
        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify"}])
        bid = self.escrow.create_bounty("Slugify Bounty F12", "huzyow155/ship-escrow-fixtures", crit, "[]", "400")

        gl.set_sender(self.dev)
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "REVIEW")

        sub = json.loads(self.escrow.get_submission("1"))
        self.assertTrue(sub["packet"]["facts"]["is_truncated"])
        self.assertEqual(sub["packet"]["gate"], "diff_truncated")

    def test_reputation_sync_refusal_below_min_payout_pct(self):
        # Create a partial payout settlement (e.g. 75%)
        fx = self.setup_mock_fixture("F4")
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES", "NO"]}'

        gl.set_sender(self.creator)
        crit = json.dumps([
            {"level": "MUST", "text": "Implement slugify"},
            {"level": "MUST", "text": "Add unit tests"},
            {"level": "SHOULD", "text": "Update documentation in docs/"}
        ])
        bid = self.escrow.create_bounty("Partial Bounty F4", "huzyow155/ship-escrow-fixtures", crit, "[]", "400")

        gl.set_sender(self.dev)
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "RELEASE_75")

        # Consumer reputation sync with min_payout_pct=100 must REVERT!
        with self.assertRaises(gl.vm.UserError) as cm:
            self.reputation.sync(bid, min_payout_pct=100)
        self.assertEqual(str(cm.exception), "Settlement payout percentage below required threshold")

        # Syncing with min_payout_pct=75 succeeds!
        self.reputation.sync(bid, min_payout_pct=75)

        # Duplicate sync must revert!
        with self.assertRaises(gl.vm.UserError) as cm:
            self.reputation.sync(bid, min_payout_pct=75)
        self.assertEqual(str(cm.exception), "Bounty settlement already processed")


if __name__ == '__main__':
    unittest.main()
