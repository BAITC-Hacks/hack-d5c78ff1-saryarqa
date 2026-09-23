# Implementation
Read DESIGN.md and design-contract.md here; edit styles.css and index.html. Keep scene/atlas.css geographic colors intact.
City selection must cancel stale loads and preserve Astana's plan. Other cities use their own sourced geometry and must not show Astana statistics.
Use public OSM geometry with source IDs, query bounds, timestamps and attribution. Avoid building caps; validate viewport rendering and main calculation on mobile and desktop.
