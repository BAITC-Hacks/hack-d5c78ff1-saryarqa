"""Build the seven lightweight, editable policy icon sets.

Run from the repository root. All geometry is original project artwork.
"""

from pathlib import Path
import csv
import shutil
import xml.etree.ElementTree as ET

SOURCE = Path('assets/sources/policies/M08-M14')
EXPORT = Path('assets/exports/policies/M08-M14')
EXPORT.mkdir(parents=True, exist_ok=True)

INK = '#203743'
CREAM = '#FFF8E9'
WHITE = '#FFFFFF'
CORAL = '#E46D58'
GREEN = '#58B879'
YELLOW = '#F3C659'
BLUE = '#4D9CB9'
RED = '#E45F58'

# The glyph occupies a 64 by 64 coordinate system and is reused inside the marker.
POLICIES = {
    'M08': ('family health centre', CORAL, '''
      <path d="M11 29h42v27H11Z" fill="#FFF8E9" stroke="#203743" stroke-width="3" stroke-linejoin="round"/>
      <path d="M16 29V17h32v12" fill="#FFF8E9" stroke="#203743" stroke-width="3"/>
      <path d="M29 19h6v6h6v6h-6v6h-6v-6h-6v-6h6Z" fill="#E45F58"/>
      <path d="M27 56V44h10v12" fill="#4D9CB9" stroke="#203743" stroke-width="2"/>'''),
    'M09': ('neighbourhood sports hub', GREEN, '''
      <rect x="8" y="15" width="48" height="40" rx="3" fill="#E46D58" stroke="#203743" stroke-width="3"/>
      <path d="M32 16v38M9 35h46M23 35a9 9 0 0 0 18 0 9 9 0 0 0-18 0" fill="none" stroke="#FFF8E9" stroke-width="2.5"/>
      <circle cx="32" cy="24" r="5" fill="#F3C659" stroke="#203743" stroke-width="2"/>'''),
    'M10': ('street lighting and cameras', YELLOW, '''
      <path d="M23 55V17q0-8 9-8h10" fill="none" stroke="#203743" stroke-width="4" stroke-linecap="round"/>
      <path d="M40 8h13v7q-1 6-7 6h-7Z" fill="#F3C659" stroke="#203743" stroke-width="3"/>
      <path d="m27 30 24 6-4 10-23-6Z" fill="#FFF8E9" stroke="#203743" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="44" cy="40" r="2" fill="#4D9CB9"/>
      <path d="M18 56h11" stroke="#203743" stroke-width="4" stroke-linecap="round"/>'''),
    'M11': ('safe crossing and school zone', YELLOW, '''
      <path d="M12 49h40" stroke="#203743" stroke-width="3"/>
      <path d="M14 42h8m4 0h8m4 0h8m4 0h3M14 53h8m4 0h8m4 0h8m4 0h3" stroke="#FFF8E9" stroke-width="5" stroke-linecap="round"/>
      <path d="M32 8 52 34H12Z" fill="#F3C659" stroke="#203743" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="32" cy="17" r="3" fill="#203743"/><path d="m32 21-3 7m3-5 6 4m-9 1-4 4m4-4 4 4" stroke="#203743" stroke-width="2.5" stroke-linecap="round"/>'''),
    'M12': ('digital citizen request platform', BLUE, '''
      <rect x="12" y="7" width="29" height="49" rx="5" fill="#FFF8E9" stroke="#203743" stroke-width="3"/>
      <path d="M20 13h13M23 50h7" stroke="#203743" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M31 24h22v19H41l-6 5v-5h-4Z" fill="#4D9CB9" stroke="#203743" stroke-width="3" stroke-linejoin="round"/>
      <path d="m37 33 4 4 7-8" fill="none" stroke="#FFF8E9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'''),
    'M13': ('heating and water network upgrade', BLUE, '''
      <rect x="10" y="14" width="44" height="14" rx="5" fill="#E45F58" stroke="#203743" stroke-width="3"/>
      <rect x="10" y="37" width="44" height="14" rx="5" fill="#4D9CB9" stroke="#203743" stroke-width="3"/>
      <path d="M16 12v18m32-18v18M16 35v18m32-18v18" stroke="#203743" stroke-width="3" stroke-linecap="round"/>'''),
    'M14': ('emergency utility crews and early warning', CORAL, '''
      <path d="M8 27h31l9 9h8v14H8Z" fill="#FFF8E9" stroke="#203743" stroke-width="3" stroke-linejoin="round"/>
      <path d="M39 28v9h10" fill="#4D9CB9" stroke="#203743" stroke-width="2"/>
      <path d="M9 43h46" stroke="#E45F58" stroke-width="4"/>
      <circle cx="19" cy="51" r="5" fill="#203743"/><circle cx="46" cy="51" r="5" fill="#203743"/>
      <path d="M21 26v-8h8v8" fill="#F3C659" stroke="#203743" stroke-width="2.5"/>
      <path d="M16 19 12 16m22 3 4-3" stroke="#F3C659" stroke-width="3" stroke-linecap="round"/>'''),
}

