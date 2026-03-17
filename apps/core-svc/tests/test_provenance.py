import unittest

from app.services.provenance import sha256_hex, verify_sha256


class TestProvenanceIntegrity(unittest.TestCase):
    def test_sha256_hex(self):
        data = b"leadai-provenance"
        self.assertEqual(
            sha256_hex(data),
            "dffdc2823de2674697afc672f673bc0d430296c1562c8224ce4741ef3fce9fc0",
        )

    def test_verify_sha256_detects_tamper(self):
        original = b"trusted"
        tampered = b"tampered"
        expected = sha256_hex(original)

        self.assertTrue(verify_sha256(expected, original))
        self.assertFalse(verify_sha256(expected, tampered))
