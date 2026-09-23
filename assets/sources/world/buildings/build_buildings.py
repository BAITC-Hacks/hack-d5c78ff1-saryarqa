"""Build the approved, lightweight building and city-cue SVG set.

The pieces are fictional visual cues. Their placement never asserts that a
particular building or service exists at that point in Astana.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parent
EXPORT = ROOT.parents[2] / "exports" / "world" / "buildings"
EXPORT.mkdir(parents=True, exist_ok=True)

# Palette from assets/sources/style/style-system.md.
P = {
    "warm": "#F5B64D",
    "shade": "#DC893A",
    "paper": "#FFF8EA",
    "ink": "#173247",
    "road": "#4A5D67",
    "green": "#70C44D",
    "green_dark": "#1D8E63",
    "teal": "#00AEB6",
    "blue": "#278DD2",
    "orange": "#FF9B39",
    "violet": "#8C75C8",
    "terracotta": "#E66C4C",
    "walk": "#F7DEAA",
}


def c(name: str) -> str:
    return P[name]


# Top-down icons share a centre anchor. Tilted icons share a bottom-centre
# ground-contact anchor. The viewBox is deliberately the same for every piece.
PIECES = {
    "residential-house": {
        "purpose": "Decorative residential house cue",
        "top": f'''<path d="M34 38h60v54H34z" fill="{c('paper')}"/>
<path d="M26 44 64 24l38 20v10H26z" fill="{c('terracotta')}"/>
<path d="M58 74h12v18H58z" fill="{c('shade')}"/>''',
        "tilted": f'''<path d="M28 66 64 47l37 18-37 20z" fill="{c('terracotta')}"/>
<path d="M28 66 64 85v26L28 92z" fill="{c('warm')}"/>
<path d="M64 85 101 65v27l-37 19z" fill="{c('shade')}"/>
<path d="M48 77 57 82v15l-9-5z" fill="{c('ink')}"/>''',
    },
    "apartment-block": {
        "purpose": "Decorative apartment block cue",
        "top": f'''<rect x="31" y="26" width="66" height="76" rx="3" fill="{c('warm')}"/>
<rect x="36" y="30" width="56" height="55" fill="{c('road')}"/>
<path d="M41 91h46" stroke="{c('ink')}" stroke-width="6" stroke-dasharray="10 7"/>''',
        "tilted": f'''<path d="M30 38 64 21l35 17-35 18z" fill="{c('road')}"/>
<path d="M30 38 64 56v55L30 93z" fill="{c('warm')}"/>
<path d="M64 56 99 38v55l-35 18z" fill="{c('shade')}"/>
<path d="m39 58 17 9m-17 9 17 9m17-18 17-9m-17 27 17-9" stroke="{c('ink')}" stroke-width="5"/>''',
    },
    "office-civic": {
        "purpose": "Decorative office or civic building cue",
        "top": f'''<path d="M25 38h78v56H25z" fill="{c('warm')}"/>
<path d="M31 44h66v36H31z" fill="{c('road')}"/>
<path d="M48 84h32v10H48z" fill="{c('teal')}"/>''',
        "tilted": f'''<path d="M25 42 66 22l40 20-40 20z" fill="{c('paper')}"/>
<path d="M25 42 66 62v49L25 91z" fill="{c('warm')}"/>
<path d="M66 62 106 42v49l-40 20z" fill="{c('shade')}"/>
<path d="M43 57 64 67v32L43 89z" fill="{c('teal')}"/>
<path d="m77 66 20-10v26L77 92z" fill="{c('road')}"/>''',
    },
    "school-kindergarten": {
        "purpose": "Decorative school or kindergarten with play-yard cue",
        "top": f'''<path d="M24 34h79v42H24z" fill="{c('warm')}"/>
<path d="M19 35 64 17l45 18v12H19z" fill="{c('terracotta')}"/>
<path d="M35 83h58v29H35z" fill="{c('green')}"/>
<path d="M53 91h22v13H53z" fill="{c('orange')}"/>''',
        "tilted": f'''<path d="M20 54 64 31l45 23-45 22z" fill="{c('terracotta')}"/>
<path d="M20 54 64 76v24L20 78z" fill="{c('warm')}"/>
<path d="M64 76 109 54v24l-45 22z" fill="{c('shade')}"/>
<path d="M44 101 64 91l21 10-21 10z" fill="{c('green')}"/>
<path d="m57 102 7-4 8 4-8 4z" fill="{c('orange')}"/>''',
    },
    "clinic": {
        "purpose": "Decorative clinic or family health centre cue",
        "top": f'''<rect x="27" y="29" width="74" height="72" rx="4" fill="{c('paper')}"/>
<path d="M58 43h12v11h11v12H70v11H58V66H47V54h11z" fill="{c('teal')}"/>
<path d="M52 91h24" stroke="{c('road')}" stroke-width="7"/>''',
        "tilted": f'''<path d="M27 45 65 26l38 19-38 19z" fill="{c('paper')}"/>
<path d="M27 45 65 64v47L27 92z" fill="{c('warm')}"/>
<path d="M65 64 103 45v47l-38 19z" fill="{c('shade')}"/>
<path d="m59 42 6 3 6-3v-6l-6 3-6-3z" fill="{c('teal')}"/>
<path d="M54 39v12l11 6 11-6V39" fill="none" stroke="{c('teal')}" stroke-width="6" stroke-linejoin="round"/>''',
    },
    "utility-cue": {
        "purpose": "Decorative city utility cabinet and pipe cue",
        "top": f'''<rect x="27" y="39" width="48" height="51" rx="3" fill="{c('violet')}"/>
<path d="M75 63h18v28h16" fill="none" stroke="{c('road')}" stroke-width="11" stroke-linecap="square" stroke-linejoin="round"/>
<path d="M39 53h24" stroke="{c('paper')}" stroke-width="5"/>''',
        "tilted": f'''<path d="M26 49 53 36l26 13-26 13z" fill="{c('violet')}"/>
<path d="M26 49 53 62v39L26 88z" fill="{c('violet')}"/>
<path d="M53 62 79 49v39l-26 13z" fill="{c('road')}"/>
<path d="M79 78h15v25h16" fill="none" stroke="{c('road')}" stroke-width="9" stroke-linejoin="round"/>
<path d="m35 66 10 5" stroke="{c('paper')}" stroke-width="5"/>''',
    },
    "sports-court": {
        "purpose": "Decorative neighbourhood sports court cue",
        "top": f'''<rect x="22" y="26" width="84" height="80" rx="3" fill="{c('green')}"/>
<rect x="29" y="33" width="70" height="66" fill="none" stroke="{c('paper')}" stroke-width="4"/>
<path d="M64 33v66" stroke="{c('paper')}" stroke-width="4"/>
<circle cx="64" cy="66" r="11" fill="none" stroke="{c('paper')}" stroke-width="4"/>''',
        "tilted": f'''<path d="M17 65 64 42l47 23-47 24z" fill="{c('green')}"/>
<path d="M17 65 64 89v18L17 83z" fill="{c('green_dark')}"/>
<path d="M64 89 111 65v18l-47 24z" fill="{c('green_dark')}"/>
<path d="m29 65 35-17 35 17-35 18zM64 48v35" fill="none" stroke="{c('paper')}" stroke-width="3"/>
<path d="m57 63 7-4 7 4-7 4z" fill="none" stroke="{c('paper')}" stroke-width="3"/>''',
    },
    "bus-stop": {
        "purpose": "Decorative bus stop shelter cue",
        "top": f'''<path d="M21 40h86v29H21z" fill="{c('teal')}"/>
<path d="M28 76h72v21H28z" fill="{c('walk')}"/>
<path d="M48 86h33" stroke="{c('road')}" stroke-width="7"/>''',
        "tilted": f'''<path d="M19 54 64 32l45 22-45 22z" fill="{c('teal')}"/>
<path d="M19 54 64 76v8L19 62z" fill="{c('road')}"/>
<path d="M64 76 109 54v8L64 84z" fill="{c('road')}"/>
<path d="M35 66v33m58-33v33" stroke="{c('road')}" stroke-width="6"/>
<path d="M47 98h37" stroke="{c('shade')}" stroke-width="8"/>''',
    },
    "lrt-station-track": {
        "purpose": "Decorative LRT station and short track cue; no route claim",
        "top": f'''<path d="M39 10v108m50-108v108" stroke="{c('road')}" stroke-width="7"/>
<path d="M16 34h96v44H16z" fill="{c('teal')}"/>
<path d="M46 84h36" stroke="{c('walk')}" stroke-width="10"/>''',
        "tilted": f'''<path d="m20 106 58-43m-46 52 58-43m8-17 12 25" fill="none" stroke="{c('road')}" stroke-width="6"/>
<path d="M19 72 65 48l44 22-45 24z" fill="{c('teal')}"/>
<path d="M19 72 64 94v8L19 80z" fill="{c('road')}"/>
<path d="M64 94 109 70v8l-45 24z" fill="{c('road')}"/>
<path d="M33 82v23m61-25v23" stroke="{c('road')}" stroke-width="5"/>''',
    },
}


def wrap(name: str, view: str, body: str) -> str:
    anchor = (64, 64) if view == "top" else (64, 112)
    label = name.replace("-", " ").title()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" '
            f'width="128" height="128" data-anchor-x="{anchor[0]}" '
            f'data-anchor-y="{anchor[1]}">\n'
            f'  <title>{label} — {view} view</title>\n'
            f'  <g>{body}</g>\n'
            f'</svg>\n')


def compact(source: str) -> str:
    return re.sub(r">\s+<", "><", source).replace("\n", "").strip() + "\n"


rows = []
for name, piece in PIECES.items():
    for view in ("top", "tilted"):
        filename = f"{name}-{view}.svg"
        source = wrap(name, view, piece[view])
        ElementTree.fromstring(source)
        (ROOT / filename).write_text(source, encoding="utf-8")
        exported = compact(source)
        ElementTree.fromstring(exported)
        (EXPORT / filename).write_text(exported, encoding="utf-8")
        rows.append({
            "filename": f"world/buildings/{filename}",
            "purpose": piece["purpose"],
            "view": view,
            "dimensions or viewBox": "0 0 128 128",
            "anchor point": "64,64" if view == "top" else "64,112",
            "source/creator": "Original project artwork; no third-party source",
            "license": "Project-owned; redistribution license not specified",
            "status": "final",
        })

with (ROOT / "ASSET-MANIFEST-buildings.csv").open("w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

print(f"Wrote {len(rows)} source SVGs, {len(rows)} exports and manifest to {ROOT}")
