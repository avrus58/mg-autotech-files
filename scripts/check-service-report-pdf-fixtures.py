"""Validate synthetic service-report PDFs with the existing PDF QA runtime.

Run the fixture renderer first, then this script with Python + pdfplumber.
This is a development/release check, not a production dependency or renderer.
It never connects to an external service or reads environment/credential files.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

import pdfplumber


def compact(value: str) -> str:
    # PDF line wrapping/ligature shaping must not hide missing content.
    return re.sub(r"\s+", "", value).replace("ﬁ", "fi").replace("ﬂ", "fl")


def load_contract(root: Path) -> dict:
    code = """
import {serviceReportT} from './src/lib/i18n/service-report-translations';
import {supportedLocales} from './src/lib/i18nConfig';
import {reportFixture} from './tests/helpers/service-report-fixture';
const keys=['reportTitle','reportSubtitle','reportReference','revision','issuedAt','workshop','vehicle','brand','model','generation','engine','year','ecu','gearbox','licensePlate','requestedServices','performedServices','performance','before','after','change','power','torque','manuallyDeclared','footerNote','preparedBy','pageNumber','noConfirmedServices','noPerformance','customerNote'];
console.log(JSON.stringify({fixture:reportFixture,locales:supportedLocales.map(({code})=>code),copy:Object.fromEntries(supportedLocales.map(({code})=>[code,Object.fromEntries(keys.map(key=>[key,serviceReportT(code,key)]))]))}));
"""
    result = subprocess.run(
        ["node", "node_modules/tsx/dist/cli.mjs", "-e", code],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(result.stdout)


def validate_pdf(path: Path, locale: str, contract: dict, kind: str) -> dict:
    expected = contract["copy"][locale]
    assert path.read_bytes().startswith(b"%PDF-"), f"{path.name}: not a PDF"
    with pdfplumber.open(path) as document:
        assert document.pages, f"{path.name}: no pages"
        if kind == "standard":
            assert len(document.pages) <= 2, f"{path.name}: standard report unexpectedly spans {len(document.pages)} pages"
        if kind == "long":
            assert len(document.pages) >= 2, "Long fixture must exercise page wrapping"
        texts = [page.extract_text(x_tolerance=2, y_tolerance=3) or "" for page in document.pages]
        text = "\n".join(texts)
        normalized = compact(text)
        for key in ["reportTitle", "reportSubtitle", "reportReference", "revision", "issuedAt", "workshop", "vehicle", "brand", "model", "generation", "engine", "year", "ecu", "gearbox", "licensePlate", "requestedServices", "performedServices", "performance", "footerNote", "preparedBy", "customerNote"]:
            assert compact(expected[key]) in normalized, f"{path.name}: missing localized {key}"
        if kind != "empty":
            for key in ["before", "after", "change", "power", "torque", "manuallyDeclared"]:
                assert compact(expected[key]) in normalized, f"{path.name}: missing localized {key}"
        assert "\ufffd" not in text, f"{path.name}: replacement glyph"
        assert "(cid:" not in text, f"{path.name}: undecodable glyph"
        assert contract["fixture"]["customerId"] not in text, f"{path.name}: private customer UUID exposed"
        assert "/profile/report-logo/" not in text, f"{path.name}: private logo storage path exposed"
        assert not re.search(r"https?://|access_token|service_role|Bearer\s", text), f"{path.name}: unexpected transport/credential data"
        assert contract["fixture"]["orderId"].upper() in text, f"{path.name}: order reference missing"
        if kind == "standard":
            assert compact(contract["fixture"]["workshop"]["name"]) in normalized, f"{path.name}: mixed-language workshop name lost"
            assert compact(contract["fixture"]["customerNote"]) in normalized, f"{path.name}: customer note truncated"
            assert compact(contract["fixture"]["performance"]["sourceNote"]) in normalized, f"{path.name}: source note truncated"
        if kind == "empty":
            assert compact(expected["noConfirmedServices"]) in normalized
            assert compact(expected["noPerformance"]) in normalized
            assert not re.search(r"\b(?:150|185|320|390)\s*(?:HP|Nm)\b", text), f"{path.name}: invented fixture gains"
        if kind == "long":
            assert "DEMO source line 30" in text, f"{path.name}: source-note tail missing"
            assert "DEMO 30" in text, f"{path.name}: service-list tail missing"
            assert normalized.count(compact("DEMO long note for page wrapping.")) == 50, f"{path.name}: long customer-note content lost"
        pages = []
        for number, (page, page_text) in enumerate(zip(document.pages, texts), 1):
            assert page.chars, f"{path.name}: empty page {number}"
            for char in page.chars:
                if not char.get("text", "").strip():
                    continue
                assert char["x0"] >= 30 and char["x1"] <= page.width - 29, f"{path.name}: horizontal clipping on page {number}: {char['text']!r}"
                assert char["top"] >= 20 and char["bottom"] <= page.height - 15, f"{path.name}: vertical clipping on page {number}: {char['text']!r}"
            footer = page.crop((0, page.height - 60, page.width, page.height)).extract_text() or ""
            assert compact(expected["preparedBy"]) in compact(footer), f"{path.name}: missing footer on page {number}"
            assert "MG AutoTech" in footer, f"{path.name}: missing footer brand on page {number}"
            # Pagination is independently extracted from the fixed footer, not
            # inferred from an unrelated body number.
            pagination = expected["pageNumber"].replace("{page}", str(number)).replace("{total}", str(len(document.pages)))
            assert compact(pagination) in compact(footer), f"{path.name}: missing page count on page {number}"
            pages.append({"page": number, "characters": len(page.chars), "width": page.width, "height": page.height})
        return {"file": path.name, "locale": locale, "kind": kind, "pages": pages}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture-dir", type=Path, default=Path(".autopilot/runtime/service-reports/pdfs"))
    parser.add_argument("--output", type=Path, default=Path(".autopilot/runtime/service-reports/pdf-layout-validation.json"))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    contract = load_contract(root)
    directory = args.fixture_dir if args.fixture_dir.is_absolute() else root / args.fixture_dir
    results = []
    failures = []
    cases = [(f"demo-{locale}.pdf", locale, "standard") for locale in contract["locales"]]
    cases.extend([("demo-empty.pdf", "en", "empty"), ("demo-long.pdf", "de", "long")])
    for filename, locale, kind in cases:
        try:
            results.append(validate_pdf(directory / filename, locale, contract, kind))
        except (AssertionError, OSError) as error:
            failures.append(str(error))
    output = args.output if args.output.is_absolute() else root / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"passed": not failures, "scope": "Synthetic PDF fixtures only; actual PDF parser text and glyph bounds, not live customer validation.", "cases": results, "failures": failures}, indent=2, ensure_ascii=False), encoding="utf-8")
    assert not failures, "; ".join(failures)
    print(f"PASS: {len(results)} PDF fixtures / {sum(len(item['pages']) for item in results)} pages; Unicode text, privacy markers, note tails, and page bounds.")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, subprocess.CalledProcessError) as error:
        print(f"PDF fixture validation failed: {error}", file=sys.stderr)
        sys.exit(1)
