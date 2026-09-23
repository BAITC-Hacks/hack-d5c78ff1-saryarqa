"""Build the reviewed visual asset ZIP without including stale geographic data."""

from __future__ import annotations

import csv
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
PREVIEWS = [
    ("01 Style — approved v2", "agent-01-style-v2.png"),
    ("02 Geography — source status only", "agent-02-map-reference.png"),
    ("03 World pieces — approved", "agent-03-world.png"),
    ("04 Buildings — approved v2", "agent-04-buildings-v2.png"),
    ("05 Characters — approved option A", "agent-05-characters.png"),
    ("06 Vehicles — approved v2", "agent-06-vehicles-v2.png"),
    ("07 Policies M01–M07 — approved v2", "agent-07-policies-M01-M07-v2.png"),
    ("08 Policies M08–M14 — approved", "agent-08-policies-M08-M14.png"),
    ("09 HUD and app icon — approved A", "agent-09-hud-icons.png"),
    ("10 Effects — approved", "agent-10-effects.png"),
]
MEDIA_SUFFIXES = {".svg", ".png", ".webp", ".css"}
LICENSE = "Project-owned; redistribution license not specified"
ZIP_ROOT = "Saryarqa-asset-pack"


def draw_fit(pdf: canvas.Canvas, path: Path, x: float, y: float, width: float, height: float) -> None:
    with Image.open(path) as image:
        scale = min(width / image.width, height / image.height)
        draw_width = image.width * scale
        draw_height = image.height * scale
    pdf.drawImage(ImageReader(str(path)), x + (width - draw_width) / 2, y + (height - draw_height) / 2,
                  width=draw_width, height=draw_height, mask="auto")


def make_contact_sheet() -> None:
    out = ROOT / "CONTACT-SHEET.pdf"
    page_width, page_height = landscape(A3)
    pdf = canvas.Canvas(str(out), pagesize=(page_width, page_height))
    margin, gap, header = 34, 22, 62
    cell_width = (page_width - 2 * margin - gap) / 2
    cell_height = (page_height - header - margin - gap) / 2
    for start in range(0, len(PREVIEWS), 4):
        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(margin, page_height - 35, "Saryarqa City Game — reviewed asset concepts")
        pdf.setFont("Helvetica", 9)
        pdf.drawRightString(page_width - margin, page_height - 35, f"Sheet {start // 4 + 1}")
        for index, (label, filename) in enumerate(PREVIEWS[start:start + 4]):
            col, row = index % 2, index // 2
            x = margin + col * (cell_width + gap)
            y = page_height - header - (row + 1) * cell_height - row * gap
            pdf.setStrokeColorRGB(0.82, 0.83, 0.8)
            pdf.rect(x, y, cell_width, cell_height, stroke=1, fill=0)
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(x + 10, y + cell_height - 17, label)
            draw_fit(pdf, ROOT / "previews" / filename, x + 8, y + 8, cell_width - 16, cell_height - 35)
        pdf.showPage()

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(margin, page_height - 35, "Examples of actual game exports")
    examples = [
        ("Editable style scenes: rendered preview", ROOT / "exports/style/preview-style.png"),
        ("Character animation: mayor sheet", ROOT / "exports/characters/mayor-sheet.png"),
        ("Vehicle atlas: bus", ROOT / "exports/units/vehicles/bus/atlas.png"),
        ("App icon A: 512 px", ROOT / "exports/favicon/favicon-512.png"),
    ]
    for index, (label, path) in enumerate(examples):
        col, row = index % 2, index // 2
        x = margin + col * (cell_width + gap)
        y = page_height - header - (row + 1) * cell_height - row * gap
        pdf.setStrokeColorRGB(0.82, 0.83, 0.8)
        pdf.rect(x, y, cell_width, cell_height, stroke=1, fill=0)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(x + 10, y + cell_height - 17, label)
        draw_fit(pdf, path, x + 8, y + 8, cell_width - 16, cell_height - 35)
    pdf.showPage()
    pdf.save()


