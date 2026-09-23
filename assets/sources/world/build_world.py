"""Build the editable miniature world SVGs and compact game exports.

The top and tilted surface layers share an exact affine footprint.  A tile's
top (x, y) maps to tilted (160 + (x-y)*146/256, 16 + (x+y)*66/256).
"""

from __future__ import annotations

import csv
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path


HERE = Path(__file__).resolve().parent
EXPORTS = HERE.parent.parent / "exports" / "world"
EXPORTS.mkdir(parents=True, exist_ok=True)

INK = "#314b4c"
GRASS = "#4f9c79"
GRASS_LIGHT = "#82bd85"
TERRAIN = "#cba674"
STONE = "#e8dcc3"
ROAD = "#56676a"
ROAD_EDGE = "#c9b38a"
WATER = "#299cc0"

TILE_NAMES = [
    "ground-terrain", "ground-grass", "paved-plaza", "sidewalk",
    "road-straight", "road-corner", "road-intersection", "bus-lane",
    "crosswalk", "river-water", "river-edge", "bridge", "park",
]
OBJECT_NAMES = [
    "tree-01", "tree-02", "tree-03", "shrub-01", "shrub-02",
    "bench", "streetlight", "shadow-canopy", "shadow-furniture",
]


def shape(tag: str, **attrs: str) -> str:
    return f"<{tag} " + " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in attrs.items()) + "/>"


