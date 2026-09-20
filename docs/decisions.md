# Architecture Decision Records

## ADR-0001 — Core stack

**Status:** Accepted

**Decision**

- **TypeScript (strict)** + **Vite** — matches spec §47/§79.
- **Three.js** (WebGL2) owns the render loop.
- **React is optional and deferred.** Milestone 1 uses plain DOM for the HUD so the
  game loop stays dependency-free. React can be introduced later for menus/panels
  only; it must never drive the render loop (§47).
- **No physics engine in Milestone 1.** The player uses a small custom
  gravity/ground controller against the procedural surface. A lightweight engine
  (Rapier, §48) is evaluated when real terrain/buildings arrive (Milestone 2/4).

**Rationale**

Keep M1 dependency-light to prove the loop, projection, and camera before adding
WASM physics or a UI framework.

**Alternatives considered**

- React now — rejected for M1: adds build surface for no gameplay value.
- Rapier now — deferred: no collidable terrain/buildings exist yet.

---

## ADR-0002 — Local coordinate projection

**Status:** Accepted (MVP)

**Decision**

WGS84 lat/lon → local metric frame centered on `WORLD_CONFIG.origin`, using a
local equirectangular approximation (`src/geography/Projection.ts`).

**Rationale**

City-scale accuracy is sufficient, the transform is deterministic and
dependency-free, and call sites only depend on the `LocalPoint` interface. A full
projection (`proj4`, UTM 46N) can replace the implementation later without
touching consumers.

**Alternatives considered**

- `proj4` UTM 46N now — more accurate over the full district, but unnecessary for
  the MVP corridor and adds a dependency.
- Raw lat/lon as Three.js coordinates — rejected (spec §6).

---

## ADR-0003 — Curved world presentation

**Status:** Accepted (MVP)

**Decision**

The "miniature globe" is a **paraboloid approximation** of a large sphere:
`y = -(x² + z²) / (2·radius)`, with `radius` configurable and far smaller than
Earth (default 50,000 m).

**Rationale**

Gives a subtle curved horizon and readable roads while keeping buildings upright
and movement natural (spec §5). Buildings stay axis-up; only the ground drops.

**Alternatives considered**

- Literal Earth radius — curve invisible at city scale.
- True sphere-cap mesh — more complex terrain overlap; revisit if needed.

---

## ADR-0004 — Browser world format (planned)

**Status:** Proposed — decided before Milestone 2

**Decision**

Emit **glTF/GLB per chunk** + JSON metadata, instead of raw GeoJSON or a custom
binary blob.

**Rationale**

Three.js `GLTFLoader` is native, geometry is GPU-ready, and **Meshopt/Draco** and
**KTX2** compression apply directly. Metadata stays in JSON for POIs, labels, and
the minimap.

**Alternatives considered**

- FlatBuffers/msgpack custom binary — more control, more tooling, less ecosystem.
- GeoJSON at runtime — too heavy to parse every load (spec §8 forbids runtime OSM).

---

## ADR-0005 — Minimap is MVP-core

**Status:** Accepted (spec updated §55)

**Decision**

Promote the minimap from optional to MVP. It reuses generated world vectors
(roads/water/landmarks), renders with **Canvas2D** outside the render loop, and
supports a toggle (M).

**Rationale**

Orientation is core to a free-roam exploration/learning tool.

---

## ADR-0006 — Educational layer

**Status:** Accepted (spec §33a added)

**Decision**

Add a learning layer: curated landmark content plus Wikipedia/Wikidata/Commons
enrichment, a discovery log, and a persistent accuracy/attribution disclaimer.

**Rationale**

The project doubles as an educational tool; framing stays "geographically based
on real Chattogram data," never "exact replica."
