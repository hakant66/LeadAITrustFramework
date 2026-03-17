import unittest

from app.services.trust_axes import (
    ControlAxisScore,
    AxisMappingItem,
    rollup_axis_scores,
)


class TrustAxesRollupTests(unittest.TestCase):
    def test_rollup_prefers_control_axis(self):
        controls = [
            ControlAxisScore(
                control_id="c1",
                kpi_key="k1",
                control_name="Control 1",
                pillar_key="governance",
                pillar_name="Governance",
                axis_key="safety",
                weight=1.0,
                score_pct=80.0,
            ),
            ControlAxisScore(
                control_id="c2",
                kpi_key="k2",
                control_name="Control 2",
                pillar_key="governance",
                pillar_name="Governance",
                axis_key=None,
                weight=1.0,
                score_pct=60.0,
            ),
        ]
        mapping = [AxisMappingItem(pillar_key="governance", axis_key="compliance")]

        result = rollup_axis_scores(controls, mapping)

        self.assertEqual(result["safety"]["score_pct"], 80.0)
        self.assertEqual(result["compliance"]["score_pct"], 60.0)

    def test_rollup_weighted_average(self):
        controls = [
            ControlAxisScore(
                control_id="c1",
                kpi_key="k1",
                control_name="Control 1",
                pillar_key="data",
                pillar_name="Data",
                axis_key=None,
                weight=2.0,
                score_pct=90.0,
            ),
            ControlAxisScore(
                control_id="c2",
                kpi_key="k2",
                control_name="Control 2",
                pillar_key="data",
                pillar_name="Data",
                axis_key=None,
                weight=1.0,
                score_pct=60.0,
            ),
        ]
        mapping = [AxisMappingItem(pillar_key="data", axis_key="provenance")]

        result = rollup_axis_scores(controls, mapping)

        expected = round((90.0 * 2.0 + 60.0 * 1.0) / 3.0, 2)
        self.assertEqual(result["provenance"]["score_pct"], expected)

    def test_rollup_skips_missing_scores(self):
        controls = [
            ControlAxisScore(
                control_id="c1",
                kpi_key="k1",
                control_name="Control 1",
                pillar_key="human",
                pillar_name="Human",
                axis_key=None,
                weight=1.0,
                score_pct=None,
            )
        ]
        mapping = [AxisMappingItem(pillar_key="human", axis_key="safety")]

        result = rollup_axis_scores(controls, mapping)

        self.assertIsNone(result["safety"]["score_pct"])


if __name__ == "__main__":
    unittest.main()
