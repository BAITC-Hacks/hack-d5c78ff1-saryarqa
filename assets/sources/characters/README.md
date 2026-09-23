# Character sprites — rounded miniature style (approved option A)

The six `*-source.png` files are the original transparent 2 × 2 raster pose sheets.
`build_sprites.py` slices them into lightweight game exports in
`assets/exports/characters/`. Source sheets are kept untouched for revision.

## Runtime format

- One `*-sheet.png` per character: 512 × 128 px, four horizontal frames of
  128 × 128 px each, from left to right.
- One `*-still.png` per character: 128 × 128 px. Use this in reduced-motion mode.
- All files have RGBA transparency. Frame anchor is **(64, 124)**, measured from
  the top-left of each 128 × 128 frame. Place the anchor on the intended ground
  point. No baked ground shadow is present.
- All sprites show a three-quarter front view suitable for the tilted miniature
  map. The same sprites may be used as upright decorative markers in top-down
  mode; they do not represent a roof-view rendering.
- Faces and clothing silhouettes are designed to read at roughly 48–96 CSS px.

| File prefix | Frame 0 | Frame 1 | Frame 2 | Frame 3 |
| --- | --- | --- | --- | --- |
| `mayor` | idle | selecting | thinking | celebrating |
| `citizen-01` | idle | walk | positive | concerned |
| `citizen-02` | idle | walk | positive | concerned |
| `citizen-03` | idle | walk | positive | concerned |
| `maintenance` | idle | walk | active | alert |
| `emergency` | idle | walk | active | alert |

For lightweight walking motion, alternate frame 0 and frame 1 with a short
position change. Reaction frames are visual feedback only; no score or
numeric outcome is embedded in the art. In reduced-motion mode, render the
`*-still.png` image without frame cycling or transform animation.

## Rebuild

```powershell
python assets/sources/characters/build_sprites.py
```

Requires Python 3 and Pillow. The build script writes the character asset manifest at
`assets/exports/characters/ASSET-MANIFEST.csv`.

License for this project asset set: **Project-owned; redistribution license not
specified**. Do not label these generated characters as CC0.
