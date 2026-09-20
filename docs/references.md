# References

Single canonical page for all external reference data, tools, links, and
licenses used by this project. Keep project **decisions** in
[`decisions.md`](decisions.md) and **progress** in [`progress.md`](progress.md);
keep raw facts about the outside world here.

> `spec.md` is the private design source of truth. It is intentionally **kept
> locally and excluded from git** (see `.gitignore`).

---

## Geospatial data sources

### OpenStreetMap (primary geography) — ODbL

| Item | Reference |
| --- | --- |
| Main site | https://www.openstreetmap.org |
| License | ODbL — requires attribution |
| Copyright | https://www.openstreetmap.org/copyright |
| 3D building tags | `height`, `building:levels`, `building:part`, `roof:shape`, `roof:height`, `building:material`, `building:colour` |

**Extract (use for the offline build):**

- Geofabrik Bangladesh PBF — https://download.geofabrik.de/asia/bangladesh-latest.osm.pbf
  - Verified reachable; redirects to a dated snapshot (e.g. `bangladesh-260919.osm.pbf`).

**OSM API `map` endpoint (small bboxes — used for building footprints):**

- `https://api.openstreetmap.org/api/0.6/map?bbox=west,south,east,north`
- Reliable for local areas; limited to ≤0.25 deg² and ~50k nodes per call.
- Used by `scripts/fetch-buildings.ts` (tiled 0.005° over the spawn district).

**Overpass API (ad-hoc queries only — NOT in the build path):**

- Endpoint — https://overpass-api.de/api/interpreter
- Mirrors — https://overpass.kumi.systems/api/interpreter, https://overpass.private.coffee/api/interpreter
- Requires a `User-Agent` header (otherwise `406 Not Acceptable`).
- Public server is rate-limited/busy: heavy queries fail with `rate_limited`/`timeout`.

**Verified counts for Chattogram:**

| Query | Bbox (S, W, N, E) | Result |
| --- | --- | --- |
| `building=*` | 22.32, 91.80, 22.37, 91.85 (~28.6 km²) | 70,135 ways |
| `historic=*` | 22.15, 91.65, 22.45, 91.95 | 44 features |
| `tourism=*` | 22.15, 91.65, 22.45, 91.95 | 285 features |

**Sample historical features:** Cheragi Pahar (Q15209425), Anderkilla,
Chattogram Central Shaheed Minar, Chittagong Commonwealth War Cemetery Memorial,
Central Railway Building, Reboti Mohan Statue, Bijoy Uddan monument.

### Elevation — Copernicus DEM GLO-30

- Bucket — https://copernicus-dem-30m.s3.amazonaws.com
- Tile pattern — `Copernicus_DSM_COG_10_N{lat}_00_E{lon}_00_DEM/{...}.tif`
- Chattogram tile — `Copernicus_DSM_COG_10_N22_00_E091_00_DEM` (verified, ~33 MB, `image/tiff`)
- License/attribution — "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved."
- Alternatives — SRTM 1-arcsec, ALOS AW3D30

### Wikipedia / Wikidata / Wikimedia Commons — CC BY-SA

- Wikipedia geosearch (10 km around 22.3569, 91.7832) returns ~40 geotagged articles
  (Foy's Lake, Chittagong Zoo, Batali Hill, District Stadium, Chittagong Club,
  Jamiatul Falah Mosque, …).
- Use for landmark summaries, coordinates, and "Learn more" links (educational
  layer, spec §33a). Attribution required.
- OSM `wikidata` / `wikipedia` / `wikimedia_commons` tags bridge OSM and Wikidata.

### Banglapedia

- https://en.banglapedia.org — national encyclopedia; local historical context.
  Verify license before embedding excerpts; prefer linking.

---

## Chattogram reference geometry

