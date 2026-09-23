"""Slice the approved rounded-miniature character sheets into web game sprites.

Run with the bundled Python/Pillow runtime. Source sheets are kept untouched.
Each output sheet has four 128 x 128 frames in a single horizontal row.
"""

from __future__ import annotations

import csv
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "exports" / "characters"
FRAME_SIZE = 128
ANCHOR = (64, 124)  # feet/ground point, same for every frame
LICENSE = "Project-owned; redistribution license not specified"

CHARACTERS = {
    "mayor": ("idle", "selecting", "thinking", "celebrating"),
    "citizen-01": ("idle", "walk", "positive", "concerned"),
    "citizen-02": ("idle", "walk", "positive", "concerned"),
    "citizen-03": ("idle", "walk", "positive", "concerned"),
    "maintenance": ("idle", "walk", "active", "alert"),
    "emergency": ("idle", "walk", "active", "alert"),
}


def frame_from_quadrant(source: Image.Image, index: int) -> Image.Image:
    half_w, half_h = source.width // 2, source.height // 2
    x0 = 0 if index % 2 == 0 else half_w
    y0 = 0 if index < 2 else half_h
    x1 = half_w if index % 2 == 0 else source.width
    y1 = half_h if index < 2 else source.height
    quadrant = source.crop((x0, y0, x1, y1)).convert("RGBA")

    # A conservative threshold is used only to locate the figure; the original
    # antialiased alpha is retained in the final image.
    mask = quadrant.getchannel("A").point(lambda value: 255 if value > 96 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError(f"No opaque character pixels in quadrant {index}")
    figure = quadrant.crop(bounds)
    max_width, max_height = 120, 120
    scale = min(max_width / figure.width, max_height / figure.height)
    size = (max(1, round(figure.width * scale)), max(1, round(figure.height * scale)))
    figure = figure.resize(size, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - figure.width) // 2
    y = ANCHOR[1] - figure.height
    frame.alpha_composite(figure, (x, y))
    return frame


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    for name, poses in CHARACTERS.items():
        source_path = HERE / f"{name}-source.png"
        source = Image.open(source_path).convert("RGBA")
        frames = [frame_from_quadrant(source, i) for i in range(4)]

        sheet = Image.new("RGBA", (FRAME_SIZE * 4, FRAME_SIZE), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            sheet.alpha_composite(frame, (FRAME_SIZE * i, 0))
        sheet_path = OUT / f"{name}-sheet.png"
        still_path = OUT / f"{name}-still.png"
        sheet.save(sheet_path, "PNG", optimize=True)
        frames[0].save(still_path, "PNG", optimize=True)

        rows.append({
            "filename": f"assets/sources/characters/{source_path.name}",
            "purpose": f"editable raster source sheet; {name}; 2x2 pose grid",
            "view": "tilted",
            "dimensions_or_viewBox": f"{source.width}x{source.height}",
            "anchor_point": "per frame after export: 64,124",
            "source_creator": "OpenAI image generation; project direction",
            "license": LICENSE,
            "status": "final-source",
        })
        rows.append({
            "filename": f"assets/exports/characters/{sheet_path.name}",
            "purpose": f"game sprite sheet; {name}; frames: {'|'.join(poses)}",
            "view": "tilted",
            "dimensions_or_viewBox": "512x128; 4 frames of 128x128",
            "anchor_point": "64,124 in each frame",
            "source_creator": f"Derived from {source_path.name}",
            "license": LICENSE,
            "status": "final",
        })
        rows.append({
            "filename": f"assets/exports/characters/{still_path.name}",
            "purpose": f"reduced-motion still; {name}; idle",
            "view": "tilted",
            "dimensions_or_viewBox": "128x128",
            "anchor_point": "64,124",
            "source_creator": f"Derived from {source_path.name}",
            "license": LICENSE,
            "status": "final",
        })

    with (OUT / "ASSET-MANIFEST.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=(
            "filename", "purpose", "view", "dimensions_or_viewBox", "anchor_point",
            "source_creator", "license", "status",
        ))
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
