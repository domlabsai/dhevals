"""Canonical reports derived from immutable DHEvals run artifacts."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import html
from io import StringIO
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence


REPORT_VERSION = "0.1.0"


def build_report(artifact: Mapping[str, Any]) -> Dict[str, Any]:
    """Build a deterministic report without changing the source run artifact."""

    run = artifact.get("run") if isinstance(artifact.get("run"), dict) else {}
    raw_results = artifact.get("results") if isinstance(artifact.get("results"), list) else []
    results = [result for result in raw_results if isinstance(result, dict)]
    categories = _category_summaries(results)
    score_values = [_number(result.get("score")) for result in results]
    score_values = [score for score in score_values if score is not None]
    cost_values = [_number(_metrics(result).get("estimated_cost_usd")) for result in results]
    cost_values = [cost for cost in cost_values if cost is not None]
    completed = sum(result.get("status") in {"pass", "partial", "fail"} for result in results)
    errors = sum(result.get("status") == "error" for result in results)
    task_count = len(results)
    summary = {
        "task_count": task_count,
        "completed_count": completed,
        "coverage": _ratio(completed, task_count),
        "overall_score": _average(score_values),
        "scored_task_count": len(score_values),
        "error_count": errors,
        "estimated_cost_usd_total": round(sum(cost_values), 8) if cost_values else None,
        "cost_task_count": len(cost_values),
    }
    return {
        "schema_version": REPORT_VERSION,
        "kind": "dhevals_report",
        "generated_at": _utc_now(),
        "run": dict(run),
        "summary": summary,
        "categories": categories,
        "results": results,
        "methodology": {
            "score_scale": "0_to_1",
            "quality_score_excludes_infrastructure_errors": True,
            "suite_hash": run.get("suite_hash"),
            "runner_version": run.get("runner_version"),
        },
    }


def build_youtube_pack(report: Mapping[str, Any]) -> Dict[str, Any]:
    """Create a factual, presentation-ready summary from a canonical report."""

    run = report.get("run") if isinstance(report.get("run"), dict) else {}
    summary = report.get("summary") if isinstance(report.get("summary"), dict) else {}
    model = run.get("model") if isinstance(run.get("model"), dict) else {}
    model_id = model.get("model_id") or "unknown-model"
    suite_id = run.get("suite_id") or "unknown-suite"
    suite_version = run.get("suite_version") or "unknown-version"
    score = _number(summary.get("overall_score"))
    task_count = int(summary.get("task_count") or 0)
    score_text = f"{score * 100:.1f}/100" if score is not None else "sem score de qualidade"
    categories = report.get("categories") if isinstance(report.get("categories"), list) else []

    facts = [
        f"Modelo avaliado: {model_id}.",
        f"Suíte: {suite_id} v{suite_version}.",
        f"Tarefas concluídas: {summary.get('completed_count', 0)} de {task_count}.",
        f"Score médio determinístico: {score_text}.",
    ]
    if summary.get("error_count", 0):
        facts.append(f"Tarefas com erro de infraestrutura: {summary['error_count']}.")
    if _number(summary.get("estimated_cost_usd_total")) is not None:
        facts.append(f"Custo estimado da rodada: US$ {summary['estimated_cost_usd_total']:.6f}.")

    limitations = [
        "O score determinístico não substitui a revisão humana da rubrica.",
        "Comparações públicas exigem a mesma versão de suíte e configuração.",
    ]
    if model.get("provider") == "fixture":
        limitations.insert(0, "Esta rodada usa fixture offline e não representa a qualidade do endpoint real.")

    return {
        "schema_version": REPORT_VERSION,
        "kind": "dhevals_youtube_pack",
        "title": f"DHEvals · {model_id} · {suite_id} v{suite_version}",
        "run_id": run.get("id"),
        "hook": f"{model_id} alcançou {score_text} em {task_count} tarefas heavy-user.",
        "facts": facts,
        "category_breakdown": [
            {
                "category": category.get("category"),
                "score": _percent(category.get("score")),
                "task_count": category.get("task_count"),
            }
            for category in categories
            if isinstance(category, dict)
        ],
        "methodology": {
            "suite_hash": run.get("suite_hash"),
            "suite_version": suite_version,
            "runner_version": run.get("runner_version"),
            "model": model,
        },
        "limitations": limitations,
    }


def build_results_csv(report: Mapping[str, Any]) -> str:
    """Serialize task-level results into a spreadsheet-friendly CSV."""

    fields = [
        "run_id",
        "suite_id",
        "suite_version",
        "suite_hash",
        "model_id",
        "provider",
        "task_id",
        "title",
        "category",
        "prompt",
        "status",
        "score",
        "latency_ms",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "estimated_cost_usd",
        "error",
        "output",
    ]
    run = report.get("run") if isinstance(report.get("run"), dict) else {}
    model = run.get("model") if isinstance(run.get("model"), dict) else {}
    buffer = StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    results = report.get("results") if isinstance(report.get("results"), list) else []
    for result in results:
        if not isinstance(result, Mapping):
            continue
        metrics = _metrics(result)
        writer.writerow({
            "run_id": run.get("id"),
            "suite_id": run.get("suite_id"),
            "suite_version": run.get("suite_version"),
            "suite_hash": run.get("suite_hash"),
            "model_id": model.get("model_id"),
            "provider": model.get("provider"),
            "task_id": result.get("task_id"),
            "title": result.get("title"),
            "category": result.get("category"),
            "prompt": result.get("prompt"),
            "status": result.get("status"),
            "score": result.get("score"),
            "latency_ms": metrics.get("latency_ms"),
            "input_tokens": metrics.get("input_tokens"),
            "output_tokens": metrics.get("output_tokens"),
            "total_tokens": metrics.get("total_tokens"),
            "estimated_cost_usd": metrics.get("estimated_cost_usd"),
            "error": result.get("error"),
            "output": result.get("output"),
        })
    return buffer.getvalue()


def build_html_report(report: Mapping[str, Any]) -> str:
    """Create a self-contained, readable HTML report from a canonical report."""

    run = report.get("run") if isinstance(report.get("run"), dict) else {}
    summary = report.get("summary") if isinstance(report.get("summary"), dict) else {}
    model = run.get("model") if isinstance(run.get("model"), dict) else {}
    score = _number(summary.get("overall_score"))
    score_text = f"{score * 100:.1f}/100" if score is not None else "—"
    title = f"DHEvals · {model.get('model_id') or 'model'} · {run.get('suite_id') or 'suite'} v{run.get('suite_version') or 'unknown'}"
    category_rows = "".join(
        f"<tr><th>{_escape(category.get('category'))}</th><td>{category.get('task_count', '—')}</td><td>{_escape(_display_percent(category.get('coverage')))}</td><td>{_escape(_display_percent(category.get('score')))}</td><td>{category.get('tokens_total', '—')}</td><td>{_escape(_display_currency(category.get('estimated_cost_usd_total')))}</td></tr>"
        for category in (report.get("categories") if isinstance(report.get("categories"), list) else [])
        if isinstance(category, Mapping)
    )
    result_rows = "".join(
        f"<tr><th>{_escape(result.get('title') or result.get('task_id'))}</th><td>{_escape(result.get('category'))}</td><td class=\"status-{_escape(result.get('status'))}\">{_escape(result.get('status'))}</td><td>{_escape(_display_percent(result.get('score')))}</td><td>{_escape(_display_metric(_metrics(result).get('latency_ms'), ' ms'))}</td><td>{_escape(_display_currency(_metrics(result).get('estimated_cost_usd')))}</td><td><details><summary>output</summary><pre>{_escape(result.get('output') or result.get('error') or '—')}</pre></details></td></tr>"
        for result in (report.get("results") if isinstance(report.get("results"), list) else [])
        if isinstance(result, Mapping)
    )
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{_escape(title)}</title>
  <style>
    :root {{ color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0b0d0f; color: #e9edf0; }}
    body {{ margin: 0; background: #0b0d0f; }}
    main {{ max-width: 1180px; margin: 0 auto; padding: 44px 24px 72px; }}
    header {{ border-bottom: 1px solid #273039; padding-bottom: 24px; }}
    h1 {{ margin: 0 0 10px; font-size: 28px; font-weight: 600; }}
    h2 {{ margin: 34px 0 12px; font-size: 17px; font-weight: 500; }}
    p, small {{ color: #9ca8b0; }}
    .meta {{ display: flex; flex-wrap: wrap; gap: 8px 20px; font: 12px ui-monospace, SFMono-Regular, monospace; color: #9ca8b0; }}
    .cards {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 26px; }}
    .card {{ border: 1px solid #273039; background: #11161a; padding: 16px; }}
    .card span {{ display: block; color: #82909a; font-size: 11px; margin-bottom: 10px; }}
    .card strong {{ color: #d6ff56; font: 20px ui-monospace, SFMono-Regular, monospace; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 12px; background: #101418; }}
    th, td {{ border-bottom: 1px solid #273039; padding: 11px 10px; text-align: left; vertical-align: top; }}
    thead th {{ color: #82909a; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }}
    tbody th {{ font-weight: 500; }}
    .status-pass {{ color: #d6ff56; }} .status-partial {{ color: #62b8ff; }} .status-fail, .status-error {{ color: #ff7d88; }}
    pre {{ max-width: 620px; overflow: auto; white-space: pre-wrap; color: #b8c2c8; font: 11px/1.5 ui-monospace, SFMono-Regular, monospace; }}
    @media (max-width: 720px) {{ .cards {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} main {{ padding: 28px 14px 52px; }} table {{ min-width: 820px; }} .table-wrap {{ overflow-x: auto; }} }}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>{_escape(title)}</h1>
      <div class="meta"><span>run {_escape(run.get('id'))}</span><span>suite hash {_escape(run.get('suite_hash'))}</span><span>generated {_escape(report.get('generated_at'))}</span></div>
    </header>
    <section class="cards">
      <div class="card"><span>Overall score</span><strong>{_escape(score_text)}</strong></div>
      <div class="card"><span>Coverage</span><strong>{_escape(_display_percent(summary.get('coverage')))}</strong></div>
      <div class="card"><span>Completed</span><strong>{summary.get('completed_count', 0)} / {summary.get('task_count', 0)}</strong></div>
      <div class="card"><span>Errors</span><strong>{summary.get('error_count', 0)}</strong></div>
      <div class="card"><span>Estimated cost</span><strong>{_escape(_display_currency(summary.get('estimated_cost_usd_total')))}</strong></div>
    </section>
    <h2>Categories</h2>
    <div class="table-wrap"><table><thead><tr><th>Category</th><th>Tasks</th><th>Coverage</th><th>Score</th><th>Tokens</th><th>Est. cost</th></tr></thead><tbody>{category_rows}</tbody></table></div>
    <h2>Task results</h2>
    <div class="table-wrap"><table><thead><tr><th>Task</th><th>Category</th><th>Status</th><th>Score</th><th>Latency</th><th>Est. cost</th><th>Evidence</th></tr></thead><tbody>{result_rows}</tbody></table></div>
  </main>
</body>
</html>
"""


