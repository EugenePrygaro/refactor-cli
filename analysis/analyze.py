#!/usr/bin/env python3
"""Summarize refactoring runs for research questions RQ1-RQ4."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import wilcoxon


METRICS = {
    "cyclomatic_complexity": "CC",
    "sloc": "Logical SLOC",
    "halstead_volume": "Halstead volume",
    "halstead_effort": "Halstead effort",
    "mi_classic": "MI classic",
    "mi_escomplex": "MI escomplex",
}
ELIGIBLE_STATUSES = {"success", "fail"}
EXCLUDED_STATUSES = {"invalid", "excluded"}
REPORT_COLUMNS = [
    "run_id",
    "model",
    "component",
    "status",
    "attempts",
    *[f"before_{metric}" for metric in METRICS],
    *[f"after_{metric}" for metric in METRICS],
]
ATTEMPT_COLUMNS = [
    "run_id",
    "model",
    "component",
    "attempt",
    "failure_stage",
    "error_category",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "latency_ms",
]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze refactor-cli run folders for RQ1-RQ4."
    )
    parser.add_argument(
        "runs",
        nargs="*",
        type=Path,
        help="Run directories (default: discover results/<run_id>/ automatically).",
    )
    parser.add_argument(
        "--results-root",
        type=Path,
        default=Path("results"),
        help="Root containing run directories and tokens/prompt-tokens.csv.",
    )
    parser.add_argument(
        "--tokens",
        type=Path,
        help="Prompt token CSV (default: <results-root>/tokens/prompt-tokens.csv).",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("analysis/out"),
        help="Output directory (default: analysis/out).",
    )
    return parser.parse_args(argv)


def discover_runs(results_root: Path) -> list[Path]:
    if not results_root.exists():
        return []
    return sorted(
        directory
        for directory in results_root.iterdir()
        if directory.is_dir()
        and (directory / "report.csv").is_file()
        and (directory / "attempts.csv").is_file()
        and (directory / "run.json").is_file()
    )


def load_runs(run_dirs: list[Path]) -> tuple[pd.DataFrame, pd.DataFrame]:
    report_frames: list[pd.DataFrame] = []
    attempt_frames: list[pd.DataFrame] = []

    for run_dir in run_dirs:
        run_json = run_dir / "run.json"
        report_csv = run_dir / "report.csv"
        attempts_csv = run_dir / "attempts.csv"
        missing = [
            str(path)
            for path in (run_json, report_csv, attempts_csv)
            if not path.is_file()
        ]
        if missing:
            raise FileNotFoundError(
                f"Run directory {run_dir} is missing required file(s): "
                + ", ".join(missing)
            )

        with run_json.open(encoding="utf-8") as file:
            metadata = json.load(file)
        run_id = str(metadata.get("runId") or run_dir.name)
        model = str(metadata.get("model") or "unknown")

        reports = pd.read_csv(report_csv)
        reports["run_id"] = run_id
        reports["model"] = model
        reports["component"] = reports["component"].astype(str)
        reports["status"] = reports["status"].astype(str).str.strip().str.lower()
        report_frames.append(reports)

        attempts = pd.read_csv(attempts_csv)
        if not attempts.empty:
            attempts["run_id"] = run_id
            attempts["model"] = model
            attempts["component"] = attempts["component"].astype(str)
            attempt_frames.append(attempts)

    reports = (
        pd.concat(report_frames, ignore_index=True, sort=False)
        if report_frames
        else pd.DataFrame(columns=REPORT_COLUMNS)
    )
    attempts = (
        pd.concat(attempt_frames, ignore_index=True, sort=False)
        if attempt_frames
        else pd.DataFrame(columns=ATTEMPT_COLUMNS)
    )
    for column in REPORT_COLUMNS:
        if column not in reports:
            reports[column] = pd.NA
    for column in ATTEMPT_COLUMNS:
        if column not in attempts:
            attempts[column] = pd.NA
    if not reports.empty:
        reports["attempts"] = pd.to_numeric(reports["attempts"], errors="coerce")
    if not attempts.empty:
        for column in (
            "attempt",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "latency_ms",
        ):
            attempts[column] = pd.to_numeric(attempts[column], errors="coerce")
    return reports, attempts


def find_success_attempts(
    reports: pd.DataFrame, attempts: pd.DataFrame
) -> pd.DataFrame:
    """Return one row per report component with its successful attempt, if any."""
    keys = ["run_id", "model", "component"]
    eligible = reports.loc[reports["status"].isin(ELIGIBLE_STATUSES), keys + ["status"]]
    if eligible.empty:
        return eligible.assign(success_attempt=pd.Series(dtype="float64"))

    successful_attempts = attempts.loc[
        attempts["failure_stage"].astype(str).str.strip().str.lower().eq("none"),
        keys + ["attempt"],
    ].copy()
    successful_attempts["attempt"] = pd.to_numeric(
        successful_attempts["attempt"], errors="coerce"
    )
    first_success = (
        successful_attempts.dropna(subset=["attempt"])
        .groupby(keys, as_index=False)["attempt"]
        .min()
        .rename(columns={"attempt": "success_attempt"})
    )
    result = eligible.merge(first_success, on=keys, how="left")
    result.loc[result["status"] != "success", "success_attempt"] = np.nan
    return result


def prepare_data(
    reports: pd.DataFrame, attempts: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    reports = reports.copy()
    attempts = attempts.copy()
    reports["status"] = reports["status"].astype(str).str.strip().str.lower()
    invalid_counts = (
        reports.loc[reports["status"].isin(EXCLUDED_STATUSES)]
        .groupby(["run_id", "model", "status"], dropna=False)
        .size()
        .rename("components")
        .reset_index()
    )
    print(f"Excluded Invalid components: {(reports['status'] == 'invalid').sum()}")
    print(f"Excluded Excluded components: {(reports['status'] == 'excluded').sum()}")
    eligible_reports = reports.loc[
        reports["status"].isin(ELIGIBLE_STATUSES)
    ].copy()
    eligible_attempts = attempts.merge(
        eligible_reports[["run_id", "model", "component"]].drop_duplicates(),
        on=["run_id", "model", "component"],
        how="inner",
    )
    success_attempts = find_success_attempts(eligible_reports, eligible_attempts)
    return eligible_reports, eligible_attempts, success_attempts


def build_rq1(success_attempts: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    columns = [
        "model",
        "attempt",
        "success_rate_mean",
        "success_rate_sd",
        "runs_n",
        "success_rate_mean_sd",
    ]
    if success_attempts.empty:
        return pd.DataFrame(columns=columns), pd.DataFrame()

    run_rates: list[dict[str, Any]] = []
    for (run_id, model), group in success_attempts.groupby(
        ["run_id", "model"], dropna=False
    ):
        denominator = len(group)
        if denominator == 0:
            continue
        for attempt_limit in (1, 2, 3):
            successful = group["success_attempt"].le(attempt_limit).sum()
            run_rates.append(
                {
                    "run_id": run_id,
                    "model": model,
                    "attempt": attempt_limit,
                    "success_rate": successful / denominator,
                    "eligible_components": denominator,
                }
            )
    per_run = pd.DataFrame(run_rates)
    if per_run.empty:
        return pd.DataFrame(columns=columns), per_run
    summary = (
        per_run.groupby(["model", "attempt"])["success_rate"]
        .agg(success_rate_mean="mean", success_rate_sd="std", runs_n="count")
        .reset_index()
    )
    summary["success_rate_sd"] = summary["success_rate_sd"].fillna(0.0)
    summary["success_rate_mean_sd"] = summary.apply(
        lambda row: f"{row.success_rate_mean:.4f} ± {row.success_rate_sd:.4f}",
        axis=1,
    )
    return summary[columns], per_run


def build_rq2(reports: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "model",
        "metric",
        "before_mean",
        "after_mean",
        "before_median",
        "after_median",
        "wilcoxon_p_value",
        "n",
    ]
    successful = reports.loc[reports["status"] == "success"]
    rows: list[dict[str, Any]] = []
    for model, group in successful.groupby("model", dropna=False):
        for metric, label in METRICS.items():
            before = pd.to_numeric(
                group.get(f"before_{metric}", pd.Series(index=group.index, dtype=float)),
                errors="coerce",
            )
            after = pd.to_numeric(
                group.get(f"after_{metric}", pd.Series(index=group.index, dtype=float)),
                errors="coerce",
            )
            paired = pd.concat([before, after], axis=1).dropna()
            paired.columns = ["before", "after"]
            n = len(paired)
            p_value = np.nan
            if n:
                try:
                    p_value = float(
                        wilcoxon(
                            paired["before"],
                            paired["after"],
                            alternative="two-sided",
                            zero_method="wilcox",
                        ).pvalue
                    )
                except ValueError:
                    if np.allclose(paired["before"], paired["after"]):
                        p_value = 1.0
                    else:
                        raise
            rows.append(
                {
                    "model": model,
                    "metric": label,
                    "before_mean": paired["before"].mean() if n else np.nan,
                    "after_mean": paired["after"].mean() if n else np.nan,
                    "before_median": paired["before"].median() if n else np.nan,
                    "after_median": paired["after"].median() if n else np.nan,
                    "wilcoxon_p_value": p_value,
                    "n": n,
                }
            )
    return pd.DataFrame(rows, columns=columns)


def build_rq3(
    attempts: pd.DataFrame,
    success_attempts: pd.DataFrame,
    token_csv: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    component_columns = [
        "run_id",
        "model",
        "component",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "success_attempt",
    ]
    if attempts.empty:
        component_tokens = pd.DataFrame(columns=component_columns)
    else:
        numeric = attempts.copy()
        for column in ("prompt_tokens", "completion_tokens", "total_tokens"):
            numeric[column] = pd.to_numeric(numeric[column], errors="coerce")
        if "total_tokens" in numeric:
            numeric["token_count"] = numeric["total_tokens"].fillna(
                numeric["prompt_tokens"].fillna(0)
                + numeric["completion_tokens"].fillna(0)
            )
        else:
            numeric["token_count"] = (
                numeric["prompt_tokens"].fillna(0)
                + numeric["completion_tokens"].fillna(0)
            )
        component_tokens = (
            numeric.groupby(["run_id", "model", "component"], as_index=False)
            .agg(
                prompt_tokens=("prompt_tokens", "sum"),
                completion_tokens=("completion_tokens", "sum"),
                total_tokens=("token_count", "sum"),
            )
            .merge(
                success_attempts[
                    ["run_id", "model", "component", "success_attempt"]
                ],
                on=["run_id", "model", "component"],
                how="right",
            )
        )

    if token_csv.is_file():
        token_data = pd.read_csv(token_csv)
        for column in ("tokens_sliced", "tokens_full", "eta"):
            if column in token_data:
                token_data[column] = pd.to_numeric(token_data[column], errors="coerce")
        eta = (
            token_data.groupby("model", as_index=False)["eta"]
            .agg(eta_mean="mean", eta_median="median", eta_n="count")
            if "model" in token_data and "eta" in token_data
            else pd.DataFrame(columns=["model", "eta_mean", "eta_median", "eta_n"])
        )
    else:
        print(f"Warning: token savings file not found: {token_csv}", file=sys.stderr)
        eta = pd.DataFrame(columns=["model", "eta_mean", "eta_median", "eta_n"])

    if component_tokens.empty:
        token_summary = pd.DataFrame(
            columns=["model", "components_n", "tokens_mean", "tokens_median"]
        )
    else:
        token_summary = (
            component_tokens.groupby("model", as_index=False)["total_tokens"]
            .agg(
                components_n="count",
                tokens_mean="mean",
                tokens_median="median",
            )
        )
    summary = token_summary.merge(eta, on="model", how="outer")

    success_histogram = (
        success_attempts.loc[success_attempts["success_attempt"].notna()]
        .groupby(["model", "success_attempt"])
        .size()
        .rename("components")
        .reset_index()
        if not success_attempts.empty
        else pd.DataFrame(columns=["model", "success_attempt", "components"])
    )
    return component_tokens[component_columns], summary, success_histogram


def build_rq4(
    reports: pd.DataFrame, attempts: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    summary_columns = [
        "model",
        "eligible_components",
        "one_pass_success_rate",
        "final_success_rate",
        "mean_latency_ms",
    ]
    summary_rows: list[dict[str, Any]] = []
    for model, group in reports.groupby("model", dropna=False):
        successful = group["status"].eq("success")
        summary_rows.append(
            {
                "model": model,
                "eligible_components": len(group),
                "one_pass_success_rate": (
                    group.loc[successful, "attempts"].eq(1).sum() / len(group)
                    if len(group)
                    else np.nan
                ),
                "final_success_rate": successful.sum() / len(group) if len(group) else np.nan,
                "mean_latency_ms": (
                    pd.to_numeric(
                        attempts.loc[attempts["model"] == model, "latency_ms"],
                        errors="coerce",
                    ).mean()
                    if not attempts.empty
                    else np.nan
                ),
            }
        )
    summary = pd.DataFrame(summary_rows, columns=summary_columns)

    if attempts.empty:
        distribution = pd.DataFrame(
            columns=["model", "error_category", "attempts", "percent"]
        )
    else:
        category = attempts["error_category"].fillna("").astype(str).str.strip()
        category = category.mask(category.eq(""), "none")
        distribution = (
            attempts.assign(error_category=category)
            .groupby(["model", "error_category"])
            .size()
            .rename("attempts")
            .reset_index()
        )
        distribution["percent"] = distribution["attempts"] / distribution.groupby(
            "model"
        )["attempts"].transform("sum")
    return summary, distribution


def save_rq1(summary: pd.DataFrame, out: Path) -> None:
    summary.to_csv(out / "rq1_success_by_attempt.csv", index=False)
    fig, axis = plt.subplots(figsize=(8, 5))
    for model, group in summary.groupby("model", dropna=False):
        group = group.sort_values("attempt")
        axis.errorbar(
            group["attempt"],
            group["success_rate_mean"],
            yerr=group["success_rate_sd"],
            marker="o",
            capsize=3,
            label=str(model),
        )
    axis.set(
        xlabel="Attempt limit (cumulative)",
        ylabel="Success rate",
        title="RQ1: Cumulative success rate by attempt",
        xticks=[1, 2, 3],
        ylim=(0, 1),
    )
    if not summary.empty:
        axis.legend()
    fig.tight_layout()
    fig.savefig(out / "rq1_success_by_attempt.png", dpi=160)
    plt.close(fig)


def save_rq2(summary: pd.DataFrame, reports: pd.DataFrame, out: Path) -> None:
    summary.to_csv(out / "rq2_metric_comparison.csv", index=False)
    successful = reports.loc[reports["status"] == "success"]
    fig, axes = plt.subplots(2, 3, figsize=(15, 9))
    for axis, (metric, label) in zip(axes.flat, METRICS.items()):
        before_column, after_column = f"before_{metric}", f"after_{metric}"
        before = pd.to_numeric(successful.get(before_column), errors="coerce").dropna()
        after = pd.to_numeric(successful.get(after_column), errors="coerce").dropna()
        plot_data = [series.to_numpy() for series in (before, after) if not series.empty]
        labels = [name for name, series in zip(("Before", "After"), (before, after)) if not series.empty]
        if plot_data:
            axis.boxplot(plot_data, labels=labels, showfliers=False)
        else:
            axis.text(0.5, 0.5, "No successful components", ha="center", va="center")
        axis.set_title(label)
        axis.grid(axis="y", alpha=0.25)
    fig.suptitle("RQ2: Before/after metrics for successful components")
    fig.tight_layout()
    fig.savefig(out / "rq2_metric_boxplots.png", dpi=160)
    plt.close(fig)


def save_rq3(
    component_tokens: pd.DataFrame,
    summary: pd.DataFrame,
    success_histogram: pd.DataFrame,
    out: Path,
) -> None:
    component_tokens.to_csv(out / "rq3_tokens_per_component.csv", index=False)
    summary.to_csv(out / "rq3_tokens_and_eta.csv", index=False)
    success_histogram.to_csv(out / "rq3_success_attempt_counts.csv", index=False)

    fig, axes = plt.subplots(1, 3, figsize=(17, 5))
    if not success_histogram.empty:
        pivot = success_histogram.pivot(
            index="model", columns="success_attempt", values="components"
        ).fillna(0)
        pivot = pivot.reindex(columns=[1, 2, 3], fill_value=0)
        pivot.plot(kind="bar", ax=axes[0])
        axes[0].set_ylabel("Successful components")
        axes[0].set_xlabel("")
        axes[0].legend(title="Success attempt")
    else:
        axes[0].text(0.5, 0.5, "No successful components", ha="center", va="center")
    axes[0].set_title("Success-attempt counts")

    if not component_tokens.empty:
        token_groups = [
            group["total_tokens"].dropna().to_numpy()
            for _, group in component_tokens.groupby("model")
        ]
        token_labels = [
            str(model) for model, _ in component_tokens.groupby("model")
        ]
        axes[1].boxplot(token_groups, labels=token_labels, showfliers=False)
        axes[1].tick_params(axis="x", rotation=35)
        axes[1].set_ylabel("Tokens per component (all attempts)")
    else:
        axes[1].text(0.5, 0.5, "No attempt token data", ha="center", va="center")
    axes[1].set_title("Token use per component")

    if not summary.empty and "eta_mean" in summary:
        eta_summary = summary.dropna(subset=["eta_mean"])
        if not eta_summary.empty:
            x = np.arange(len(eta_summary))
            axes[2].bar(x - 0.18, eta_summary["eta_mean"], width=0.36, label="Mean")
            axes[2].bar(x + 0.18, eta_summary["eta_median"], width=0.36, label="Median")
            axes[2].set_xticks(x, eta_summary["model"], rotation=35, ha="right")
            axes[2].set_ylabel("η")
            axes[2].legend()
        else:
            axes[2].text(0.5, 0.5, "No η data", ha="center", va="center")
    else:
        axes[2].text(0.5, 0.5, "No η data", ha="center", va="center")
    axes[2].set_title("Prompt token savings")

    fig.suptitle("RQ3: Attempts, token use, and prompt savings")
    fig.tight_layout()
    fig.savefig(out / "rq3_attempts_tokens_eta.png", dpi=160)
    plt.close(fig)


def save_rq4(
    summary: pd.DataFrame, distribution: pd.DataFrame, out: Path
) -> None:
    summary.to_csv(out / "rq4_model_summary.csv", index=False)
    distribution.to_csv(out / "rq4_error_category_distribution.csv", index=False)
    fig, axis = plt.subplots(figsize=(11, 6))
    if not distribution.empty:
        pivot = distribution.pivot(
            index="model", columns="error_category", values="percent"
        ).fillna(0)
        pivot.plot(kind="bar", stacked=True, ax=axis, colormap="tab20")
        axis.set_ylabel("Share of attempts")
        axis.set_xlabel("")
        axis.legend(title="Error category", bbox_to_anchor=(1.02, 1), loc="upper left")
    else:
        axis.text(0.5, 0.5, "No attempt data", ha="center", va="center")
    axis.set_title("RQ4: Error category distribution by model")
    fig.tight_layout()
    fig.savefig(out / "rq4_error_categories.png", dpi=160)
    plt.close(fig)


def run_analysis(
    run_dirs: list[Path],
    token_csv: Path,
    output_dir: Path,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    reports, attempts = load_runs(run_dirs)
    eligible_reports, eligible_attempts, success_attempts = prepare_data(
        reports, attempts
    )
    rq1, _ = build_rq1(success_attempts)
    rq2 = build_rq2(eligible_reports)
    rq3_components, rq3_summary, rq3_histogram = build_rq3(
        eligible_attempts, success_attempts, token_csv
    )
    rq4_summary, rq4_distribution = build_rq4(
        eligible_reports, eligible_attempts
    )
    save_rq1(rq1, output_dir)
    save_rq2(rq2, eligible_reports, output_dir)
    save_rq3(rq3_components, rq3_summary, rq3_histogram, output_dir)
    save_rq4(rq4_summary, rq4_distribution, output_dir)
    print(f"Analyzed {len(run_dirs)} run(s); outputs written to {output_dir}")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    runs = args.runs or discover_runs(args.results_root)
    token_csv = args.tokens or args.results_root / "tokens" / "prompt-tokens.csv"
    try:
        run_analysis(runs, token_csv, args.out)
    except (OSError, ValueError, json.JSONDecodeError, pd.errors.ParserError) as error:
        print(f"Analysis failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
