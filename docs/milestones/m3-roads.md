# Milestone 3 — Real Roads

**Status:** done (major roads)
**Spec:** §68, §10–11, §50

## Goal

Chattogram's major roads, in their geographically correct locations, rendered as
3D geometry.

## Done

- [x] `scripts/fetch-roads.ts` pulls `highway = motorway|trunk|primary|secondary|tertiary`
  from OSM (Overpass, via `scripts/lib/osm.ts`) and writes them **already projected**
  into local world coordinates: `public/world/chattogram/roads/roads.json`.
- [x] **913 ways** (secondary 241, trunk 252, tertiary 231, primary 189), 599 named.
- [x] Rendering defaults per type (spec §10): motorway 17, trunk 15, primary 13,
  secondary 10, tertiary 8 m.
- [x] `Roads` builds merged ribbon meshes (one asphalt + one center-line mesh) for
  low draw calls (§38), draped on terrain via `HeightProvider`.
- [x] Bridges flagged (`bridge`), tunnels flagged (`tunnel`) for later geometry.

## Fixes / decisions

- Roads sit almost flush with terrain (`SURFACE_OFFSET = 0.05`) plus polygon
  offset. An earlier 0.4 m offset made the avatar appear to sink into roads.
- Center lines are offset above the asphalt to avoid z-fighting.
- Residential/service roads are excluded for MVP (§9) — blocks look sparse until
  buildings (M4) fill them in.

## Not yet

- Sidewalks, curbs, intersections, bridge elevation (spec §11, §68).
