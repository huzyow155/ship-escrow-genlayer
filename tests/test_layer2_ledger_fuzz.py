import unittest
import json
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrowV2 import (
    ShipEscrowV2,
    gl,
    canonical_json,
    SUBMISSION_BOND_AMOUNT,
    DEMO_CLAIM_AMOUNT,
    MAX_BOUNTY_ATTEMPTS,
    MAX_DEV_ATTEMPTS,
)


class TestLayer2LedgerFuzzAndAttacks(unittest.TestCase):

    def setUp(self):
        gl.reset()
        self.escrow = ShipEscrowV2()

    def test_ledger_fuzz_5000_sequences(self):
        """
        Fuzz test 5000 random operations across multiple simulated wallets:
        claim_demo_credits, create_bounty, submit_work, cancel_bounty, refund_exhausted.
        Assert ledger invariant: sum(balances) + sum(escrowed) == total_minted
        after EVERY single state transition.
        """
        seed = 5432187
        random.seed(seed)
        print(f"\n[Layer 2 Fuzz] Running 5000 ledger invariant operations with seed {seed}...")

        wallets = [f"0x{i:040x}" for i in range(1, 11)]
        bounty_ids = []

        # Helper to check invariant directly from contract state
        def assert_invariant():
            inv = json.loads(self.escrow.get_ledger_invariant())
            self.assertTrue(inv["invariant_holds"], f"Invariant broken! {inv}")
            # Also calculate independently
            total_minted = self.escrow._get_counter("total_minted")
            known_addrs = json.loads(self.escrow.meta.get("known_addresses", "[]"))
            sum_bal = sum(int(self.escrow.balances.get(a.lower(), "0")) for a in known_addrs)
            next_b = self.escrow._get_counter("next_bounty")
            sum_esc = sum(int(self.escrow.escrowed.get(str(bid), "0")) for bid in range(1, next_b + 1))
            self.assertEqual(sum_bal + sum_esc, total_minted, f"Direct sum mismatch: {sum_bal} + {sum_esc} != {total_minted}")

        assert_invariant()

        for step in range(5000):
            w = random.choice(wallets)
            gl.set_sender(w)
            action = random.choice(["claim", "create", "submit", "cancel", "refund"])

            if action == "claim":
                if not self.escrow.has_claimed_demo(w):
                    self.escrow.claim_demo_credits()
                    assert_invariant()

            elif action == "create":
                bal = int(self.escrow.get_balance(w))
                if bal >= 100:
                    amt = random.randint(10, min(bal, 500))
                    crit = json.dumps([{"level": "MUST", "text": "Valid code"}])
                    paths = json.dumps(["src/"])
                    bid = self.escrow.create_bounty("Fuzz Bounty", "owner/repo", crit, paths, str(amt))
                    bounty_ids.append(bid)
                    assert_invariant()

            elif action == "submit":
                if bounty_ids:
                    bid = random.choice(bounty_ids)
                    b_raw = self.escrow.get_bounty(bid)
                    if b_raw:
                        b = json.loads(b_raw)
                        dev_bal = int(self.escrow.get_balance(w))
                        dev_att = self.escrow.get_dev_attempts(bid, w)
                        total_att = int(b["attempts"])

                        # Only attempt if legitimate prerequisites hold
                        if (
                            b["status"] == "OPEN"
                            and w != b["creator"]
                            and dev_bal >= SUBMISSION_BOND_AMOUNT
                            and dev_att < MAX_DEV_ATTEMPTS
                            and total_att < MAX_BOUNTY_ATTEMPTS
                        ):
                            # Mock nondet responses
                            dummy_sha = f"{step:040x}"
                            pr_url = f"https://github.com/owner/repo/pull/{step}"
                            meta_resp = {
                                "state": "open",
                                "draft": False,
                                "merged": False,
                                "head": {"sha": dummy_sha, "repo": {"full_name": "owner/repo"}},
                                "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
                                "body": f"ship-escrow-wallet: {w}\nFuzz test PR",
                                "user": {"login": "fuzzer"},
                                "commits": 1,
                            }
                            gl.nondet.web.pages[f"https://api.github.com/repos/owner/repo/pull/{step}"] = json.dumps(meta_resp)
                            gl.nondet.web.pages[f"https://github.com/owner/repo/compare/{'0'*40}...{dummy_sha}.diff"] = (
                                "diff --git a/src/code.py b/src/code.py\n+code\n"
                            )

                            verdict_choice = random.choice(["YES", "NO", "PARTIAL", "UNCLEAR"])
                            gl.nondet.prompt_handler = lambda p, vc=verdict_choice: f'{{"results": ["{vc}"]}}'

                            try:
                                self.escrow.submit_work(bid, pr_url, dummy_sha)
                            except gl.vm.UserError:
                                pass
                            assert_invariant()

            elif action == "cancel":
                if bounty_ids:
                    bid = random.choice(bounty_ids)
                    b_raw = self.escrow.get_bounty(bid)
                    if b_raw:
                        b = json.loads(b_raw)
                        gl.set_sender(b["creator"])
                        if b["status"] == "OPEN" and int(b["attempts"]) == 0:
                            self.escrow.cancel_bounty(bid)
                            assert_invariant()

            elif action == "refund":
                if bounty_ids:
                    bid = random.choice(bounty_ids)
                    b_raw = self.escrow.get_bounty(bid)
                    if b_raw:
                        b = json.loads(b_raw)
                        gl.set_sender(b["creator"])
                        if b["status"] == "EXHAUSTED":
                            self.escrow.refund_exhausted(bid)
                            assert_invariant()

        print("  [Layer 2 Fuzz] Completed 5000 operations. Ledger invariant holds 100% across all states.")

    def test_attack_sybil_exhaustion_defense(self):
        """
        Attack: Attacker uses many throwaway wallets to submit unrelated PRs
        hoping to burn the bounty's 6 attempts.
        Defense: PR body must contain the exact wallet marker matching the caller.
        Unrelated PRs (missing or wrong wallet marker) fail for FREE before consuming any attempt.
        """
        creator = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        gl.set_sender(creator)
        self.escrow.claim_demo_credits()
        crit = json.dumps([{"level": "MUST", "text": "Solve issue"}])
        bid = self.escrow.create_bounty("Sybil Target", "owner/repo", crit, "[]", "500")

        # 10 different attacker wallets try submitting an unrelated PR
        for i in range(1, 11):
            attacker = f"0xbeef{i:036x}"
            gl.set_sender(attacker)
            self.escrow.claim_demo_credits()

            # Mock an unrelated PR on github bound to legitimate maintainer or with no marker
            meta_resp = {
                "state": "open",
                "draft": False,
                "merged": False,
                "head": {"sha": f"dead{i:036x}", "repo": {"full_name": "owner/repo"}},
                "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
                "body": "Unrelated community PR without submitter marker",
                "user": {"login": "stranger"},
                "commits": 1,
            }
            gl.nondet.web.pages[f"https://api.github.com/repos/owner/repo/pulls/{i}"] = json.dumps(meta_resp)

            with self.assertRaises(gl.vm.UserError) as cm:
                self.escrow.submit_work(bid, f"https://github.com/owner/repo/pull/{i}", f"dead{i:036x}")
            self.assertEqual(str(cm.exception), "Pull request is not bound to the submitting wallet")

        # Verify 0 attempts were consumed on the bounty!
        bounty = json.loads(self.escrow.get_bounty(bid))
        self.assertEqual(bounty["attempts"], "0")
        self.assertEqual(bounty["status"], "OPEN")

    def test_attack_copied_submission_defense(self):
        """
        Attack: An attacker observes dev's PR and attempts to submit it from their own wallet
        to frontrun or steal the bounty.
        Defense: PR body is bound to dev's wallet. Attacker's call reverts with wallet mismatch.
        """
        creator = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        dev = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        attacker = "0xcccccccccccccccccccccccccccccccccccccccc"

        gl.set_sender(creator)
        self.escrow.claim_demo_credits()
        crit = json.dumps([{"level": "MUST", "text": "Solve issue"}])
        bid = self.escrow.create_bounty("Frontrun Target", "owner/repo", crit, "[]", "300")

        gl.set_sender(attacker)
        self.escrow.claim_demo_credits()

        # PR is bound to DEV
        meta_resp = {
            "state": "open",
            "draft": False,
            "merged": False,
            "head": {"sha": "1" * 40, "repo": {"full_name": "owner/repo"}},
            "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
            "body": f"ship-escrow-wallet: {dev}\nDev legitimate PR",
            "user": {"login": "honest-dev"},
            "commits": 1,
        }
        gl.nondet.web.pages["https://api.github.com/repos/owner/repo/pulls/1"] = json.dumps(meta_resp)

        # Attacker tries to submit it
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/1", "1" * 40)
        self.assertEqual(str(cm.exception), "Pull request is not bound to the submitting wallet")

    def test_attack_sha_poisoning_defense(self):
        """
        Attack: Attacker tries to submit dev's PR with a wrong/fake SHA to 'poison' the seen index
        and block dev's genuine submission.
        Defense: In V2, head_sha is authenticated strictly against GitHub API before writing to seen.
        A wrong claimed SHA reverts immediately, writing nothing to seen.
        Dev's subsequent genuine submission succeeds normally.
        """
        creator = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        dev = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

        gl.set_sender(creator)
        self.escrow.claim_demo_credits()
        crit = json.dumps([{"level": "MUST", "text": "Solve issue"}])
        bid = self.escrow.create_bounty("Poison Target", "owner/repo", crit, "[]", "300")

        gl.set_sender(dev)
        self.escrow.claim_demo_credits()

        real_head = "a" * 40
        wrong_head = "b" * 40

        meta_resp = {
            "state": "open",
            "draft": False,
            "merged": False,
            "head": {"sha": real_head, "repo": {"full_name": "owner/repo"}},
            "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
            "body": f"ship-escrow-wallet: {dev}",
            "user": {"login": "dev"},
            "commits": 1,
        }
        gl.nondet.web.pages["https://api.github.com/repos/owner/repo/pulls/1"] = json.dumps(meta_resp)
        gl.nondet.web.pages[f"https://github.com/owner/repo/compare/{'0'*40}...{real_head}.diff"] = "diff --git a/a.py b/a.py\n+ok\n"
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES"]}'

        # 1. Attacker or broken submitter submits with wrong head SHA
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/1", wrong_head)
        self.assertEqual(str(cm.exception), "Head sha does not match the pull request head")

        # 2. Genuine submitter submits with the real head SHA -> SUCCEEDS!
        verdict = self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/1", real_head)
        self.assertEqual(verdict, "RELEASE_100")

    def test_attack_creator_cancel_after_failed_submission_refused(self):
        """
        Attack: Creator sees an imperfect submission (e.g. REVIEW or REFUND) and attempts
        to cancel the bounty to withdraw escrow, denying the developer subsequent attempts.
        Defense: Creator can ONLY cancel while attempts == 0.
        Once an authenticated submission exists, cancel_bounty reverts with
        'Cannot cancel bounty after submissions have been made'.
        """
        creator = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        dev = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

        gl.set_sender(creator)
        self.escrow.claim_demo_credits()
        crit = json.dumps([{"level": "MUST", "text": "Solve issue"}])
        bid = self.escrow.create_bounty("Cancel Target", "owner/repo", crit, "[]", "300")

        gl.set_sender(dev)
        self.escrow.claim_demo_credits()

        # Submission that results in REVIEW
        meta_resp = {
            "state": "open",
            "draft": False,
            "merged": False,
            "head": {"sha": "1" * 40, "repo": {"full_name": "owner/repo"}},
            "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
            "body": f"ship-escrow-wallet: {dev}",
            "user": {"login": "dev"},
            "commits": 1,
        }
        gl.nondet.web.pages["https://api.github.com/repos/owner/repo/pulls/1"] = json.dumps(meta_resp)
        gl.nondet.web.pages[f"https://github.com/owner/repo/compare/{'0'*40}...{'1'*40}.diff"] = "diff --git a/a.py b/a.py\n+ok\n"
        gl.nondet.prompt_handler = lambda p: '{"results": ["UNCLEAR"]}'

        v = self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/1", "1" * 40)
        self.assertEqual(v, "REVIEW")

        # Creator tries to cancel now that attempts == 1
        gl.set_sender(creator)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.cancel_bounty(bid)
        self.assertEqual(str(cm.exception), "Cannot cancel bounty after submissions have been made")

    def test_legitimate_recovery_after_review(self):
        """
        Legitimate flow: Developer submits PR, receives REVIEW.
        Developer pushes a fix (new head SHA), submits attempt 2, and reaches RELEASE_100.
        """
        creator = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        dev = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

        gl.set_sender(creator)
        self.escrow.claim_demo_credits()
        crit = json.dumps([{"level": "MUST", "text": "Solve issue"}])
        bid = self.escrow.create_bounty("Recovery Target", "owner/repo", crit, "[]", "400")

        gl.set_sender(dev)
        self.escrow.claim_demo_credits()

        head1 = "1" * 40
        head2 = "2" * 40

        # Attempt 1: UNCLEAR -> REVIEW
        meta1 = {
            "state": "open",
            "draft": False,
            "merged": False,
            "head": {"sha": head1, "repo": {"full_name": "owner/repo"}},
            "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
            "body": f"ship-escrow-wallet: {dev}",
            "user": {"login": "dev"},
            "commits": 1,
        }
        gl.nondet.web.pages["https://api.github.com/repos/owner/repo/pulls/1"] = json.dumps(meta1)
        gl.nondet.web.pages[f"https://github.com/owner/repo/compare/{'0'*40}...{head1}.diff"] = "diff --git a/a.py b/a.py\n+incomplete\n"
        gl.nondet.prompt_handler = lambda p: '{"results": ["UNCLEAR"]}'

        v1 = self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/1", head1)
        self.assertEqual(v1, "REVIEW")
        # Bond was returned, so dev balance is still 1000
        self.assertEqual(self.escrow.get_balance(dev), "1000")

        # Attempt 2: dev updates PR to head2 -> YES -> RELEASE_100
        meta2 = dict(meta1)
        meta2["head"] = {"sha": head2, "repo": {"full_name": "owner/repo"}}
        gl.nondet.web.pages["https://api.github.com/repos/owner/repo/pulls/1"] = json.dumps(meta2)
        gl.nondet.web.pages[f"https://github.com/owner/repo/compare/{'0'*40}...{head2}.diff"] = "diff --git a/a.py b/a.py\n+fully_complete\n"
        gl.nondet.prompt_handler = lambda p: '{"results": ["YES"]}'

        v2 = self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/1", head2)
        self.assertEqual(v2, "RELEASE_100")
        # Dev received full bounty 400!
        self.assertEqual(self.escrow.get_balance(dev), "1400")

    def test_attempt_caps_and_bond_forfeiture(self):
        """
        Verify:
        - Submission bond (50) is forfeited on REFUND to creator.
        - Per-developer attempt cap (2) is enforced.
        - Bounty attempt cap (6) transitions to EXHAUSTED.
        """
        creator = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        dev1 = "0x1111111111111111111111111111111111111111"
        dev2 = "0x2222222222222222222222222222222222222222"
        dev3 = "0x3333333333333333333333333333333333333333"

        gl.set_sender(creator)
        self.escrow.claim_demo_credits()
        crit = json.dumps([{"level": "MUST", "text": "Solve issue"}])
        bid = self.escrow.create_bounty("Cap Target", "owner/repo", crit, "[]", "600")

        # Dev1 claims 1000, creator has 400 left
        gl.set_sender(dev1)
        self.escrow.claim_demo_credits()

        # Dev1 submit 1: REFUND (fails criterion)
        def setup_pr(d, h, pr_num):
            meta = {
                "state": "open",
                "draft": False,
                "merged": False,
                "head": {"sha": h, "repo": {"full_name": "owner/repo"}},
                "base": {"sha": "0" * 40, "repo": {"full_name": "owner/repo"}},
                "body": f"ship-escrow-wallet: {d}",
                "user": {"login": "dev"},
                "commits": 1,
            }
            gl.nondet.web.pages[f"https://api.github.com/repos/owner/repo/pulls/{pr_num}"] = json.dumps(meta)
            gl.nondet.web.pages[f"https://github.com/owner/repo/compare/{'0'*40}...{h}.diff"] = "diff --git a/a.py b/a.py\n+bad\n"

        setup_pr(dev1, "a" * 40, 101)
        gl.nondet.prompt_handler = lambda p: '{"results": ["NO"]}'
        v = self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/101", "a" * 40)
        self.assertEqual(v, "REFUND")

        # Dev1 lost 50 bond (950), creator received 50 bond (450)
        self.assertEqual(self.escrow.get_balance(dev1), "950")
        self.assertEqual(self.escrow.get_balance(creator), "450")

        # Dev1 submit 2: REFUND
        setup_pr(dev1, "b" * 40, 102)
        self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/102", "b" * 40)
        self.assertEqual(self.escrow.get_balance(dev1), "900")
        self.assertEqual(self.escrow.get_balance(creator), "500")

        # Dev1 submit 3: Exceeds per-dev cap (MAX_DEV_ATTEMPTS = 2)!
        setup_pr(dev1, "c" * 40, 103)
        with self.assertRaises(gl.vm.UserError) as cm:
            self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/103", "c" * 40)
        self.assertEqual(str(cm.exception), "Developer attempt limit reached")

        # Dev2 takes 2 attempts
        gl.set_sender(dev2)
        self.escrow.claim_demo_credits()
        setup_pr(dev2, "d" * 40, 104)
        self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/104", "d" * 40)
        setup_pr(dev2, "e" * 40, 105)
        self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/105", "e" * 40)

        # Dev3 takes 2 attempts -> reaches 6 total attempts -> transitions to EXHAUSTED
        gl.set_sender(dev3)
        self.escrow.claim_demo_credits()
        setup_pr(dev3, "f" * 40, 106)
        self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/106", "f" * 40)
        setup_pr(dev3, "0" * 39 + "1", 107)
        self.escrow.submit_work(bid, "https://github.com/owner/repo/pull/107", "0" * 39 + "1")

        bounty = json.loads(self.escrow.get_bounty(bid))
        self.assertEqual(bounty["attempts"], "6")
        self.assertEqual(bounty["status"], "EXHAUSTED")

        # Creator calls refund_exhausted to reclaim escrowed 600 credits
        gl.set_sender(creator)
        self.escrow.refund_exhausted(bid)
        bounty = json.loads(self.escrow.get_bounty(bid))
        self.assertEqual(bounty["status"], "REFUNDED")


if __name__ == '__main__':
    unittest.main()