def tile_surface(name: str) -> str:
    if name == "ground-terrain":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill=TERRAIN)
            + '<path d="M35 45h17m51 41h12m62-47h19m-160 139h20m77 35h18m60-41h15" stroke="#e2bf8e" stroke-width="4" stroke-linecap="round" opacity=".72"/>'
            + '<circle cx="66" cy="159" r="5" fill="#a88358"/><circle cx="187" cy="123" r="4" fill="#a88358"/>'
        )
    if name == "ground-grass":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill=GRASS)
            + '<path d="M21 33l5-10 5 10m54 18 4-8 4 8m73-19 6-11 6 11m47 30 4-7 4 7M37 127l5-9 5 9m85 18 5-10 5 10m75-6 5-10 5 10M67 212l5-10 5 10m82-8 5-9 5 9m55 21 5-10 5 10" fill="none" stroke="#286b59" stroke-width="3" stroke-linecap="round" opacity=".55"/>'
            + '<circle cx="115" cy="57" r="5" fill="#b6d18a"/><circle cx="192" cy="193" r="4" fill="#b6d18a"/>'
        )
    if name == "paved-plaza":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill=STONE)
            + '<path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="#bcae98" stroke-width="2"/>'
            + '<path d="M64 64h64v64H64zm64 64h64v64h-64z" fill="#d9c9af" opacity=".65"/>'
        )
    if name == "sidewalk":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill="#d9c9ae")
            + '<path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="#b5a88f" stroke-width="2"/>'
            + '<path d="M0 235h256" stroke="#f7ecd1" stroke-width="12"/>'
        )
    if name in {"road-straight", "bus-lane", "crosswalk"}:
        base = (
            shape("rect", x="0", y="0", width="256", height="256", fill="#d2c6ab")
            + '<path d="M0 76h256v104H0z" fill="#b9a98e"/>'
            + f'<path d="M0 88h256v80H0z" fill="{ROAD}"/>'
            + '<path d="M0 80h256M0 176h256" stroke="#f5e8c8" stroke-width="8"/>'
        )
        if name == "road-straight":
            base += '<path d="M8 128h44m30 0h44m30 0h44m30 0h18" stroke="#fff3d8" stroke-width="4" stroke-linecap="round"/>'
        elif name == "bus-lane":
            base += '<path d="M0 91h256v34H0z" fill="#c96c5c"/><path d="M0 125h256" stroke="#fff1d7" stroke-width="4"/><path d="M24 108h38m52 0h38m52 0h28" stroke="#ffe8c9" stroke-width="4" stroke-linecap="round"/>'
            base += '<path d="M125 132h32m-22-10 10 10-10 10" fill="none" stroke="#ffe8c9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
        else:
            base += '<path d="M104 92v72m14-72v72m14-72v72m14-72v72" stroke="#fff8e7" stroke-width="8" stroke-linecap="butt"/>'
        return base
    if name == "road-corner":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill="#d2c6ab")
            + '<path d="M0 76h100V0h76v176H0z" fill="#b9a98e"/>'
            + f'<path d="M0 88h88V0h80v168H0z" fill="{ROAD}"/>'
            + '<path d="M0 80h96V0M0 176h176V0" fill="none" stroke="#f5e8c8" stroke-width="8"/>'
            + '<path d="M14 128h48q66 0 66-66V13" fill="none" stroke="#fff3d8" stroke-width="4" stroke-dasharray="36 22" stroke-linecap="round"/>'
        )
    if name == "road-intersection":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill="#d2c6ab")
            + '<path d="M0 76h256v104H0zM76 0h104v256H76z" fill="#b9a98e"/>'
            + f'<path d="M0 88h256v80H0zM88 0h80v256H88z" fill="{ROAD}"/>'
            + '<path d="M0 80h80V0m96 0v80h80M0 176h80v80m96 0v-80h80" fill="none" stroke="#f5e8c8" stroke-width="8"/>'
            + '<path d="M0 128h54m148 0h54M128 0v54m0 148v54" stroke="#fff3d8" stroke-width="4" stroke-dasharray="24 16"/>'
        )
    if name == "river-water":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill=WATER)
            + '<path d="M21 53q26-8 52 0m61 20q31-7 56 0m-145 62q32-8 64 0m75 25q24-7 45 0M25 214q21-7 43 0m90-3q31-7 59 0" fill="none" stroke="#a1e2e2" stroke-width="4" stroke-linecap="round" opacity=".65"/>'
        )
    if name == "river-edge":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill=WATER)
            + f'<path d="M0 0h256v122q-35 8-64 0t-64 0-64 0-64 0Z" fill="{GRASS}"/>'
            + '<path d="M0 122q35-8 64 0t64 0 64 0 64 0" fill="none" stroke="#e2c996" stroke-width="10"/>'
            + '<path d="M20 169q25-5 45 0m111 31q26-5 47 0" fill="none" stroke="#a1e2e2" stroke-width="4" stroke-linecap="round"/>'
        )
    if name == "bridge":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill=WATER)
            + '<path d="M24 41q25-6 49 0m110 164q26-6 49 0" fill="none" stroke="#a1e2e2" stroke-width="4" stroke-linecap="round"/>'
            + '<path d="M71 0h114v256H71z" fill="#227b96" opacity=".38"/>'
            + '<path d="M76 0h104v256H76z" fill="#d9c7a5"/>'
            + f'<path d="M88 0h80v256H88z" fill="{ROAD}"/>'
            + '<path d="M77 0v256M179 0v256" stroke="#f7e8c6" stroke-width="6"/>'
            + '<path d="M128 8v40m0 30v40m0 30v40m0 30v30" stroke="#fff3d8" stroke-width="4"/>'
            + '<path d="M72 26h8m96 0h8M72 90h8m96 0h8M72 154h8m96 0h8M72 218h8m96 0h8" stroke="#715e4e" stroke-width="8"/>'
        )
    if name == "park":
        return (
            shape("rect", x="0", y="0", width="256", height="256", fill=GRASS)
            + '<path d="M-5 207q99-19 129-80T267 45" fill="none" stroke="#e8dcc3" stroke-width="28"/>'
            + '<path d="M-5 207q99-19 129-80T267 45" fill="none" stroke="#c8b592" stroke-width="2" stroke-dasharray="10 16"/>'
            + '<circle cx="50" cy="63" r="31" fill="#2f795f"/><circle cx="52" cy="58" r="26" fill="#8ec46b"/>'
            + '<circle cx="204" cy="191" r="28" fill="#2f795f"/><circle cx="206" cy="185" r="23" fill="#97c968"/>'
            + '<circle cx="91" cy="192" r="13" fill="#3d8c68"/><circle cx="184" cy="66" r="11" fill="#5eaa68"/>'
            + '<path d="M125 37l3-7 3 7m99 69 3-7 3 7M25 142l3-7 3 7" fill="none" stroke="#d3df8b" stroke-width="3" stroke-linecap="round"/>'
        )
    raise ValueError(name)


