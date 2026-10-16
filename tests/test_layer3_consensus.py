import unittest
import hashlib
from collections import Counter


class MultiValidatorConsensusSimulator:
    """
    Simulates GenLayer multi-validator consensus over the return string of strict_eq:
    "<VERDICT>|<evidence_sha16>"
    """

    def __init__(self, validator_count=5):
        self.validator_count = validator_count

    def reach_consensus(self, validator_outputs: list[str]) -> tuple[str, str]:
        """
        Returns (consensus_status, agreed_value).
        Status is MAJORITY_AGREE if strictly > 50% of validators agree on the exact same string;
        otherwise MAJORITY_DISAGREE.
        """
        if len(validator_outputs) != self.validator_count:
            raise ValueError(f"Expected {self.validator_count} outputs, got {len(validator_outputs)}")

        counts = Counter(validator_outputs)
        winner, count = counts.most_common(1)[0]

        threshold = self.validator_count // 2 + 1
        if count >= threshold:
            return ("MAJORITY_AGREE", winner)
        return ("MAJORITY_DISAGREE", "")


class TestLayer3Consensus(unittest.TestCase):

    def setUp(self):
        self.sim = MultiValidatorConsensusSimulator(validator_count=5)
        self.evidence_sha1 = hashlib.sha256(b"standard_diff_content").hexdigest()[:16]
        self.evidence_sha2 = hashlib.sha256(b"tampered_diff_content").hexdigest()[:16]

    def test_unanimous_validator_agreement(self):
        """All 5 validators observe identical diff and reach identical verdict"""
        val_str = f"RELEASE_100|{self.evidence_sha1}"
        votes = [val_str] * 5
        status, agreed = self.sim.reach_consensus(votes)
        self.assertEqual(status, "MAJORITY_AGREE")
        self.assertEqual(agreed, val_str)

    def test_majority_validator_agreement(self):
        """3 of 5 validators agree on RELEASE_75 with matching diff hash"""
        majority_str = f"RELEASE_75|{self.evidence_sha1}"
        minority_str = f"RELEASE_50|{self.evidence_sha1}"
        votes = [majority_str, majority_str, majority_str, minority_str, minority_str]

        status, agreed = self.sim.reach_consensus(votes)
        self.assertEqual(status, "MAJORITY_AGREE")
        self.assertEqual(agreed, majority_str)

    def test_evidence_hash_mismatch_prevents_consensus(self):
        """
        Even if validators reach the same verdict 'RELEASE_100', if they saw different diffs
        (e.g. 2 saw diff1, 2 saw diff2, 1 saw diff3), consensus correctly FAILS because
        evidence hash is bound to the verdict!
        """
        v1 = f"RELEASE_100|{self.evidence_sha1}"
        v2 = f"RELEASE_100|{self.evidence_sha2}"
        v3 = f"RELEASE_100|otherhash1234567"
        votes = [v1, v1, v2, v2, v3]

        status, agreed = self.sim.reach_consensus(votes)
        self.assertEqual(status, "MAJORITY_DISAGREE")
        self.assertEqual(agreed, "")

    def test_verdict_disagreement_splits(self):
        """Split vote without majority (e.g. 2 RELEASE_100, 2 REFUND, 1 REVIEW) fails consensus"""
        votes = [
            f"RELEASE_100|{self.evidence_sha1}",
            f"RELEASE_100|{self.evidence_sha1}",
            f"REFUND|{self.evidence_sha1}",
            f"REFUND|{self.evidence_sha1}",
            f"REVIEW|{self.evidence_sha1}",
        ]
        status, agreed = self.sim.reach_consensus(votes)
        self.assertEqual(status, "MAJORITY_DISAGREE")
        self.assertEqual(agreed, "")


if __name__ == '__main__':
    unittest.main()
