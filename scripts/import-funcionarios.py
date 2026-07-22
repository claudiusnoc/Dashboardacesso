"""Build the one-time collaborator payload from FUNCIONARIOS.xlsx."""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def cpf_digits(value: str | None) -> str | None:
    digits = re.sub(r"\D", "", value or "")
    return digits or None


def valid_cpf(cpf: str | None) -> bool:
    if not cpf or len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    numbers = [int(char) for char in cpf]
    first = (sum(numbers[index] * (10 - index) for index in range(9)) * 10) % 11
    first = 0 if first == 10 else first
    second = (sum(numbers[index] * (11 - index) for index in range(10)) * 10) % 11
    second = 0 if second == 10 else second
    return numbers[9] == first and numbers[10] == second


def parse_date(value: str | None) -> str | None:
    value = clean(value)
    if not value:
        return None
    for pattern in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, pattern).date().isoformat()
        except ValueError:
            continue
    try:
        serial = float(value)
        return (date(1899, 12, 30) + timedelta(days=serial)).isoformat()
    except ValueError:
        raise ValueError(f"Data de ASO inválida: {value}")


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.iter(f"{{{SHEET_NS}}}t"))
        for item in root.findall(f"{{{SHEET_NS}}}si")
    ]


def row_values(row: ET.Element, shared: list[str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for cell in row.findall(f"{{{SHEET_NS}}}c"):
        match = re.match(r"[A-Z]+", cell.attrib.get("r", ""))
        if not match:
            continue
        kind = cell.attrib.get("t")
        raw_node = cell.find(f"{{{SHEET_NS}}}v")
        inline = cell.find(f"{{{SHEET_NS}}}is")
        value = ""
        if kind == "inlineStr" and inline is not None:
            value = "".join(node.text or "" for node in inline.iter(f"{{{SHEET_NS}}}t"))
        elif raw_node is not None:
            raw = raw_node.text or ""
            value = shared[int(raw)] if kind == "s" and raw.isdigit() else raw
        values[match.group(0)] = value.strip()
    return values


def read_collaborators(workbook: Path) -> tuple[list[dict], list[dict]]:
    collaborators: list[dict] = []
    rejected: list[dict] = []
    with zipfile.ZipFile(workbook) as archive:
        shared = shared_strings(archive)
        with archive.open("xl/worksheets/sheet1.xml") as sheet:
            for _, element in ET.iterparse(sheet, events=("end",)):
                if element.tag != f"{{{SHEET_NS}}}row":
                    continue
                source_row = int(element.attrib.get("r", "0"))
                values = row_values(element, shared)
                element.clear()
                if source_row == 1 or not any(values.values()):
                    continue
                full_name = clean(values.get("A"))
                cpf = cpf_digits(values.get("B"))
                if not full_name or not valid_cpf(cpf):
                    rejected.append({"source_row": source_row, "full_name": full_name, "cpf": cpf})
                    continue
                collaborators.append(
                    {
                        "external_id": f"funcionarios-xlsx:{cpf}",
                        "full_name": full_name.upper(),
                        "cpf": cpf,
                        "city": clean(values.get("G")),
                        "next_aso_date": parse_date(values.get("F")),
                        "active": True,
                        "source_file": workbook.name,
                        "source_row": source_row,
                    }
                )
    return collaborators, rejected


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/import"))
    args = parser.parse_args()
    collaborators, rejected = read_collaborators(args.workbook)
    cpfs = [item["cpf"] for item in collaborators]
    duplicates = sorted({cpf for cpf in cpfs if cpfs.count(cpf) > 1})
    if rejected or duplicates or len(collaborators) != 170:
        raise SystemExit(
            f"Importação rejeitada: válidos={len(collaborators)}, rejeitados={rejected}, CPFs duplicados={duplicates}"
        )

    today = date.today()
    aso_dates = [date.fromisoformat(item["next_aso_date"]) for item in collaborators if item["next_aso_date"]]
    report = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "source_file": str(args.workbook),
        "collaborators": len(collaborators),
        "unique_cpfs": len(set(cpfs)),
        "missing_next_aso": sum(not item["next_aso_date"] for item in collaborators),
        "expired_aso": sum(item < today for item in aso_dates),
        "aso_due_in_30_days": sum(today <= item <= today + timedelta(days=30) for item in aso_dates),
        "rejected_records": rejected,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "collaborators.json").write_text(json.dumps(collaborators, ensure_ascii=False), encoding="utf-8")
    (args.output / "collaborators-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