def object_draw(name: str, tilted: bool) -> str:
    if name.startswith("shadow-"):
        if tilted:
            rx, ry = (56, 14) if name == "shadow-canopy" else (39, 10)
            return f'<ellipse cx="174" cy="175" rx="{rx}" ry="{ry}" fill="#233b39" opacity=".2"/>'
        r = 64 if name == "shadow-canopy" else 35
        return f'<circle cx="139" cy="139" r="{r}" fill="#233b39" opacity=".17"/>'
    if name.startswith("tree-"):
        n = int(name[-2:])
        if tilted:
            if n == 1:
                return '<path d="M156 102h9l8 74h-22z" fill="#805b3f"/><path d="M160 35q-39 0-44 37-35 7-31 36 8 30 40 26 12 19 35 16 25 1 36-17 35 2 40-28-2-30-32-34-6-36-44-36Z" fill="#317b5b"/><path d="M149 42q-37 3-32 35-29 10-24 34 6 22 32 17 14 18 36 13 19 0 31-17 31 1 33-22-2-21-29-25-4-32-47-35Z" fill="#8fc869"/><circle cx="119" cy="91" r="5" fill="#b5d783"/><circle cx="177" cy="61" r="5" fill="#b5d783"/>'
            if n == 2:
                return '<path d="M156 133h9l6 43h-20z" fill="#805b3f"/><path d="M160 18 99 151h122Z" fill="#1d695a"/><path d="M160 23 113 137h94Z" fill="#4c9b65"/><path d="M160 49 126 119h68Z" fill="#80bd72"/>'
            return '<path d="M156 126h9l8 50h-22z" fill="#805b3f"/><ellipse cx="159" cy="116" rx="50" ry="39" fill="#2d795d"/><ellipse cx="158" cy="79" rx="48" ry="40" fill="#4f9f69"/><ellipse cx="160" cy="52" rx="34" ry="27" fill="#a2cd72"/><circle cx="135" cy="79" r="5" fill="#c3df8a"/>'
        if n == 1:
            return '<circle cx="128" cy="128" r="75" fill="#2c735a"/><circle cx="124" cy="119" r="67" fill="#8fc869"/><circle cx="91" cy="103" r="26" fill="#a8d47a"/><circle cx="158" cy="91" r="29" fill="#a9d579"/><circle cx="151" cy="150" r="32" fill="#79ba68"/>'
        if n == 2:
            return '<circle cx="128" cy="128" r="69" fill="#1d695a"/><path d="M128 50 68 145l60 52 60-52Z" fill="#4c9b65"/><path d="M128 73 85 142l43 38 43-38Z" fill="#82c174"/>'
        return '<circle cx="128" cy="128" r="72" fill="#2b765c"/><circle cx="112" cy="113" r="47" fill="#85bf6a"/><circle cx="156" cy="112" r="43" fill="#a2ce72"/><circle cx="135" cy="153" r="42" fill="#59a769"/>'
    if name.startswith("shrub-"):
        n = int(name[-2:])
        if tilted:
            return ('<ellipse cx="158" cy="157" rx="62" ry="24" fill="#2d7859"/><circle cx="115" cy="134" r="22" fill="#6aaf65"/><circle cx="148" cy="115" r="29" fill="#93c96a"/><circle cx="185" cy="132" r="25" fill="#4c9b64"/><circle cx="210" cy="145" r="16" fill="#8ac469"/>' if n == 1 else '<ellipse cx="160" cy="159" rx="52" ry="21" fill="#2c765a"/><circle cx="128" cy="139" r="22" fill="#a2cc6f"/><circle cx="158" cy="120" r="26" fill="#5aa565"/><circle cx="188" cy="141" r="21" fill="#84bf6c"/>')
        return ('<circle cx="91" cy="133" r="35" fill="#4b9b65"/><circle cx="132" cy="101" r="42" fill="#91c76b"/><circle cx="170" cy="142" r="37" fill="#3d9064"/>' if n == 1 else '<circle cx="105" cy="136" r="39" fill="#a0cb6e"/><circle cx="152" cy="111" r="42" fill="#61a968"/><circle cx="174" cy="147" r="28" fill="#82bd6c"/>')
    if name == "bench":
        if tilted:
            return '<path d="M82 117 156 91l82 34-75 29Z" fill="#8d6043"/><path d="m82 117 81 37v12l-81-37zm81 37 75-29v12l-75 29Z" fill="#634733"/><path d="M99 130v43m119-36v37m-61-13v28" stroke="#344c4c" stroke-width="8" stroke-linecap="round"/><path d="M82 92 157 66l82 34-76 28Z" fill="#b78050"/><path d="m82 92 81 36m-62-25 80 35m-62-25 80 35" stroke="#e2ae72" stroke-width="4"/>'
        return '<path d="M54 76h148v35H54zM54 129h148v37H54z" fill="#a66f49" stroke="#6c4b35" stroke-width="5"/><path d="M71 83h114m-114 54h114" stroke="#ddb17c" stroke-width="5"/><path d="M67 60v136m122-136v136" stroke="#344c4c" stroke-width="8"/>'
    if name == "streetlight":
        if tilted:
            return '<path d="M152 171h24" stroke="#334c4b" stroke-width="9" stroke-linecap="round"/><path d="M164 170V50q0-10 12-10h19" fill="none" stroke="#344c4c" stroke-width="8" stroke-linecap="round"/><path d="M190 37h25l-5 18h-15Z" fill="#fae6ad" stroke="#344c4c" stroke-width="5"/><path d="M161 72h6" stroke="#779b8b" stroke-width="6"/>'
        return '<circle cx="128" cy="128" r="29" fill="#344c4c"/><circle cx="128" cy="128" r="21" fill="#f7e3a9"/><circle cx="128" cy="128" r="11" fill="#fff4d2"/><path d="M99 128H72" stroke="#344c4c" stroke-width="8" stroke-linecap="round"/>'
    raise ValueError(name)


