"""
services/pdf_generator.py
--------------------------
Renders the report Jinja2 template into a PDF bytes object.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, pass_environment
from weasyprint import HTML

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def _make_jinja_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True,
    )

    # Custom filter: truncate a dict to n items
    def truncate_dict(d: dict, n: int):
        return list(d.items())[:n]

    # Custom filter: absolute value
    def abs_filter(value: float) -> float:
        return abs(value)

    env.filters["truncate_dict"] = truncate_dict
    env.filters["abs"] = abs_filter

    return env


def generate_pdf(report: dict[str, Any], algos: list[dict[str, Any]]) -> bytes:
    """
    Render the report + algo recommendations into a PDF and return raw bytes.

    Args:
        report: The EDA report dict (matches frontend Report type).
        algos:  Algorithm recommendations list.

    Returns:
        PDF as bytes.
    """
    env = _make_jinja_env()
    template = env.get_template("report.html")

    generated_at = datetime.now(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")

    html_str = template.render(
        report=report,
        algos=algos,
        generated_at=generated_at,
    )

    pdf_bytes = HTML(string=html_str, base_url=str(TEMPLATES_DIR)).write_pdf()
    return pdf_bytes