# Progress

## Milestones (spec §66–72)

| # | Milestone | Status | Doc |
| --- | --- | --- | --- |
| 1 | Empty 3D world (renderer, curved surface, player, camera) | done | [m1](milestones/m1-empty-world.md) |
| 2 | Real Chattogram terrain (projection, DEM, coast, water) | mostly (water deferred) | [m2](milestones/m2-terrain.md) |
| 3 | Real roads (OSM import, intersections, bridges) | done (major roads) | [m3](milestones/m3-roads.md) |
| 4 | Buildings (footprints, heights, types, LOD) | in progress (spawn district) | [m4](milestones/m4-buildings.md) |
| 5 | Landmarks (labels, panel, interaction, learning) | done (spawn district) | [m5](milestones/m5-landmarks.md) |
| 6 | World streaming (chunks, LOD, instancing) | planned | — |
| 7 | Polish (materials, vegetation, fog, day/night, audio, UI) | in progress | [m7](milestones/m7-polish.md) |
| 8 | Quests & History Notebook | done (first quest) | [m8](milestones/m8-quests.md) |

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
| Building realism (windows, roofs, domes) | done |
| Named-building architecture detail | done (procedural) |
| Blender hero models for iconic landmarks | pending |
| Landmark interaction + info panel | done |
| Wikipedia/Wikidata enrichment | done |
| Minimap (§55, Canvas2D, names) | done |
| Vehicles (summon car/bicycle, ride) | done |
| Day/night cycle | done |
| Street props (poles, wires, trees) | done |
| Pedestrians (instanced) | done |
| Traffic (cars / CNG / rickshaws) | done |
| City ambience audio (hum, horns, birds) | done |
| Post-processing (GTAO, bloom, SMAA, tilt-shift) | done |
| Interactive map (click-to-travel, big map) | done |
| Quest + History Notebook | done (first quest) |
| Device geolocation spawn + tracking | done |
| Footstep audio (synthesized) | done |
| Ambient audio (city/birds/traffic) | pending |

## Legend

`planned` → `in progress` → `done`. Update on every meaningful change.
