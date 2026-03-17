import unittest

from app.services.trust_verdict import compute_tol, allowed_environments


class TrustVerdictTests(unittest.TestCase):
    def test_compute_tol_thresholds(self):
        axis_scores = {"safety": 80.0, "compliance": 79.9, "provenance": 90.0}
        self.assertEqual(compute_tol(axis_scores), "TOL-2")

        axis_scores = {"safety": 80.0, "compliance": 80.0, "provenance": 80.0}
        self.assertEqual(compute_tol(axis_scores), "TOL-3")

        axis_scores = {"safety": 59.9, "compliance": 60.0, "provenance": 60.0}
        self.assertEqual(compute_tol(axis_scores), "TOL-1")

        axis_scores = {"safety": None, "compliance": 70.0, "provenance": 70.0}
        self.assertEqual(compute_tol(axis_scores), "TOL-0")

    def test_allowed_environments(self):
        allowed = allowed_environments("TOL-2")
        self.assertIn("prod", allowed)
        self.assertIn("dev", allowed)

        allowed_low = allowed_environments("TOL-0")
        self.assertNotIn("prod", allowed_low)


if __name__ == "__main__":
    unittest.main()