def view_for(path: Path) -> str:
    name = path.stem.lower()
    if "tilted" in name:
        return "tilted"
    if re.search(r"(^|-)top($|-)", name):
        return "top"
    return "both"


def dimensions(path: Path) -> str:
    if path.suffix.lower() == ".svg":
        root = ET.parse(path).getroot()
        return root.attrib.get("viewBox") or f"{root.attrib.get('width', '?')} x {root.attrib.get('height', '?')}"
    if path.suffix.lower() in {".png", ".webp"}:
        with Image.open(path) as image:
            return f"{image.width}x{image.height}"
    return "n/a"


def anchor_for(path: Path) -> str:
    name = path.stem.lower()
    parts = set(path.parts)
    if "characters" in parts:
        return "64,124 per 128px frame"
    if "vehicles" in parts:
        return "top 128,128; tilted 128,240 per 256px frame"
    if "world-marker" in name:
        return "32,77"
    if "tilted-object" in name:
        return "80,110 (M01-M07); see local manifest for M08-M14"
    if "world" in parts:
        return "top 128,128; tilted 160,148; see local manifest"
    if "style" in parts or path.suffix.lower() == ".css":
        return "n/a"
    return "center"


def manifest_rows(paths: list[Path]) -> list[list[str]]:
    rows = []
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        status = "concept" if relative.startswith("previews/") else "final"
        if "map/MAP-REFERENCE.svg" in relative or "agent-02-map-reference" in relative:
            status = "unverified"
        creator = "Built-in imagegen concept; no third-party image" if relative.startswith("previews/") else "Original project artwork; editable source under sources/"
        if status == "unverified":
            creator = "Original source-status layout; facts: gov.kz 2026 district-area notice; no boundary vector"
        purpose = path.stem.replace("-", " ")
        rows.append([relative, purpose, view_for(path), dimensions(path), anchor_for(path), creator, LICENSE, status])
    return rows


def build() -> None:
    for _, filename in PREVIEWS:
        if not (ROOT / "previews" / filename).is_file():
            raise FileNotFoundError(filename)
    make_contact_sheet()
    (ROOT / "MISSING.md").write_text((ROOT / "sources/map/MISSING.md").read_text(encoding="utf-8"), encoding="utf-8")
    media = sorted(p for folder in ("sources", "exports") for p in (ROOT / folder).rglob("*")
                   if p.is_file() and p.suffix.lower() in MEDIA_SUFFIXES)
    media += [ROOT / "previews" / filename for _, filename in PREVIEWS]
    with (ROOT / "ASSET-MANIFEST.csv").open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.writer(output)
        writer.writerow(["filename", "purpose", "view", "dimensions_or_viewBox", "anchor_point", "source_creator", "license", "status"])
        writer.writerows(manifest_rows(media))
    zip_path = ROOT / "Saryarqa-asset-pack.zip"
    included = [p for folder in ("sources", "exports") for p in (ROOT / folder).rglob("*")
                if p.is_file() and "__pycache__" not in p.parts and p.suffix.lower() != ".pyc"]
    included += [ROOT / "previews" / filename for _, filename in PREVIEWS]
    included += [ROOT / name for name in ("ASSET-MANIFEST.csv", "CONTACT-SHEET.pdf", "MISSING.md", "README-PACK.md", "PROMPTS.md")]
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
        for path in sorted(set(included)):
            archive.write(path, f"{ZIP_ROOT}/{path.relative_to(ROOT).as_posix()}")
    with zipfile.ZipFile(zip_path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity check failed")
        print(f"{zip_path}: {len(archive.namelist())} files, {zip_path.stat().st_size / 1024 / 1024:.1f} MiB")
    print(f"Manifest: {len(media)} media and effect files")


if __name__ == "__main__":
    build()
