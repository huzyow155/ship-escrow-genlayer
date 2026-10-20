import unittest
import json
import random
import sys
import os
import hashlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrowV2 import (
    diff_facts,
    parse_strict_llm_json,
    decide,
    validate_url,
    validate_head_sha,
    validate_owner_repo,
    parse_and_validate_criteria,
    parse_and_validate_required_paths,
    compute_criteria_hash_pure,
    path_matches_prefix,
    is_test_file,
    parse_wallet_marker,
    canonical_json,
    gl,
)


def independent_decide_oracle(criteria, results, is_truncated=False):
    if is_truncated:
        return ("REVIEW", 0)

    if len(criteria) != len(results):
        return ("REVIEW", 0)

    for c, r in zip(criteria, results):
        if c["level"] == "MUST":
            if r == "UNCLEAR":
                return ("REVIEW", 0)
            if r == "NO":
                return ("REFUND", 0)

    pts = 0
    max_pts = 0
    val_map = {"YES": 2, "PARTIAL": 1, "NO": 0, "UNCLEAR": 0}
    for c, r in zip(criteria, results):
        w = 3 if c["level"] == "MUST" else 1
        max_pts += w * 2
        pts += w * val_map.get(r, 0)

    if max_pts == 0:
        return ("REFUND", 0)

    pct = (pts * 100) // max_pts
    if pct >= 90:
        return ("RELEASE_100", 100)
    elif pct >= 65:
        return ("RELEASE_75", 75)
    elif pct >= 40:
        return ("RELEASE_50", 50)
    elif pct >= 15:
        return ("RELEASE_25", 25)
    else:
        return ("REFUND", 0)


