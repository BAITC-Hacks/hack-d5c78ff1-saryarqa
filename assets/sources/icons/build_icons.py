"""Build the lightweight, editable SVG HUD set for Аким на 5 часов.

Run with the bundled Python runtime. Every icon has a transparent 32 px
viewBox, shared line weight, and large shapes that survive 24 px display.
"""

from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "sources" / "icons"
EXPORT = ROOT / "exports" / "icons"
EXPORT.mkdir(parents=True, exist_ok=True)

INK = "#173247"
BLUE = "#278DD2"
TEAL = "#00AEB6"
GREEN = "#70C44D"
ORANGE = "#FF9B39"
RED = "#ED6658"
YELLOW = "#FFC247"
CREAM = "#FFF8EA"
PURPLE = "#8A6ACC"


def path(d, fill="none", stroke=True, sw=2.4):
    return f'<path d="{d}" fill="{fill}"' + (f' stroke="{INK}" stroke-width="{sw}"' if stroke else "") + '/>'


def rect(x, y, w, h, fill, rx=2.5, stroke=True):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"' + (f' stroke="{INK}" stroke-width="2.4"' if stroke else "") + '/>'


def circle(cx, cy, r, fill, stroke=True):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"' + (f' stroke="{INK}" stroke-width="2.4"' if stroke else "") + '/>'


def line(x1, y1, x2, y2, sw=2.4, color=INK):
    return f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{color}" stroke-width="{sw}" fill="none"/>'


def bus(color=TEAL):
    return rect(5, 6, 22, 19, color, 4) + rect(8, 9, 16, 7, CREAM, 1.5) + line(16, 9, 16, 16, 1.8) + circle(10, 24, 2, INK, False) + circle(22, 24, 2, INK, False)


def tree():
    return path("M16 18v11", "none") + path("M6 18c-2-3 0-6 3-7-1-4 2-7 6-6 3-3 8-1 8 3 4 0 6 4 4 7 2 4-1 8-5 8H11c-3 0-5-2-5-5Z", GREEN)


def building():
    return rect(6, 12, 20, 16, CREAM, 1.5) + path("M4 13 16 5l12 8", ORANGE) + rect(14, 20, 4, 8, BLUE, 0.5) + rect(9, 16, 3, 3, BLUE, 0.5, False) + rect(20, 16, 3, 3, BLUE, 0.5, False)


def shield():
    return path("M16 3 26 7v8c0 7-4 11-10 14C10 26 6 22 6 15V7Z", BLUE) + path("m11 16 3.3 3.3 7-7", "none", True, 2.8)


def utility():
    return path("M5 8h10v6h7v10", "none", True, 3.6) + circle(23, 24, 4, BLUE) + rect(3, 5, 14, 5, CREAM, 1.2)


def road():
    return path("M11 3h10l7 26H4Z", INK, False) + line(16, 6, 16, 11, 2.2, CREAM) + line(16, 16, 16, 21, 2.2, CREAM) + line(16, 26, 16, 28, 2.2, CREAM)


def leaf():
    return path("M27 5C10 5 4 10 6 21c2 9 18 8 21-16Z", GREEN) + path("M7 27c5-8 10-11 17-15")


def book():
    return path("M4 7c5-2 9-2 12 1 3-3 7-3 12-1v19c-5-2-9-2-12 1-3-3-7-3-12-1Z", CREAM) + line(16, 8, 16, 27)


def clinic():
    return rect(5, 10, 22, 18, CREAM, 2) + path("M13 4h6v6h-6Z", CREAM) + path("M16 14v9m-4.5-4.5h9", "none", True, 3.5)


def lamp():
    return path("M16 11v17m-5 0h10", "none", True, 2.8) + path("M10 12c0-5 12-5 12 0l2 4H8Z", YELLOW) + line(16, 5, 16, 3, 2, ORANGE) + line(7, 8, 5, 6, 2, ORANGE) + line(25, 8, 27, 6, 2, ORANGE)