OBJECTS = {
    'M08': '''<path d="M24 66 78 43l51 22v37l-51 21-54-22Z" fill="#FFF8E9" stroke="#203743" stroke-width="3"/><path d="M19 65 78 37l56 27-56 23Z" fill="#E46D58" stroke="#203743" stroke-width="3"/><path d="M74 51h8v8h8v8h-8v8h-8v-8h-8v-8h8Z" fill="#FFF8E9"/><path d="M54 94v15m46-26v20" stroke="#4D9CB9" stroke-width="8"/>''',
    'M09': '''<path d="M17 80 89 48l57 26-72 32Z" fill="#E46D58" stroke="#203743" stroke-width="3"/><path d="m74 106 1-33m-57 7 56 26m15-58L75 73m71 1-71-1" stroke="#FFF8E9" stroke-width="2.5"/><circle cx="75" cy="73" r="10" fill="none" stroke="#FFF8E9" stroke-width="2.5"/><path d="M119 60V37h16v29" fill="none" stroke="#203743" stroke-width="3"/><path d="M119 40h16" stroke="#FFF8E9" stroke-width="3"/>''',
    'M10': '''<path d="M35 105V43q0-17 17-17h26" fill="none" stroke="#203743" stroke-width="6" stroke-linecap="round"/><path d="M76 22h28v11q-2 8-13 8H76Z" fill="#F3C659" stroke="#203743" stroke-width="3"/><path d="m44 55 40 10-7 16-37-10Z" fill="#FFF8E9" stroke="#203743" stroke-width="3"/><circle cx="72" cy="73" r="3" fill="#4D9CB9"/><path d="M26 106h19" stroke="#203743" stroke-width="5" stroke-linecap="round"/>''',
    'M11': '''<path d="M12 78 92 42l57 27-80 36Z" fill="#6D7981" stroke="#203743" stroke-width="3"/><path d="m36 75 29 14m-16-20 29 14m-16-20 29 14m-16-20 29 14" stroke="#FFF8E9" stroke-width="8"/><path d="M123 68V31" stroke="#203743" stroke-width="3"/><path d="m123 18 17 24h-34Z" fill="#F3C659" stroke="#203743" stroke-width="3"/>''',
    'M12': '''<path d="M52 98V36q0-8 8-8h38q8 0 8 8v62Z" fill="#4D9CB9" stroke="#203743" stroke-width="3"/><path d="M60 41h38v43H60Z" fill="#FFF8E9"/><path d="m67 63 10 9 17-20" fill="none" stroke="#58B879" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M70 92h18" stroke="#203743" stroke-width="3" stroke-linecap="round"/>''',
    'M13': '''<path d="M13 81 89 46l57 26-76 35Z" fill="#AE7B56" stroke="#203743" stroke-width="3"/><path d="m29 76 56-26 36 17-56 25Z" fill="#7E543F"/><path d="m34 75 58-26m-48 35 58-26" stroke="#E45F58" stroke-width="10" stroke-linecap="round"/><path d="m53 89 57-26m-47 34 57-26" stroke="#4D9CB9" stroke-width="10" stroke-linecap="round"/>''',
    'M14': '''<path d="M28 74h62l17 13h21v22H28Z" fill="#FFF8E9" stroke="#203743" stroke-width="3" stroke-linejoin="round"/><path d="m91 75 15 12H91Z" fill="#4D9CB9" stroke="#203743" stroke-width="2"/><path d="M30 99h96" stroke="#E45F58" stroke-width="6"/><circle cx="48" cy="108" r="8" fill="#203743"/><circle cx="106" cy="108" r="8" fill="#203743"/><path d="M57 73V58h17v15" fill="#F3C659" stroke="#203743" stroke-width="3"/><path d="m53 61-7-5m32 5 7-5" stroke="#F3C659" stroke-width="4" stroke-linecap="round"/>''',
}

def svg(viewbox, title, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" '
            f'aria-label="{title}"><title>{title}</title>{body}</svg>\n')

rows = []
for code, (name, color, glyph) in POLICIES.items():
    variants = {
        'ui-icon': ('0 0 64 64', 'both', '32,32',
            f'<rect x="2" y="2" width="60" height="60" rx="14" fill="{color}"/>{glyph}'),
        'world-marker': ('0 0 64 80', 'both', '32,77',
            f'<path d="M32 3C17 3 5 15 5 30c0 19 20 39 27 47 7-8 27-28 27-47C59 15 47 3 32 3Z" fill="{color}" stroke="{INK}" stroke-width="2"/>'
            f'<circle cx="32" cy="30" r="23" fill="{CREAM}"/><g transform="translate(14 12) scale(.56)">{glyph}</g>'),
        'tilted-object': ('0 0 160 128', 'tilted', '80,118',
            f'<path d="M14 91 77 121l71-31v7l-71 31-63-30Z" fill="#A79B84" opacity=".5"/>'
            f'<path d="M12 87 86 54l62 28-71 35Z" fill="#BCD993" stroke="{INK}" stroke-width="2"/>{OBJECTS[code]}'),
    }
    for variant, (viewbox, view, anchor, body) in variants.items():
        filename = f'{code}-{variant}.svg'
        title = f'{code} {name} {variant.replace("-", " ")}'
        content = svg(viewbox, title, body)
        ET.fromstring(content)
        source_path = SOURCE / filename
        export_path = EXPORT / filename
        source_path.write_text(content, encoding='utf-8')
        shutil.copyfile(source_path, export_path)
        rows.append({
            'filename': str(export_path).replace('\\', '/'),
            'purpose': f'{code} {name} {variant}',
            'view': view,
            'dimensions or viewBox': viewbox,
            'anchor point': anchor,
            'source/creator': 'Project-owned original artwork; Codex',
            'license': 'Project-owned; redistribution license not specified',
            'status': 'final',
        })

with (SOURCE / 'ASSET-MANIFEST.csv').open('w', encoding='utf-8-sig', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

print(f'Built {len(rows)} SVGs and manifest.')
