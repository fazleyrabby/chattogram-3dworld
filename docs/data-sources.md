# Data Sources

Verified during project research. Re-verify counts before relying on them; OSM is
live and changes.

## OpenStreetMap (ODbL)

Primary geography source (spec §7). **Do not scrape Google Maps** (§7).

### Extract availability

- **Geofabrik Bangladesh PBF:** `https://download.geofabrik.de/asia/bangladesh-latest.osm.pbf`
  — verified reachable (redirects to a dated snapshot, e.g. `bangladesh-260919.osm.pbf`).
  **Use this for the offline build pipeline.**

### Overpass API

- Endpoint: `https://overpass-api.de/api/interpreter` (and mirrors).
- Public server is **rate-limited and often busy**; heavy queries fail with
  `rate_limited` / `timeout`. **Do not put Overpass in the build path** — use the
  Geofabrik PBF. Overpass is fine for small ad-hoc lookups.
- Requires a `User-Agent` header; without one it returns `406 Not Acceptable`.

### Verified counts (Chattogram)

| Query | Bbox (S,W,N,E) | Result |
| --- | --- | --- |
| Buildings (`building=*`) | 22.32, 91.80, 22.37, 91.85 (~28.6 km²) | **70,135 ways** |
| `historic=*` | 22.15, 91.65, 22.45, 91.95 | **44 features** |
| `tourism=*` | 22.15, 91.65, 22.45, 91.95 | **285 features** |

**Implication:** full Chattogram City Corporation (~160 km²) extrapolates to
roughly 200k–400k buildings. This confirms the spec's decision (§3) to scope the
MVP to a corridor and to build chunking/LOD before scaling.

### Useful OSM tags for 3D generation

`height`, `building:levels`, `building:part`, `roof:shape`, `roof:height`,
`building:material`, `building:colour` (spec §12–13).

### Historical landmarks found (sample)

Cheragi Pahar (Q15209425), Anderkilla, Chattogram Central Shaheed Minar,
Chittagong Commonwealth War Cemetery Memorial, Central Railway Building,
Reboti Mohan Statue, Bijoy Uddan monument.

## Wikipedia / Wikidata / Wikimedia Commons

- **Wikipedia geosearch** (10 km around 22.3569, 91.7832) returns ~40 geotagged
  articles, e.g. Foy's Lake, Chittagong Zoo, Batali Hill, District Stadium,
  Chittagong Club, Jamiatul Falah Mosque.
- Use for landmark summaries, coordinates, and "Learn more" links (educational
  layer, spec §33a). Content is **CC BY-SA** — attribution required.
- OSM `wikidata` / `wikipedia` / `wikimedia_commons` tags bridge the two datasets.

## Elevation (DEM)

Not yet downloaded. Candidates (spec §18):

- **Copernicus GLO-30** (30 m) — preferred default; open.
- **SRTM 1-arcsec** (30 m) — fallback.
- ALOS AW3D30 — alternative.

Process with GDAL into a heightmap during Milestone 2. Confirm license/attribution
before shipping.

## Attribution requirements (spec §78)

- `Map data © OpenStreetMap contributors` (ODbL).
- Wikipedia/Wikidata/Commons content: CC BY-SA, attributed where used.
