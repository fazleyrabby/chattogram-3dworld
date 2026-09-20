# Milestone 2 — Real Chattogram Terrain

**Status:** mostly done (water/coastline deferred)
**Spec:** §67, §18–19, §22, §50

## Goal

Real elevation for the city, projected into the local frame, rendered as terrain.

## Done

- [x] DEM pipeline: `scripts/fetch-dem.ts` reads **Copernicus DEM GLO-30** COG over
  HTTP (pure JS `geotiff`) and resamples to a fixed metric grid.
- [x] Output: `public/world/chattogram/terrain/heightmap.f32` (float32le) +
  `metadata.json` (bounds, size, elevation range, attribution).
- [x] `TerrainHeightfield` loads + bilinear-samples the grid.
- [x] `Terrain` mesh draped with the curved surface (`surfaceHeight + elevation`),
  elevation-banded vertex colors.
- [x] `HeightProvider` combines curvature + DEM; player controller uses it.
- [x] Scope narrowed to **Chittagong city** (ADR-0007): 549×668 @ 30 m, 1.5 MB,
  elevation −0.95 m … 543.1 m.

## Deferred

- **Water / coastline.** A first attempt derived water from sea level, but
  Chattogram's coastal plain sits near 0 m, so it flooded large areas. Removed
  (it also caused z-fighting shimmer). Correct approach: **OSM water polygons**
  (`natural=water`, `waterway=riverbank`, `natural=bay`, coastline). Overpass
  times out on the full city bbox including coastline linestrings; use the
  Geofabrik PBF or sub-tiled queries.

## Notes

- Terrain is a single mesh; chunked/full-resolution meshes come with streaming
  (Milestone 6).
- Terrain triangles must be wound CCW (from above) or they are back-face culled
  — this was a bug fixed during M2.
