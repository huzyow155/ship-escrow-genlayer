import unittest
import json
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.candidates.ShipEscrowV2_2_not_adopted import ShipEscrowV2 as CandidateShipEscrowV2, canonical_json, gl
from contracts.ShipReputationV2 import ShipReputationV2


class TestCandidateV2_2ContractPipelines(unittest.TestCase):
    """Test suite targeting the V2.2 candidate contract (ShipEscrowV2_2_not_adopted.py)."""

    def setUp(self):
        gl.reset()
        self.escrow = CandidateShipEscrowV2()
        self.escrow_addr = "0x8DC94110Ed3E111Fb74Dce849CdBA8f567E6024F"
        gl.register_contract(self.escrow_addr, self.escrow)
        self.reputation = ShipReputationV2(self.escrow_addr)

        self.creator = "0x79ed3fc4e32d8df7b23a221a27a057170e6d2069"
        self.dev = "0x6325b360db455435bf5e81d0ae18dc3b249f226c"

        # Claim initial demo credits
        gl.set_sender(self.creator)
        self.escrow.claim_demo_credits()
        gl.set_sender(self.dev)
        self.escrow.claim_demo_credits()

        # Load fixtures metadata
        fixtures_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures", "fixtures_v2.json")
        with open(fixtures_path, "r", encoding="utf-8") as f:
            self.fixtures_data = {fx["fixture_id"]: fx for fx in json.load(f)}

    def test_candidate_error_pinning_301_repository_moved(self):
        """In V2.2, HTTP 301 from GitHub API must return exact 'Repository moved' UserError."""
        from tests.genlayer import GlWebResponse
        fx = self.fixtures_data["F1"]
        gl.nondet.web.get_handler = lambda url: GlWebResponse(status=301, body=b"Moved")

        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify in src/slug.py"}])
        bid = self.escrow.create_bounty("Moved PR Bounty", "huzyow155/ship-escrow-fixtures", crit, "[]", "100")

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(str(cm.exception), "Repository moved: use the current owner/repo name in the bounty and the PR URL")
        gl.nondet.web.get_handler = None

    def test_candidate_error_pinning_403_rate_limit(self):
        """In V2.2, HTTP 403 from GitHub API must return exact 'GitHub rate limit reached' UserError."""
        from tests.genlayer import GlWebResponse
        fx = self.fixtures_data["F1"]
        gl.nondet.web.get_handler = lambda url: GlWebResponse(status=403, body=b"Rate Limit")

        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify in src/slug.py"}])
        bid = self.escrow.create_bounty("Rate Limit Bounty", "huzyow155/ship-escrow-fixtures", crit, "[]", "100")

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(str(cm.exception), "GitHub rate limit reached, retry later")
        gl.nondet.web.get_handler = None

    def test_candidate_error_pinning_500_metadata_unavailable(self):
        """In V2.2, HTTP 500 from GitHub API must return exact 'Pull request metadata unavailable' UserError."""
        from tests.genlayer import GlWebResponse
        fx = self.fixtures_data["F1"]
        gl.nondet.web.get_handler = lambda url: GlWebResponse(status=500, body=b"Internal Server Error")

        gl.set_sender(self.creator)
        crit = json.dumps([{"level": "MUST", "text": "Implement slugify in src/slug.py"}])
        bid = self.escrow.create_bounty("500 Bounty", "huzyow155/ship-escrow-fixtures", crit, "[]", "100")

        gl.set_sender(self.dev)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(str(cm.exception), "Pull request metadata unavailable")
        gl.nondet.web.get_handler = None

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

    def test_candidate_validator_fn_criterion_results_consensus_binding(self):
        """In V2.2, validator_fn strictly compares criterion_results vector equality."""
        fx = self.setup_mock_fixture("F1")
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES", "YES"]}'

        gl.set_sender(self.creator)
        crit = json.dumps([
            {"level": "MUST", "text": "Implement slugify in src/slug.py"},
            {"level": "MUST", "text": "Add unit tests in tests/test_slug.py"},
            {"level": "SHOULD", "text": "Update README with usage example"}
        ])
        bid = self.escrow.create_bounty("Binding Bounty F1", "huzyow155/ship-escrow-fixtures", crit, "[]", "400")

        gl.set_sender(self.dev)
        verdict = self.escrow.submit_work(bid, fx["pr_url"], fx["head_sha"])
        self.assertEqual(verdict, "RELEASE_100")


if __name__ == '__main__':
    unittest.main()