class TestLayer1PureFunctions(unittest.TestCase):

    def test_diff_facts_basic_and_stats(self):
        diff = (
            "diff --git a/src/main.py b/src/main.py\n"
            "index 111..222 100644\n"
            "--- a/src/main.py\n"
            "+++ b/src/main.py\n"
            "@@ -1,3 +1,5 @@\n"
            " line1\n"
            "+new line\n"
            "+second line\n"
            "-old line\n"
            "diff --git a/tests/test_main.py b/tests/test_main.py\n"
            "new file mode 100644\n"
            "--- /dev/null\n"
            "+++ b/tests/test_main.py\n"
            "+def test_ok(): pass\n"
        )
        facts = diff_facts(diff, cap=14000)
        self.assertIn("src/main.py", facts["changed_files"])
        self.assertIn("tests/test_main.py", facts["changed_files"])
        self.assertEqual(facts["added_lines"], 3)
        self.assertEqual(facts["deleted_lines"], 1)
        self.assertIn("tests/test_main.py", facts["test_files_touched"])
        self.assertEqual(len(facts["test_files_deleted"]), 0)
        self.assertFalse(facts["is_truncated"])

    def test_diff_facts_deleted_test_file(self):
        diff = (
            "diff --git a/tests/test_legacy.py b/tests/test_legacy.py\n"
            "deleted file mode 100644\n"
            "--- a/tests/test_legacy.py\n"
            "+++ /dev/null\n"
            "-deleted line\n"
        )
        facts = diff_facts(diff, cap=14000)
        self.assertIn("tests/test_legacy.py", facts["changed_files"])
        self.assertIn("tests/test_legacy.py", facts["deleted_files"])
        self.assertIn("tests/test_legacy.py", facts["test_files_deleted"])

    def test_diff_facts_non_test_file_with_test_in_name_deleted(self):
        # V2 fix: deleted non-test file with "test" in name MUST NOT be flagged as deleted test file!
        diff = (
            "diff --git a/contest_rules.md b/contest_rules.md\n"
            "deleted file mode 100644\n"
            "--- a/contest_rules.md\n"
            "+++ /dev/null\n"
            "-rules\n"
            "diff --git a/src/fast_testimony.py b/src/fast_testimony.py\n"
            "deleted file mode 100644\n"
            "--- a/src/fast_testimony.py\n"
            "+++ /dev/null\n"
            "-content\n"
            "diff --git a/src/slug.py b/src/slug.py\n"
            "--- /dev/null\n"
            "+++ b/src/slug.py\n"
            "+def slugify(): pass\n"
        )
        facts = diff_facts(diff, cap=14000)
        self.assertIn("contest_rules.md", facts["deleted_files"])
        self.assertIn("src/fast_testimony.py", facts["deleted_files"])
        # Neither is a test file, so test_files_deleted MUST be empty!
        self.assertEqual(len(facts["test_files_deleted"]), 0)

    def test_diff_facts_mixed_add_delete_across_files(self):
        diff = (
            "diff --git a/src/old.py b/src/old.py\n"
            "deleted file mode 100644\n"
            "--- a/src/old.py\n"
            "+++ /dev/null\n"
            "-removed\n"
            "diff --git a/src/new.py b/src/new.py\n"
            "new file mode 100644\n"
            "--- /dev/null\n"
            "+++ b/src/new.py\n"
            "+added\n"
            "diff --git a/tests/test_new.py b/tests/test_new.py\n"
            "--- a/tests/test_new.py\n"
            "+++ b/tests/test_new.py\n"
            "+test line\n"
        )
        facts = diff_facts(diff, cap=14000)
        self.assertEqual(facts["changed_files"], ["src/new.py", "src/old.py", "tests/test_new.py"])
        self.assertEqual(facts["deleted_files"], ["src/old.py"])
        self.assertEqual(facts["test_files_deleted"], [])
        self.assertEqual(facts["test_files_touched"], ["tests/test_new.py"])

    def test_diff_facts_renamed_and_quoted_paths(self):
        diff = (
            'diff --git "a/my test doc.md" "b/my test doc.md"\n'
            '--- "a/my test doc.md"\n'
            '+++ "b/my test doc.md"\n'
            '+added text\n'
        )
        facts = diff_facts(diff, cap=14000)
        self.assertIn("my test doc.md", facts["changed_files"])

    def test_diff_facts_truncation_detection(self):
        huge_diff = "diff --git a/src/large.py b/src/large.py\n" + ("+ line added\n" * 2000)
        facts = diff_facts(huge_diff, cap=14000)
        self.assertTrue(facts["is_truncated"])
        self.assertIn("[TRUNCATED]", facts["capped_diff"])

    def test_path_matches_prefix_whole_segment(self):
        # Whole segment matching: prefix must end at a '/' boundary or equal the file path
        self.assertTrue(path_matches_prefix("src/slug.py", "src/"))
        self.assertTrue(path_matches_prefix("src/slug.py", "src"))
        self.assertTrue(path_matches_prefix("src/utils/slug.py", "src/utils/"))
        self.assertTrue(path_matches_prefix("README.md", "README.md"))

        # Must NOT match partial path component
        self.assertFalse(path_matches_prefix("src_extra/slug.py", "src/"))
        self.assertFalse(path_matches_prefix("src_extra/slug.py", "src"))
        self.assertFalse(path_matches_prefix("docs_backup/index.md", "docs/"))

    def test_is_test_file_classifier(self):
        # Positive cases
        self.assertTrue(is_test_file("tests/test_slug.py"))
        self.assertTrue(is_test_file("test/unit.py"))
        self.assertTrue(is_test_file("__tests__/app.test.js"))
        self.assertTrue(is_test_file("src/slug_test.py"))
        self.assertTrue(is_test_file("test_slug.py"))
        self.assertTrue(is_test_file("components/btn.spec.ts"))

        # Negative cases (non-test files with 'test' in name)
        self.assertFalse(is_test_file("contest_rules.md"))
        self.assertFalse(is_test_file("src/fast_testimony.py"))
        self.assertFalse(is_test_file("docs/contest.html"))
        self.assertFalse(is_test_file("attestation.json"))

    def test_parse_wallet_marker_table(self):
        # Valid markers
        body1 = "Implements slugify.\n\nship-escrow-wallet: 0x6325B360Db455435BF5e81D0aE18DC3b249f226C\n"
        self.assertEqual(parse_wallet_marker(body1), "0x6325b360db455435bf5e81d0ae18dc3b249f226c")

        body2 = "ship-escrow-wallet: 0x1111111111111111111111111111111111111111"
        self.assertEqual(parse_wallet_marker(body2), "0x1111111111111111111111111111111111111111")

        # Invalid markers / missing
        self.assertEqual(parse_wallet_marker("No marker in this PR"), "")
        self.assertEqual(parse_wallet_marker("ship-escrow-wallet: not-a-hex-address"), "")
        self.assertEqual(parse_wallet_marker("ship-escrow-wallet: 0x123"), "")
        self.assertEqual(parse_wallet_marker(""), "")
        self.assertEqual(parse_wallet_marker(None), "")

    def test_strict_llm_json_parser_table(self):
        # Valid JSON
        self.assertEqual(parse_strict_llm_json('{"results": ["YES", "NO"]}', 2), ["YES", "NO"])
        self.assertEqual(parse_strict_llm_json('```json\n{"results": ["YES", "PARTIAL"]}\n```', 2), ["YES", "PARTIAL"])

        # Rejections
        self.assertEqual(parse_strict_llm_json('{"results": ["YES"], "results": ["NO"]}', 1), ["UNCLEAR"])
        self.assertEqual(parse_strict_llm_json('{"results": ["YES"], "other": "key"}', 1), ["UNCLEAR"])
        self.assertEqual(parse_strict_llm_json('Prefix {"results": ["YES"]}', 1), ["UNCLEAR"])
        self.assertEqual(parse_strict_llm_json('{"results": ["yes", "no"]}', 2), ["UNCLEAR", "UNCLEAR"])
        self.assertEqual(parse_strict_llm_json('{"results": ["YES"]}', 2), ["UNCLEAR", "UNCLEAR"])

    def test_decide_truncation_safety(self):
        criteria = [{"level": "MUST", "text": "Slugify"}, {"level": "SHOULD", "text": "Docs"}]
        # Even with all YES, if is_truncated is True, verdict MUST strictly be REVIEW
        verdict, payout = decide(criteria, ["YES", "YES"], is_truncated=True)
        self.assertEqual(verdict, "REVIEW")
        self.assertEqual(payout, 0)

        # Truncated diff with MUST NO must also be REVIEW (never refund from missing code)
        verdict2, payout2 = decide(criteria, ["NO", "YES"], is_truncated=True)
        self.assertEqual(verdict2, "REVIEW")
        self.assertEqual(payout2, 0)

    def test_decide_and_parity_60_cases(self):
        # Test 60 distinct combinations of criteria and model labels
        levels = ["MUST", "SHOULD"]
        labels = ["YES", "PARTIAL", "NO", "UNCLEAR"]
        random.seed(9876543)

        for i in range(100):
            crit_count = random.randint(1, 5)
            criteria = []
            has_must = False
            for j in range(crit_count):
                lvl = random.choice(levels)
                if lvl == "MUST":
                    has_must = True
                criteria.append({"level": lvl, "text": f"Criterion {j}"})
            if not has_must:
                criteria[0]["level"] = "MUST"

            results = [random.choice(labels) for _ in range(crit_count)]
            is_trunc = random.choice([True, False])

            contract_res = decide(criteria, results, is_truncated=is_trunc)
            oracle_res = independent_decide_oracle(criteria, results, is_truncated=is_trunc)
            self.assertEqual(contract_res, oracle_res, f"Mismatch at iter {i}: crit={criteria}, res={results}, trunc={is_trunc}")

    def test_url_validator_bypass_table(self):
        expected_repo = "huzyow155/ship-escrow-fixtures"

        # Valid
        self.assertEqual(
            validate_url("https://github.com/huzyow155/ship-escrow-fixtures/pull/2", expected_repo),
            ("huzyow155", "ship-escrow-fixtures", "2")
        )

        bypasses = [
            ("http://github.com/huzyow155/ship-escrow-fixtures/pull/2", "PR URL must use https scheme"),
            ("https://user:pass@github.com/huzyow155/ship-escrow-fixtures/pull/2", "PR URL must not contain userinfo"),
            ("https://github.com:8080/huzyow155/ship-escrow-fixtures/pull/2", "PR URL must not specify non-standard port"),
            ("https://github.com.evil.com/huzyow155/ship-escrow-fixtures/pull/2", "PR URL host must be github.com"),
            ("https://127.0.0.1/huzyow155/ship-escrow-fixtures/pull/2", "PR URL host must be github.com"),
            ("https://github.com/other/repo/pull/2", "PR URL owner/repo mismatch"),
            ("https://github.com/huzyow155/ship-escrow-fixtures/pull/2/files", "PR URL path shape invalid"),
            ("https://github.com/huzyow155/ship-escrow-fixtures/pull/2?token=secret", "PR URL must not contain query or fragment"),
        ]
        for url, expected_err in bypasses:
            with self.assertRaises(gl.vm.UserError) as cm:
                validate_url(url, expected_repo)
            self.assertEqual(str(cm.exception), expected_err)


if __name__ == '__main__':
    unittest.main()
