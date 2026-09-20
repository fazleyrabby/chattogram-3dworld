# Progress

## Milestones (spec §66–72)

| # | Milestone | Status | Doc |
| --- | --- | --- | --- |
| 1 | Empty 3D world (renderer, curved surface, player, camera) | done | [m1](milestones/m1-empty-world.md) |
| 2 | Real Chattogram terrain (projection, DEM, coast, water) | mostly (water deferred) | [m2](milestones/m2-terrain.md) |
| 3 | Real roads (OSM import, intersections, bridges) | done (major roads) | [m3](milestones/m3-roads.md) |
| 4 | Buildings (footprints, heights, types, LOD) | in progress (spawn district) | [m4](milestones/m4-buildings.md) |
| 5 | Landmarks (10–20, labels, panel, interaction) | planned | — |
| 6 | World streaming (chunks, LOD, instancing) | planned | — |
| 7 | Polish (materials, vegetation, fog, day/night, audio, UI) | planned | — |

## Cross-cutting

| Item | Status |
| --- | --- |
| Spec: minimap promoted to MVP (§55) | done |
| Spec: educational layer added (§33a) | done |
| Docs folder + ADRs | done |
| Verified data sources | done |
| Project scaffold (Vite + TS strict + Three) | done |
| Git repo initialized + remote set | done |
| DEM pipeline (Copernicus GLO-30) | done |
| Roads pipeline (OSM major roads) | done |
| Avatar authored in Blender (GLB) | done |
| Water / coastline (OSM polygons) | pending |
| Buildings (OSM footprints + LOD) | spawn district done; city-wide pending |
| Named-building world labels | done |
| Footstep audio (synthesized) | done |
| Ambient audio (city/birds/traffic) | pending |

## Legend

`planned` → `in progress` → `done`. Update on every meaningful change.
