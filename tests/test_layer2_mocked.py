import unittest
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrow import ShipEscrow, gl
from contracts.ShipReputation import ShipReputation


class TestLayer2Mocked(unittest.TestCase):

    def setUp(self):
        self.escrow = ShipEscrow()
        self.creator = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        self.dev = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        self.other = "0xcccccccccccccccccccccccccccccccccccccccc"

        # Standard valid arguments
        self.title = "Implement slugify utility"
        self.owner_repo = "huzyow155/ship-escrow-fixtures"
        self.criteria = [
            {"level": "MUST", "text": "Adds function slugify in src/slug.py"},
            {"level": "MUST", "text": "Adds unit tests under tests/"},
            {"level": "SHOULD", "text": "Updates README.md documentation"},
        ]
        self.criteria_json = json.dumps(self.criteria)
        self.required_paths_json = json.dumps(["src/slug.py"])
        self.amount = "1000"

        # Set sender as creator
        gl.message.sender_address.as_hex = self.creator

        # Sample diffs for mocking
        self.valid_diff = (
            "diff --git a/src/slug.py b/src/slug.py\n"
            "new file mode 100644\n"
            "--- /dev/null\n"
            "+++ b/src/slug.py\n"
            "+def slugify(t): return t.lower()\n"
            "diff --git a/tests/test_slug.py b/tests/test_slug.py\n"
            "new file mode 100644\n"
            "--- /dev/null\n"
            "+++ b/tests/test_slug.py\n"
            "+def test_slug(): pass\n"
            "diff --git a/README.md b/README.md\n"
            "--- a/README.md\n"
            "+++ b/README.md\n"
            "+## Usage\n"
        )
        self.head_sha = "5db0441e76af93606fd82feebbe49c5a2f145326"
        self.valid_patch = f"From {self.head_sha} Mon Sep 17 00:00:00 2001\nSubject: feat\n\n"

        gl.nondet.web.pages.clear()
        gl.nondet.web.pages[f"https://github.com/{self.owner_repo}/pull/2.diff"] = self.valid_diff
        gl.nondet.web.pages[f"https://github.com/{self.owner_repo}/pull/2.patch"] = self.valid_patch
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES", "YES", "YES"]}'

    def test_bounty_creation_validation_errors(self):
        # 1. Title too short
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty("ab", self.owner_repo, self.criteria_json, self.required_paths_json, self.amount)
        self.assertEqual(str(cm.exception), "Title must be between 3 and 80 ASCII characters")

        # 2. Invalid owner_repo
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty(self.title, "invalid_repo_without_slash", self.criteria_json, self.required_paths_json, self.amount)
        self.assertEqual(str(cm.exception), "Invalid owner/repo format")

        # 3. Criteria empty
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty(self.title, self.owner_repo, "[]", self.required_paths_json, self.amount)
        self.assertEqual(str(cm.exception), "Criteria count must be between 1 and 5")

        # 4. Criteria too many (>5)
        many_crit = [{"level": "MUST", "text": f"Crit {i} text long"} for i in range(6)]
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty(self.title, self.owner_repo, json.dumps(many_crit), self.required_paths_json, self.amount)
        self.assertEqual(str(cm.exception), "Criteria count must be between 1 and 5")

        # 5. Criterion text too short
        short_crit = [{"level": "MUST", "text": "sh"}]
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty(self.title, self.owner_repo, json.dumps(short_crit), self.required_paths_json, self.amount)
        self.assertEqual(str(cm.exception), "Criterion text must be between 5 and 200 characters")

        # 6. Criterion invalid level
        bad_level = [{"level": "MAYBE", "text": "Valid text length here"}]
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty(self.title, self.owner_repo, json.dumps(bad_level), self.required_paths_json, self.amount)
        self.assertEqual(str(cm.exception), "Criterion level must be MUST or SHOULD")

        # 7. No MUST criterion
        no_must = [{"level": "SHOULD", "text": "Valid text length here"}]
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty(self.title, self.owner_repo, json.dumps(no_must), self.required_paths_json, self.amount)
        self.assertEqual(str(cm.exception), "At least one criterion must have level MUST")

        # 8. Invalid amount (0 or negative)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty(self.title, self.owner_repo, self.criteria_json, self.required_paths_json, "0")
        self.assertEqual(str(cm.exception), "Amount must be integer between 1 and 1000000")

        # 9. Invalid required path prefix (e.g. leading slash or ..)
        bad_path = json.dumps(["/root/path"])
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.create_bounty(self.title, self.owner_repo, self.criteria_json, bad_path, self.amount)
        self.assertEqual(str(cm.exception), "Invalid required path prefix")

    def test_submission_pre_execution_errors(self):
        b_id = self.escrow.create_bounty(self.title, self.owner_repo, self.criteria_json, self.required_paths_json, self.amount)

        # 1. Unknown bounty
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work("999", "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", self.head_sha)
        self.assertEqual(str(cm.exception), "Bounty not found")

        # 2. Creator cannot submit
        gl.message.sender_address.as_hex = self.creator
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", self.head_sha)
        self.assertEqual(str(cm.exception), "Creator cannot submit to own bounty")

        # Switch to dev
        gl.message.sender_address.as_hex = self.dev

        # 3. Invalid head sha
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", "shortsha")
        self.assertEqual(str(cm.exception), "Invalid head sha: must be 40 lowercase hex characters")

        # 4. Duplicate submission error (ends with existing submission id)
        gl.nondet.prompt_handler = lambda p: '{"results": ["NO", "NO", "NO"]}'
        v = self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", self.head_sha)
        self.assertEqual(v, "REFUND")

        # Submitting same (bounty_id, head_sha) again while open
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", self.head_sha)
        self.assertEqual(str(cm.exception), "Duplicate submission for head sha: existing submission 1")

    def test_full_release_and_ledger_invariants(self):
        # Initial balances are 0
        self.assertEqual(self.escrow.get_balance(self.creator), "0")
        self.assertEqual(self.escrow.get_balance(self.dev), "0")

        b_id = self.escrow.create_bounty(self.title, self.owner_repo, self.criteria_json, self.required_paths_json, "1000")

        gl.message.sender_address.as_hex = self.dev
        verdict = self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", self.head_sha)
        self.assertEqual(verdict, "RELEASE_100")

        # Invariant check: dev got 1000, creator got 0, bounty is SETTLED
        self.assertEqual(self.escrow.get_balance(self.dev), "1000")
        self.assertEqual(self.escrow.get_balance(self.creator), "0")

        bounty = json.loads(self.escrow.get_bounty(b_id))
        self.assertEqual(bounty["status"], "SETTLED")

        # is_settled_for parameter binding test
        c_hash = bounty["criteria_hash"]
        self.assertTrue(self.escrow.is_settled_for(b_id, c_hash, self.head_sha, self.dev))
        # Wrong c_hash -> False
        self.assertFalse(self.escrow.is_settled_for(b_id, "wrong_hash", self.head_sha, self.dev))
        # Wrong head_sha -> False
        self.assertFalse(self.escrow.is_settled_for(b_id, c_hash, "0000000000000000000000000000000000000000", self.dev))
        # Wrong dev -> False
        self.assertFalse(self.escrow.is_settled_for(b_id, c_hash, self.head_sha, self.other))

    def test_cancellation_permissions_and_ledger(self):
        b_id = self.escrow.create_bounty(self.title, self.owner_repo, self.criteria_json, self.required_paths_json, "1000")

        # Non-creator attempts cancel -> UserError
        gl.message.sender_address.as_hex = self.other
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.cancel_bounty(b_id)
        self.assertEqual(str(cm.exception), "Only bounty creator can cancel")

        # Creator cancels -> refund full amount to creator balance
        gl.message.sender_address.as_hex = self.creator
        self.escrow.cancel_bounty(b_id)
        self.assertEqual(self.escrow.get_balance(self.creator), "1000")

        bounty = json.loads(self.escrow.get_bounty(b_id))
        self.assertEqual(bounty["status"], "CANCELLED")

        # Attempting to cancel again fails
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.cancel_bounty(b_id)
        self.assertEqual(str(cm.exception), "Bounty is not open")

    def test_exhausted_bounty_and_refund(self):
        b_id = self.escrow.create_bounty(self.title, self.owner_repo, self.criteria_json, self.required_paths_json, "500")

        # Mock review/refund outcome
        gl.nondet.prompt_handler = lambda p: '{"results": ["NO", "NO", "NO"]}'
        gl.message.sender_address.as_hex = self.dev

        # Attempt 1 -> REFUND
        sha1 = "1111111111111111111111111111111111111111"
        gl.nondet.web.pages[f"https://github.com/{self.owner_repo}/pull/2.patch"] = f"From {sha1} Mon Sep 17 00:00:00 2001\n"
        v1 = self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", sha1)
        self.assertEqual(v1, "REFUND")

        # Attempt 2 -> REFUND
        sha2 = "2222222222222222222222222222222222222222"
        gl.nondet.web.pages[f"https://github.com/{self.owner_repo}/pull/2.patch"] = f"From {sha2} Mon Sep 17 00:00:00 2001\n"
        v2 = self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", sha2)
        self.assertEqual(v2, "REFUND")

        # Attempt 3 -> REFUND -> EXHAUSTED
        sha3 = "3333333333333333333333333333333333333333"
        gl.nondet.web.pages[f"https://github.com/{self.owner_repo}/pull/2.patch"] = f"From {sha3} Mon Sep 17 00:00:00 2001\n"
        v3 = self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", sha3)
        self.assertEqual(v3, "REFUND")

        bounty = json.loads(self.escrow.get_bounty(b_id))
        self.assertEqual(bounty["status"], "EXHAUSTED")
        self.assertEqual(bounty["attempts"], "3")

        # Attempt 4 fails with Attempt limit reached
        sha4 = "4444444444444444444444444444444444444444"
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", sha4)
        self.assertEqual(str(cm.exception), "Bounty is not open")

        # Creator calls refund_exhausted
        gl.message.sender_address.as_hex = self.creator
        self.escrow.refund_exhausted(b_id)
        self.assertEqual(self.escrow.get_balance(self.creator), "500")

        bounty_after = json.loads(self.escrow.get_bounty(b_id))
        self.assertEqual(bounty_after["status"], "REFUNDED")

    def test_cross_contract_reputation_sync(self):
        escrow_addr = "0x8888888888888888888888888888888888888888"
        gl.contracts_registry[escrow_addr.lower()] = self.escrow

        rep = ShipReputation(escrow_addr)
        self.assertEqual(rep.get_escrow_address(), escrow_addr.lower())

        # Create and settle bounty 1
        b_id = self.escrow.create_bounty(self.title, self.owner_repo, self.criteria_json, self.required_paths_json, "1000")
        gl.message.sender_address.as_hex = self.dev
        self.escrow.submit_work(b_id, "https://github.com/huzyow155/ship-escrow-fixtures/pull/2", self.head_sha)

        # Sync settlement to reputation
        rep.sync(b_id)

        # Dev score check
        dev_score = json.loads(rep.get_dev_score(self.dev))
        self.assertEqual(dev_score["settled_count"], 1)
        self.assertEqual(dev_score["units_earned"], "1000")
        self.assertEqual(dev_score["best_verdict_counts"]["RELEASE_100"], 1)

        # Creator score check
        creator_score = json.loads(rep.get_creator_score(self.creator))
        self.assertEqual(creator_score["bounties_settled"], 1)
        self.assertEqual(creator_score["units_paid"], "1000")

        # Second sync must fail (idempotency)
        with self.assertRaises(gl.vm.UserError) as cm:
            rep.sync(b_id)
        self.assertEqual(str(cm.exception), "Bounty settlement already processed")


if __name__ == '__main__':
    unittest.main()