| Item | Value |
| --- | --- |
| Country | Bangladesh |
| Approx. city center | 22.3569 N, 91.7832 E |
| Project origin / spawn | 22.3437 N, 91.8336 E (Cheragi Pahar area) |
| MVP corridor bounds (S, W, N, E) | 22.15, 91.65, 22.45, 91.95 |
| Corridor span | ~33.4 km (N–S) × ~30.9 km (E–W) |
| City Corporation area (for scale) | ~160 km² → est. 200k–400k buildings |

---

## Software, libraries, tools

### Runtime stack

| Tool | Version | Role |
| --- | --- | --- |
| Node.js | v26 | build + scripts |
| TypeScript | ^5.7 (strict) | all source |
| Vite | ^7 | dev server + bundler |
| Three.js | ^0.180 | WebGL2 rendering |

### Build / data tooling

| Tool | Role |
| --- | --- |
| `tsx` | run TypeScript world-generator scripts |
| `geotiff` | read Copernicus GLO-30 COG over HTTP (pure JS) |
| `@types/node` | Node types for build config/scripts |
| `proj4` (planned) | EPSG transforms if the local projection is replaced |
| `@dimforge/rapier3d-compat` (planned) | physics, spec §48 |

### Local MCP tooling

| Tool | Endpoint | Role |
| --- | --- | --- |
| Blender MCP | `127.0.0.1:9876` | hero asset modeling → GLB (Blender 5.2.1 LTS) |
| Krita MCP | built-in | 2D textures/concept art |

### Asset sources (candidates — verify license per asset)

- Mixamo — rigged humanoid avatars + animations
- Kenney — CC0 low-poly props
- Quaternius — CC0 models
- Poly Pizza — CC/CC0 aggregator

---

## Generated world assets

| Asset | Path | Source | Notes |
| --- | --- | --- | --- |
| Terrain heightmap | `public/world/chattogram/terrain/heightmap.f32` | Copernicus DEM GLO-30 | float32le, 549×668 @ 30 m, 1.5 MB |
| Terrain metadata | `public/world/chattogram/terrain/metadata.json` | generated | bounds, size, elevation range, attribution |
| Roads | `public/world/chattogram/roads/roads.json` | OSM via Overpass | 913 major ways, already projected to local meters |
| Buildings | `public/world/chattogram/buildings/buildings.json` | OSM API `map` | 6,604 footprints (spawn district), 38 named, heights + type |
| Avatar | `public/models/character.glb` | Blender | joint-node hierarchy, ~309 KB |

Generator scripts (see `package.json`): `world:dem`, `world:roads`.

## Blender character

- Build script — `scripts/blender/build_character.py` (reproducible; run via
  Blender MCP or `blender --background --python`).
- Style reference — soft stylized humanoid: cream beanie, oversized hoodie,
  taupe cuffed pants, chunky sneakers, dot-eyes face; holds a coffee cup and a
  tablet.
- Joints exported: `JointTorso`, `JointHead`, `JointArmL`, `JointArmR`,
  `JointLegL`, `JointLegR`. Animated in `src/player/GltfAvatar.ts`.
- Blender MCP — `127.0.0.1:9876` (Blender 5.2.1 LTS).

## Browser APIs

- Geolocation API — https://developer.mozilla.org/docs/Web/API/Geolocation_API
  (requires a secure context; used for the spawn + live tracking).
- Web Audio API — https://developer.mozilla.org/docs/Web/API/Web_Audio_API

## Audio

- Footsteps — synthesized in `src/audio/AudioManager.ts` (filtered noise + envelope).
- Planned layers (spec §57): city ambience, birds, traffic, environmental loops.
- Candidate free sources (verify license): Freesound (CC0/CC-BY), Mixkit,
  Pixabay Audio, BBC Sound Effects (non-commercial terms).
- WebAudio API — https://developer.mozilla.org/docs/Web/API/Web_Audio_API

## Repository

- GitHub — https://github.com/fazleyrabby/chattogram-3dworld
- Branch — `main`
- `spec.md` — private, **not committed** (see `.gitignore`)