def crossing():
    return circle(18, 5, 2.5, INK, False) + path("m17 9-3 8 6 3m-3-11 4 6m-7 2-5 9m11-6 4 7", "none", True, 2.6) + line(4, 28, 28, 28, 2, BLUE)


def pipe():
    return path("M5 8h16v11h6", "none", True, 4) + path("M5 8h16v11h6", "none", True, 1.7) + path("M23 24c0-2 3-5 3-5s3 3 3 5a3 3 0 1 1-6 0Z", BLUE)


def request():
    return path("M6 6h20v15H15l-6 5v-5H6Z", CREAM) + circle(12, 14, 1.3, BLUE, False) + circle(17, 14, 1.3, BLUE, False) + circle(22, 14, 1.3, BLUE, False)


def svg(body, viewbox="0 0 32 32"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="{viewbox}" fill="none" stroke-linecap="round" stroke-linejoin="round">{body}</svg>\n'


ICONS = {
    "category-transport": bus(),
    "category-ecology": tree(),
    "category-social-services": building(),
    "category-safety": shield(),
    "category-city-services": utility(),
    "indicator-T1-traffic": road(),
    "indicator-T2-transit": bus(BLUE),
    "indicator-E1-greenery": tree(),
    "indicator-E2-air": leaf(),
    "indicator-S1-education": book(),
    "indicator-S2-health": clinic(),
    "indicator-B1-lighting": lamp(),
    "indicator-B2-crossing": crossing(),
    "indicator-C1-utilities": pipe(),
    "indicator-C2-requests": request(),
    "hud-budget": path("M5 12c0-3 5-5 11-5s11 2 11 5-5 5-11 5S5 15 5 12Zm0 0v7c0 3 5 5 11 5s11-2 11-5v-7M5 19v3c0 3 5 5 11 5s11-2 11-5v-3", YELLOW),
    "hud-turn": circle(16, 16, 12, CREAM) + path("M16 8v9l6 3", "none", True, 2.8),
    "hud-quarter": rect(5, 7, 22, 21, CREAM, 2) + line(5, 13, 27, 13) + line(11, 4, 11, 10) + line(21, 4, 21, 10) + circle(12, 20, 2, BLUE, False) + circle(20, 20, 2, ORANGE, False),
    "hud-score": path("M8 5h16v9c0 6-4 9-8 9s-8-3-8-9Z", YELLOW) + path("M8 8H4c0 5 1 8 6 8m14-8h4c0 5-1 8-6 8M16 23v5m-6 0h12"),
    "hud-compare": path("M3 11h11v17H3Zm15-7h11v24H18Z", CREAM) + path("M5 24h7m8-4h7", "none", True, 2, ),
    "hud-info": circle(16, 16, 12, BLUE) + circle(16, 10, 1.5, CREAM, False) + path("M16 15v8", "none", True, 3),
    "hud-warning": path("M16 4 29 27H3Z", YELLOW) + path("M16 12v7m0 4v.1", "none", True, 3),
    "hud-critical": path("M9 23V11a7 7 0 0 1 14 0v12Z", RED) + rect(6, 23, 20, 4, INK, 1, False) + line(16, 3, 16, 1, 2.6, RED) + line(4, 12, 2, 11, 2.6, RED) + line(28, 12, 30, 11, 2.6, RED),
    "hud-synergy": path("m16 3 3.4 9.6L29 16l-9.6 3.4L16 29l-3.4-9.6L3 16l9.6-3.4Z", YELLOW),
    "hud-locked": rect(7, 14, 18, 14, INK, 2) + path("M11 14V9a5 5 0 0 1 10 0v5", "none", True, 3),
    "hud-selected": circle(16, 16, 11, CREAM) + circle(16, 16, 5, ORANGE) + line(16, 2, 16, 8) + line(16, 24, 16, 30) + line(2, 16, 8, 16) + line(24, 16, 30, 16),
    "hud-undo": path("M13 8 5 16l8 8v-5h6c6 0 8-4 8-8-3 2-6 3-9 3h-5Z", BLUE),
    "hud-play": path("M8 4 27 16 8 28Z", GREEN),
    "hud-pause": rect(7, 5, 7, 22, YELLOW, 1.5) + rect(18, 5, 7, 22, YELLOW, 1.5),
    "hud-skip": path("M4 6 17 16 4 26Zm13 0 13 10-13 10Z", BLUE),
    "hud-sound-on": path("M4 12h6l7-6v20l-7-6H4Z", BLUE) + path("M21 11c3 2 3 8 0 10m4-14c5 4 5 14 0 18", "none"),
    "hud-sound-off": path("M4 12h6l7-6v20l-7-6H4Z", BLUE) + line(21, 11, 28, 22, 3, RED) + line(28, 11, 21, 22, 3, RED),
    "map-lrt": path("M8 10V7h16v3", "none") + rect(7, 9, 18, 17, BLUE, 5) + rect(10, 12, 12, 7, CREAM, 2) + line(9, 28, 5, 31) + line(23, 28, 27, 31),
    "map-transport": path("M4 25h24M7 25V8h18v17", "none", True, 2.6) + path("M10 9h12l3 8H7Z", TEAL) + circle(10, 25, 2, INK, False) + circle(22, 25, 2, INK, False),
    "map-bus": bus(),
    "map-citizen": circle(16, 8, 5, ORANGE) + path("M7 27v-4c0-6 4-9 9-9s9 3 9 9v4Z", BLUE),
    "map-road": path("M3 22 21 3l8 8L11 29Z", INK, False) + line(8, 23, 23, 8, 2, CREAM),
    "map-district": path("M3 9 12 4 20 7 28 5l1 18-10 5-8-3-8 2Z", CREAM) + path("M12 4v21m8-18-1 21", "none", True, 1.6),
    "map-citywide": path("M5 27V13h7v14m8 0V7h7v20", "none", True, 3) + path("M3 27h26", "none", True, 2.4) + path("M11 9c2-4 8-4 10 0M8 5c4-5 12-5 16 0", "none", True, 2, ),
}

# Chosen concept A: skyline, rising ground line, one sun. No official symbol.
LOGO = (
    rect(2, 2, 28, 28, CREAM, 6, False)
    + circle(23, 9, 3.2, YELLOW, False)
    + path("M6 25V16h5v9m3 0V9h5v16m2 0V18h5v7", "none", True, 2.8)
    + path("M5 27c7-3 15-3 22 0", "none", True, 2.8)
)
ICONS["logo-app"] = LOGO

ROWS = []
for name, body in ICONS.items():
    filename = name + ".svg"
    content = svg(body)
    (SOURCE / filename).write_text(content, encoding="utf-8")
    (EXPORT / filename).write_text(content, encoding="utf-8")
    purpose = name.replace("-", " ")
    ROWS.append([f"assets/exports/icons/{filename}", purpose, "both", "32x32, viewBox 0 0 32 32", "center", "Original project artwork", "Project-owned; redistribution license not specified", "final"])

ROWS.append(["assets/exports/favicon/favicon.svg", "approved app icon concept A", "both", "32x32, viewBox 0 0 32 32", "center", "Original project artwork", "Project-owned; redistribution license not specified", "final"])
for size in (16, 32, 64, 192, 512):
    ROWS.append([f"assets/exports/favicon/favicon-{size}.png", "approved app icon concept A", "both", f"{size}x{size}", "center", "Original project artwork", "Project-owned; redistribution license not specified", "final"])

with (SOURCE / "ASSET-MANIFEST.csv").open("w", encoding="utf-8", newline="") as fh:
    writer = csv.writer(fh)
    writer.writerow(["filename", "purpose", "view", "dimensions or viewBox", "anchor point", "source/creator", "license", "status"])
    writer.writerows(ROWS)

print(f"Wrote {len(ICONS)} source SVGs, exports, and manifest")
