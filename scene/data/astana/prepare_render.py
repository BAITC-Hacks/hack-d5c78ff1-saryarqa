#!/usr/bin/env python3
"""Produce conservative, dependency-free render copies of Astana polygons.

Run from any directory: python3 scene/data/astana/prepare_render.py
Source files are never modified. Only simple, single-ring Polygon features are
simplified; polygons with holes and all MultiPolygons retain their exact source
coordinates. This deliberately favors preserving topology over maximum savings.
"""

import argparse
import copy
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent


def point_segment_distance(point, start, end):
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = dx * dx + dy * dy
    t = max(0, min(1, ((point[0] - start[0]) * dx +
                       (point[1] - start[1]) * dy) / length)) if length else 0
    return math.hypot(point[0] - start[0] - t * dx,
                      point[1] - start[1] - t * dy)


def orientation(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def intersects(a, b, c, d):
    """Inclusive intersection, with coordinates in projected local meters."""
    if (max(a[0], b[0]) < min(c[0], d[0]) or
            max(c[0], d[0]) < min(a[0], b[0]) or
            max(a[1], b[1]) < min(c[1], d[1]) or
            max(c[1], d[1]) < min(a[1], b[1])):
        return False
    return (orientation(a, b, c) * orientation(a, b, d) <= 0 and
            orientation(c, d, a) * orientation(c, d, b) <= 0)


def is_simple(points):
    """Sweep bounding boxes, rejecting nonadjacent crossings/touches."""
    count = len(points) - 1
    for i in range(count):
        a, b, c = points[(i - 1) % count], points[i], points[(i + 1) % count]
        if (abs(orientation(a, b, c)) < 1e-9 and
                (a[0] - b[0]) * (c[0] - b[0]) +
                (a[1] - b[1]) * (c[1] - b[1]) > 0):
            return False
    segments = sorted((min(a[0], b[0]), max(a[0], b[0]), i, a, b)
                      for i, (a, b) in enumerate(zip(points, points[1:])))
    active = []
    for left, right, index, a, b in segments:
        if a == b:
            return False
        active = [s for s in active if s[0] >= left]
        for _, other, c, d in active:
            if abs(index - other) in (1, count - 1):
                continue
            if intersects(a, b, c, d):
                return False
        active.append((right, index, a, b))
    return True


def signed_area(points):
    return sum(a[0] * b[1] - b[0] * a[1]
               for a, b in zip(points, points[1:])) / 2


def simplify_ring(ring, tolerance):
    if len(ring) < 6 or ring[0] != ring[-1]:
        return ring, 0.0
    # At Astana latitudes these scale factors conservatively bound ground
    # distances. Keeping extrema also preserves the exact original bbox.
    lat_scale = 111_700.0
    lon_scale = 111_700.0 * math.cos(math.radians(min(p[1] for p in ring)))
    origin = ring[0]
    points = [((p[0] - origin[0]) * lon_scale,
               (p[1] - origin[1]) * lat_scale) for p in ring]
    anchors = {0, len(ring) - 1}
    for axis in (0, 1):
        anchors.add(min(range(len(ring) - 1), key=lambda i: ring[i][axis]))
        anchors.add(max(range(len(ring) - 1), key=lambda i: ring[i][axis]))
    keep = set(anchors)
    anchors = sorted(anchors)
    stack = list(zip(anchors, anchors[1:]))
    while stack:
        start, end = stack.pop()
        if end - start <= 1:
            continue
        distance, index = max((point_segment_distance(points[i], points[start], points[end]), i)
                              for i in range(start + 1, end))
        if distance > tolerance:
            keep.add(index)
            stack.extend(((start, index), (index, end)))
    indices = sorted(keep)
    candidate = [points[i] for i in indices]
    if (len(candidate) < 4 or signed_area(points) * signed_area(candidate) <= 0 or
            not is_simple(candidate)):
        return ring, 0.0
    # Validate every removed vertex against its actual replacement segment,
    # not a nearby unrelated segment. All intervening source edges therefore
    # remain in the same tolerance corridor by convexity.
    error = max((point_segment_distance(points[i], points[a], points[b])
                 for a, b in zip(indices, indices[1:])
                 for i in range(a + 1, b)), default=0.0)
    assert error <= tolerance + 1e-8
    return [ring[i] for i in indices], error


def vertices(value):
    if not value:
        return 0
    if isinstance(value[0], (float, int)):
        return 1
    return sum(vertices(child) for child in value)


def bbox(value):
    if isinstance(value[0], (float, int)):
        return value[0], value[1], value[0], value[1]
    bounds = [bbox(child) for child in value]
    return (min(b[0] for b in bounds), min(b[1] for b in bounds),
            max(b[2] for b in bounds), max(b[3] for b in bounds))


def prepare(name, tolerance):
    source_path = HERE / (name + '.geojson')
    output_path = HERE / (name + '-render.geojson')
    source = json.loads(source_path.read_text())
    output = copy.deepcopy(source)
    before = after = changed = 0
    max_error = 0.0
    for original, feature in zip(source['features'], output['features']):
        geometry = feature['geometry']
        coordinates = geometry['coordinates']
        before += vertices(coordinates)
        if geometry['type'] == 'Polygon' and len(coordinates) == 1:
            ring, error = simplify_ring(coordinates[0], tolerance)
            changed += ring != coordinates[0]
            geometry['coordinates'] = [ring]
            max_error = max(max_error, error)
        after += vertices(geometry['coordinates'])
        assert bbox(original['geometry']['coordinates']) == bbox(geometry['coordinates'])
        assert feature['properties'] == original['properties']
        assert feature.get('id') == original.get('id')
    output.setdefault('metadata', {})['renderPreparation'] = {
        'sourceFile': source_path.name,
        'geometryStatus': 'visual-simplification',
        'method': 'Ramer-Douglas-Peucker, local conservative meter projection',
        'toleranceMeters': tolerance,
        'maxMeasuredErrorMeters': round(max_error, 8),
        'sourceVertices': before,
        'renderVertices': after,
        'simplifiedFeatures': changed,
        'featureCount': len(output['features']),
        'topologyPolicy': 'Only single-ring Polygons simplified. Holes and MultiPolygons unchanged. Closed rings, winding, extrema and non-self-intersection verified.',
        'note': 'Visual derivative, not survey geometry. Original source files and attribution retained. No features removed; no invented coordinates. Cross-feature shared-boundary topology is not generalized jointly.'
    }
    output_path.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    # Round-trip verification catches serialization mistakes and accidental loss.
    loaded = json.loads(output_path.read_text())
    assert len(loaded['features']) == len(source['features'])
    assert [f.get('id') for f in loaded['features']] == [f.get('id') for f in source['features']]
    print(f'{name}: {before:,} -> {after:,} vertices; '
          f'{source_path.stat().st_size:,} -> {output_path.stat().st_size:,} bytes; '
          f'{changed:,} simplified features; max error {max_error:.6f} m')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tolerance', type=float, default=0.65,
                        help='Render simplification tolerance in meters (default: 0.65, must be below 1).')
    args = parser.parse_args()
    if not 0 < args.tolerance < 1:
        parser.error('tolerance must be greater than zero and less than one meter')
    for name in ('landscape', 'buildings'):
        prepare(name, args.tolerance)


if __name__ == '__main__':
    main()