def document(name: str, view: str, art: str, is_tile: bool) -> str:
    tilted = view == "tilted"
    w, h = (320, 218) if tilted else (256, 256)
    title = name.replace("-", " ").title() + (" — tilted 2.5D" if tilted else " — top-down")
    if is_tile and tilted:
        art = (
            '<path d="M14 82 160 148 306 82v20L160 168 14 102Z" fill="#947b61"/>'
            '<path d="M160 148 306 82v20l-146 66Z" fill="#806b55"/>'
            '<g transform="matrix(0.5703125 0.2578125 -0.5703125 0.2578125 160 16)">'
            + art + '</g>'
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
        f'  <title>{title}</title>\n'
        f'  <desc>Editable miniature game asset. Anchor: {"centre of top surface" if is_tile else "bottom centre for tilted view; centre for top view"}. No geographic claim.</desc>\n'
        f'  {art}\n</svg>\n'
    )


def main() -> None:
    rows = []
    for name in TILE_NAMES + OBJECT_NAMES:
        is_tile = name in TILE_NAMES
        for view in ("top", "tilted"):
            art = tile_surface(name) if is_tile else object_draw(name, view == "tilted")
            xml = document(name, view, art, is_tile)
            source = HERE / f"{name}-{view}.svg"
            source.write_text(xml, encoding="utf-8")
            ET.parse(source)
            compact = re.sub(r">\s+<", "><", xml).replace("\n", "")
            export = EXPORTS / source.name
            export.write_text(compact, encoding="utf-8")
            ET.parse(export)
            rows.append({
                "filename": str(export.relative_to(HERE.parent.parent.parent)).replace("\\", "/"),
                "purpose": name,
                "view": view,
                "dimensions_or_viewBox": "0 0 320 218" if view == "tilted" else "0 0 256 256",
                "anchor_point": "160,148 surface; 160,168 base" if is_tile and view == "tilted" else "128,128" if view == "top" else "160,176",
                "source_creator": "Original SVG by Codex; source: assets/sources/world/" + source.name,
                "license": "Project-owned; redistribution license not specified",
                "status": "final",
            })
    with (HERE / "ASSET-MANIFEST-world.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Built {len(rows)} SVG source/export pairs and manifest")


if __name__ == "__main__":
    main()
