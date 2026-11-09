import tempfile
import unittest
import json
from pathlib import Path

import pandas as pd

from analyze import (
    build_rq1,
    build_rq2,
    build_rq3,
    build_rq4,
    load_runs,
    prepare_data,
)


class AnalysisTests(unittest.TestCase):
    def setUp(self) -> None:
        self.reports = pd.DataFrame(
            [
                {
                    "run_id": "run-a",
                    "model": "qwen",
                    "component": "component-01",
                    "status": "Success",
                    "attempts": 1,
                    "before_cyclomatic_complexity": 8,
                    "after_cyclomatic_complexity": 4,
                    "before_sloc": 30,
                    "after_sloc": 20,
                    "before_halstead_volume": 40,
                    "after_halstead_volume": 25,
                    "before_halstead_effort": 80,
                    "after_halstead_effort": 50,
                    "before_mi_classic": 50,
                    "after_mi_classic": 70,
                    "before_mi_escomplex": 45,
                    "after_mi_escomplex": 65,
                },
                {
                    "run_id": "run-a",
                    "model": "qwen",
                    "component": "component-02",
                    "status": "Success",
                    "attempts": 2,
                },
                {
                    "run_id": "run-a",
                    "model": "qwen",
                    "component": "component-03",
                    "status": "Invalid",
                    "attempts": 0,
                },
                {
                    "run_id": "run-a",
                    "model": "qwen",
                    "component": "component-04",
                    "status": "Excluded",
                    "attempts": 0,
                },
            ]
        )
        self.attempts = pd.DataFrame(
            [
                {
                    "run_id": "run-a",
                    "model": "qwen",
                    "component": "component-01",
                    "attempt": 1,
                    "failure_stage": "None",
                    "error_category": "",
                    "prompt_tokens": 100,
                    "completion_tokens": 20,
                    "total_tokens": 120,
                    "latency_ms": 500,
                },
                {
                    "run_id": "run-a",
                    "model": "qwen",
                    "component": "component-02",
                    "attempt": 1,
                    "failure_stage": "Test",
                    "error_category": "test_assertion",
                    "prompt_tokens": 100,
                    "completion_tokens": 20,
                    "total_tokens": 120,
                    "latency_ms": 700,
                },
                {
                    "run_id": "run-a",
                    "model": "qwen",
                    "component": "component-02",
                    "attempt": 2,
                    "failure_stage": "None",
                    "error_category": "",
                    "prompt_tokens": 80,
                    "completion_tokens": 10,
                    "total_tokens": 90,
                    "latency_ms": 600,
                },
            ]
        )

    def test_excluded_statuses_do_not_affect_success_rates(self) -> None:
        reports, attempts, successes = prepare_data(self.reports, self.attempts)
        summary, _ = build_rq1(successes)

        self.assertEqual(len(reports), 2)
        self.assertEqual(len(attempts), 3)
        self.assertEqual(
            summary.loc[summary["attempt"] == 1, "success_rate_mean"].iloc[0],
            0.5,
        )
        self.assertEqual(
            summary.loc[summary["attempt"] == 2, "success_rate_mean"].iloc[0],
            1.0,
        )

    def test_successful_only_metrics_and_wilcoxon(self) -> None:
        reports, _, _ = prepare_data(self.reports, self.attempts)
        result = build_rq2(reports)
        cc = result.loc[result["metric"] == "CC"].iloc[0]

        self.assertEqual(cc["n"], 1)
        self.assertEqual(cc["before_mean"], 8)
        self.assertEqual(cc["after_mean"], 4)
        self.assertTrue(pd.notna(cc["wilcoxon_p_value"]))

    def test_token_sums_eta_and_error_distribution(self) -> None:
        reports, attempts, successes = prepare_data(self.reports, self.attempts)
        with tempfile.TemporaryDirectory() as directory:
            tokens = Path(directory) / "prompt-tokens.csv"
            pd.DataFrame(
                [
                    {"component": "component-01", "model": "qwen", "eta": 0.25},
                    {"component": "component-02", "model": "qwen", "eta": 0.75},
                ]
            ).to_csv(tokens, index=False)
            component_tokens, token_summary, histogram = build_rq3(
                attempts, successes, tokens
            )

        self.assertEqual(
            component_tokens.loc[
                component_tokens["component"] == "component-02", "total_tokens"
            ].iloc[0],
            210,
        )
        self.assertEqual(token_summary.loc[0, "eta_mean"], 0.5)
        self.assertEqual(histogram.loc[0, "success_attempt"], 1)

        model_summary, errors = build_rq4(reports, attempts)
        self.assertEqual(model_summary.loc[0, "final_success_rate"], 1.0)
        self.assertIn("test_assertion", errors["error_category"].tolist())
        self.assertIn("none", errors["error_category"].tolist())

    def test_loads_run_metadata_and_csv_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            run_dir = Path(directory) / "run-a"
            run_dir.mkdir()
            (run_dir / "run.json").write_text(
                json.dumps({"runId": "run-a", "model": "qwen2.5-coder:14b"}),
                encoding="utf-8",
            )
            pd.DataFrame(
                [
                    {
                        "component": "component-01",
                        "status": "Success",
                        "attempts": 1,
                        "before_cyclomatic_complexity": 8,
                        "after_cyclomatic_complexity": 4,
                    }
                ]
            ).to_csv(run_dir / "report.csv", index=False)
            pd.DataFrame(
                [
                    {
                        "component": "component-01",
                        "attempt": 1,
                        "failure_stage": "None",
                        "error_category": "",
                        "prompt_tokens": 10,
                        "completion_tokens": 5,
                        "total_tokens": 15,
                        "latency_ms": 100,
                    }
                ]
            ).to_csv(run_dir / "attempts.csv", index=False)

            reports, attempts = load_runs([run_dir])

        self.assertEqual(reports.loc[0, "model"], "qwen2.5-coder:14b")
        self.assertEqual(reports.loc[0, "run_id"], "run-a")
        self.assertEqual(attempts.loc[0, "total_tokens"], 15)


if __name__ == "__main__":
    unittest.main()
