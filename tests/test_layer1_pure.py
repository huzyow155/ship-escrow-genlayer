import unittest
import json
import random
import sys
import os

# Ensure tests path is prioritized
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contracts.ShipEscrow import (
    diff_facts,
    parse_strict_llm_json,
    decide,
    validate_url,
    validate_head_sha,
    validate_owner_repo,
    parse_and_validate_criteria,
    parse_and_validate_required_paths,
    compute_criteria_hash_pure,
    canonical_json,
    gl,
)


def independent_decide_oracle(criteria, results, is_truncated=False):
    if len(criteria) != len(results):
        return "REVIEW"

    if is_truncated:
        for c, r in zip(criteria, results):
            if c["level"] == "MUST" and r != "YES":
                return "REVIEW"

    for c, r in zip(criteria, results):
        if c["level"] == "MUST":
            if r == "UNCLEAR":
                return "REVIEW"
            if r == "NO":
                return "REFUND"

    pts = 0
    max_pts = 0
    val_map = {"YES": 2, "PARTIAL": 1, "NO": 0, "UNCLEAR": 0}
    for c, r in zip(criteria, results):
        w = 3 if c["level"] == "MUST" else 1
        max_pts += w * 2
        pts += w * val_map.get(r, 0)

    if max_pts == 0:
        return "REFUND"

    pct = (pts * 100) // max_pts
    if pct >= 90:
        v = "RELEASE_100"
    elif pct >= 65:
        v = "RELEASE_75"
    elif pct >= 40:
        v = "RELEASE_50"
    elif pct >= 15:
        v = "RELEASE_25"
    else:
        v = "REFUND"

    if is_truncated and v in ("RELEASE_100", "RELEASE_75"):
        v = "RELEASE_50"

    return v


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

    def test_diff_facts_deleted_file_and_test(self):
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

    def test_diff_facts_huge_diff_truncation_marker(self):
        huge_diff = "diff --git a/src/large.py b/src/large.py\n" + ("+ line added\n" * 2000)
        self.assertGreater(len(huge_diff), 14000)
        facts = diff_facts(huge_diff, cap=14000)
        self.assertTrue(facts["is_truncated"])
        self.assertIn("[TRUNCATED]", facts["capped_diff"])
        self.assertLessEqual(len(facts["capped_diff"]), 14000 + 20)

    def test_diff_facts_files_with_spaces_and_renames(self):
        diff = (
            "diff --git a/docs/my doc.md b/docs/my doc.md\n"
            "+added text\n"
        )
        facts = diff_facts(diff, cap=14000)
        self.assertIn("docs/my doc.md", facts["changed_files"])

    def test_strict_llm_json_parser_table(self):
        # 1. Valid exact JSON
        self.assertEqual(parse_strict_llm_json('{"results": ["YES", "NO"]}', 2), ["YES", "NO"])
        
        # 2. Markdown fenced JSON
        self.assertEqual(parse_strict_llm_json('```json\n{"results": ["YES", "PARTIAL"]}\n```', 2), ["YES", "PARTIAL"])
        
        # 3. Duplicate key rejection
        dup_json = '{"results": ["YES"], "results": ["NO"]}'
        self.assertEqual(parse_strict_llm_json(dup_json, 1), ["UNCLEAR"])

        # 4. Extra keys rejection
        extra_key = '{"results": ["YES"], "comment": "looks good"}'
        self.assertEqual(parse_strict_llm_json(extra_key, 1), ["UNCLEAR"])

        # 5. Prose containing JSON
        prose_json = 'Here is the result: {"results": ["YES"]}'
        self.assertEqual(parse_strict_llm_json(prose_json, 1), ["UNCLEAR"])

        # 6. Lowercase label rejection
        lower_json = '{"results": ["yes", "no"]}'
        self.assertEqual(parse_strict_llm_json(lower_json, 2), ["UNCLEAR", "UNCLEAR"])

        # 7. Wrong length
        wrong_len = '{"results": ["YES", "YES", "YES"]}'
        self.assertEqual(parse_strict_llm_json(wrong_len, 2), ["UNCLEAR", "UNCLEAR"])

        # 8. Nested list or invalid types
        nested_json = '{"results": [["YES"], 123]}'
        self.assertEqual(parse_strict_llm_json(nested_json, 2), ["UNCLEAR", "UNCLEAR"])

        # 9. Empty or malformed string
        self.assertEqual(parse_strict_llm_json('', 2), ["UNCLEAR", "UNCLEAR"])
        self.assertEqual(parse_strict_llm_json('{bad json', 2), ["UNCLEAR", "UNCLEAR"])

    def test_fuzz_decide_against_oracle_5000_cases(self):
        seed = 4289104
        random.seed(seed)
        print(f"\n[Layer 1 Fuzz] Running 5000 decide iterations with random seed: {seed}")

        levels = ["MUST", "SHOULD"]
        labels = ["YES", "PARTIAL", "NO", "UNCLEAR"]

        for i in range(5000):
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

            actual = decide(criteria, results, is_truncated=is_trunc)
            expected = independent_decide_oracle(criteria, results, is_truncated=is_trunc)
            self.assertEqual(actual, expected, f"Mismatch at iter {i}: crit={criteria}, res={results}, trunc={is_trunc}")

        print("  [Layer 1 Fuzz] 5000 iterations passed with 100% agreement against independent oracle.")

    def test_url_validator_bypass_table(self):
        expected_repo = "huzyow155/ship-escrow-fixtures"

        # Valid URL
        self.assertEqual(
            validate_url("https://github.com/huzyow155/ship-escrow-fixtures/pull/2", expected_repo),
            ("huzyow155", "ship-escrow-fixtures", "2")
        )

        # Upper case scheme accepted
        self.assertEqual(
            validate_url("HTTPS://github.com/huzyow155/ship-escrow-fixtures/pull/42", expected_repo),
            ("huzyow155", "ship-escrow-fixtures", "42")
        )

        # Bypasses that MUST raise UserError:
        bypasses = [
            ("http://github.com/huzyow155/ship-escrow-fixtures/pull/2", "PR URL must use https scheme"),
            ("ftp://github.com/huzyow155/ship-escrow-fixtures/pull/2", "PR URL must use https scheme"),
            ("https://user:pass@github.com/huzyow155/ship-escrow-fixtures/pull/2", "PR URL must not contain userinfo"),
            ("https://github.com:8080/huzyow155/ship-escrow-fixtures/pull/2", "PR URL must not specify non-standard port"),
            ("https://github.com.evil.com/huzyow155/ship-escrow-fixtures/pull/2", "PR URL host must be github.com"),
            ("https://githubx.com/huzyow155/ship-escrow-fixtures/pull/2", "PR URL host must be github.com"),
            ("https://127.0.0.1/huzyow155/ship-escrow-fixtures/pull/2", "PR URL host must be github.com"),
            ("https://github.com/other/repo/pull/2", "PR URL owner/repo mismatch"),
            ("https://github.com/huzyow155/ship-escrow-fixtures/pull/2/files", "PR URL path shape invalid"),
            ("https://github.com/huzyow155/ship-escrow-fixtures/pull/abc", "PR URL path shape invalid"),
            ("https://github.com/huzyow155/ship-escrow-fixtures/pull/2?token=secret", "PR URL must not contain query or fragment"),
            ("https://github.com/huzyow155/ship-escrow-fixtures/pull/2#heading", "PR URL must not contain query or fragment"),
        ]

        for url, expected_err in bypasses:
            with self.assertRaises(gl.vm.UserError) as cm:
                validate_url(url, expected_repo)
            self.assertEqual(str(cm.exception), expected_err, f"Failed on URL: {url}")

    def test_integer_payout_math(self):
        amounts = [1, 2, 3, 7, 10, 100, 1000, 999999]
        percentages = [100, 75, 50, 25]

        for amt in amounts:
            for pct in percentages:
                dev_amt = (amt * pct) // 100
                creator_amt = amt - dev_amt
                self.assertEqual(dev_amt + creator_amt, amt, f"Invariant broken for amount={amt}, pct={pct}")

    def test_criteria_hash_canonicalization(self):
        crit1 = [
            {"level": "MUST", "text": "Must do X"},
            {"level": "SHOULD", "text": "Should do Y"}
        ]
        paths1 = ["src/a.py", "src/b.py"]
        h1 = compute_criteria_hash_pure(crit1, paths1)

        # Paths out of order still produces same hash because required_paths is sorted
        paths2 = ["src/b.py", "src/a.py"]
        h2 = compute_criteria_hash_pure(crit1, paths2)
        self.assertEqual(h1, h2)

        # Altering text changes hash
        crit_diff = [
            {"level": "MUST", "text": "Must do X changed"},
            {"level": "SHOULD", "text": "Should do Y"}
        ]
        h3 = compute_criteria_hash_pure(crit_diff, paths1)
        self.assertNotEqual(h1, h3)


if __name__ == '__main__':
    unittest.main()