def write_reports(
    input_path: Path,
    report_path: Path,
    youtube_path: Optional[Path] = None,
    html_path: Optional[Path] = None,
    csv_path: Optional[Path] = None,
) -> Dict[str, Any]:
    artifact = json.loads(input_path.read_text(encoding="utf-8"))
    if not isinstance(artifact, dict):
        raise ValueError("run artifact must be a JSON object")
    report = build_report(artifact)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if youtube_path is not None:
        youtube_path.parent.mkdir(parents=True, exist_ok=True)
        youtube_path.write_text(json.dumps(build_youtube_pack(report), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if html_path is not None:
        html_path.parent.mkdir(parents=True, exist_ok=True)
        html_path.write_text(build_html_report(report), encoding="utf-8")
    if csv_path is not None:
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        csv_path.write_text(build_results_csv(report), encoding="utf-8")
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build canonical DHEvals and YouTube report artifacts.")
    parser.add_argument("--input", required=True, help="Path to a DHEvals run artifact")
    parser.add_argument("--report-output", required=True, help="Path for the canonical report JSON")
    parser.add_argument("--youtube-output", help="Optional path for the YouTube pack JSON")
    parser.add_argument("--html-output", help="Optional self-contained HTML report path")
    parser.add_argument("--csv-output", help="Optional task-level CSV report path")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    report = write_reports(
        Path(args.input),
        Path(args.report_output),
        Path(args.youtube_output) if args.youtube_output else None,
        Path(args.html_output) if args.html_output else None,
        Path(args.csv_output) if args.csv_output else None,
    )
    print(json.dumps({
        "report_output": args.report_output,
        "youtube_output": args.youtube_output,
        "html_output": args.html_output,
        "csv_output": args.csv_output,
        "run_id": report["run"].get("id"),
        "overall_score": report["summary"].get("overall_score"),
    }, ensure_ascii=False))
    return 0


def _category_summaries(results: Iterable[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Mapping[str, Any]]] = {}
    for result in results:
        category = result.get("category") or "Uncategorized"
        grouped.setdefault(str(category), []).append(result)
    summaries: List[Dict[str, Any]] = []
    for category in sorted(grouped):
        items = grouped[category]
        scores = [_number(item.get("score")) for item in items]
        scores = [score for score in scores if score is not None]
        latencies = [_number(_metrics(item).get("latency_ms")) for item in items]
        latencies = [value for value in latencies if value is not None]
        tokens = [_number(_metrics(item).get("total_tokens")) for item in items]
        tokens = [value for value in tokens if value is not None]
        costs = [_number(_metrics(item).get("estimated_cost_usd")) for item in items]
        costs = [value for value in costs if value is not None]
        completed = sum(item.get("status") in {"pass", "partial", "fail"} for item in items)
        summaries.append({
            "category": category,
            "task_count": len(items),
            "completed_count": completed,
            "error_count": sum(item.get("status") == "error" for item in items),
            "coverage": _ratio(completed, len(items)),
            "score": _average(scores),
            "latency_ms_total": round(sum(latencies), 2) if latencies else None,
            "tokens_total": int(sum(tokens)) if tokens else None,
            "estimated_cost_usd_total": round(sum(costs), 8) if costs else None,
        })
    return summaries


def _metrics(result: Mapping[str, Any]) -> Mapping[str, Any]:
    metrics = result.get("metrics")
    return metrics if isinstance(metrics, dict) else {}


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _average(values: Sequence[float]) -> Optional[float]:
    return round(sum(values) / len(values), 4) if values else None


def _ratio(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _percent(value: Any) -> Optional[float]:
    number = _number(value)
    return round(number * 100, 1) if number is not None else None


def _display_percent(value: Any) -> str:
    number = _number(value)
    return f"{number * 100:.1f}%" if number is not None else "—"


def _display_metric(value: Any, suffix: str = "") -> str:
    number = _number(value)
    return f"{number:.2f}{suffix}" if number is not None else "—"


def _display_currency(value: Any) -> str:
    number = _number(value)
    return f"US$ {number:.6f}" if number is not None else "—"


def _escape(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
