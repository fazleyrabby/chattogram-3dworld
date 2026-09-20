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

---

## ADR-0007 — Scope is Chittagong city, not the district

**Status:** Accepted

**Decision**

Limit world data to **Chittagong city** (bounds `22.24–22.42 N, 91.74–91.90 E`),
not the wider district/region. Origin recentered to the bbox center
(`22.33, 91.82`); spawn remains Cheragi Pahar (`22.3437, 91.8336`).

**Rationale**

The whole district is ~1000 km² with on the order of hundreds of thousands of
buildings; it is neither viable nor in scope for now. A ~16×20 km city slice at
30 m is 549×668 and 1.5 MB.

**Alternatives considered**

- Whole-district bbox — rejected: heavy preprocessing, storage, and streaming
  cost with no MVP value.

---

## ADR-0008 — Avatar: Blender GLB with procedural fallback

**Status:** Accepted

**Decision**

Author the player avatar in Blender (`scripts/blender/build_character.py`) and
export `public/models/character.glb`. The GLB exposes named joint nodes
(`JointTorso`, `JointHead`, `JointArmL/R`, `JointLegL/R`); `GltfAvatar` animates
those nodes. `PlayerModel` remains a procedural fallback if the GLB fails to
load, behind the shared `PlayerAvatar` interface. The avatar is **static at
rest** and animates only in response to input.

**Rationale**

Better-looking hero asset without adding a runtime dependency, and the joint-node
approach keeps animation identical between both avatars. Matches the spec's
stylized (not photoreal) target.

**Notes**

- Blender is Z-up; the exporter converts to Y-up. The model faces -Y in Blender
  (= +Z in-game).
- Do **not** overwrite joint `position` from JS — offset bobs from the joint's
  base value (a bug where `JointTorso.y` (0.92) was overwritten and collapsed the
  body).

**Alternatives considered**

- Fully rigged armature + baked animation clips — unnecessary for M2/M3; revisit
  if richer animation is needed.
- Third-party rigged avatar (Mixamo) — deferred.

---

## ADR-0014 — City life is instanced ambience, not simulation

**Status:** Accepted

**Decision**

Roadside props, pedestrians and traffic are **instanced ambience**, not AI:
utility poles + sagging cables and street trees (`StreetProps`, InstancedMesh),
~90 pedestrians walking road sidewalks (`Pedestrians`), and ~50 cars / CNG
auto-rickshaws / cycle rickshaws looping along the major roads (`Traffic`) — each
vehicle type one InstancedMesh with per-instance colour. City sound is
synthesized in `AudioManager` (traffic hum + random horns/birds, day/night
scaled).

**Rationale**

Spec §41–43, §57 and §23 want a lived-in city without simulation cost. Path
following + instancing gives the crowd feel at 60 FPS; skeletal pedestrians and
real traffic AI are out of scope.

**Notes**

Stylised/cartoonish per the owner's direction — detail without realism.

---

## ADR-0013 — Named buildings get a procedural detail pass

**Status:** Accepted

**Decision**

Named (authentic) buildings keep their OSM footprint and estimated height, but
gain extra architecture from `src/world/LandmarkDetails.ts`, inspired by their
real typology: a plinth and cornice for all; **religious** buildings get a
drummed dome, finial, four corner minarets and an arched portal; **civic /
commercial / educational** buildings get a colonnaded portico with a roof slab.

**Rationale**

Spec §16 says important buildings should not rely solely on procedural
extrusion, and §76–77 asks for "geographically based," stylised results — not
literal replicas. A type-inspired procedural pass scales to all 38 named
buildings immediately, and keeps the pipeline data-driven.

**Alternatives / next step**

Hand-authoring GLB hero models in Blender (still available) gives real
per-building fidelity for the most iconic few; the procedural pass remains the
fallback and the base shell. This is the intended follow-up for a curated set.

---

## ADR-0011 — Day/night is a single time value

**Status:** Accepted

**Decision**

One hour value in `TimeOfDay` drives sun direction, sky/fog color, light color
and intensity. No astronomical simulation. Night uses a cool low-intensity key
light (moon) in the opposite direction plus an ambient floor, so it stays
navigable.

**Rationale**

Spec §34 asks for a simple time-of-day, not an ephemeris. Keeping every value
derived from one number makes the cycle trivial to tune and test (set
`timeOfDay.hours`).

---

## ADR-0012 — Device geolocation drives the spawn

**Status:** Accepted

**Decision**

On load, request the device position (browser Geolocation API). If it is inside
`WORLD_CONFIG.bounds`, spawn the player there and mark it on the minimap;
otherwise fall back to the configured spawn. **L** re-requests, **G** toggles
live tracking (`watchPosition`).

**Rationale**

"Start from my own location" is a natural fit for a real-geography world.
Falls back gracefully when permission is denied or the device is outside
Chattogram. Requires a secure context (localhost/HTTPS).

**Notes**

The initial request is non-blocking: the default spawn happens first, then the
player is moved to the device location if available.

---

## ADR-0010 — Summonable vehicles (stretch feature)

**Status:** Accepted

**Decision**

Add a simple **car** and **bicycle**, summoned instantly with **C** / **B** and
ridden with **F** (mount/dismount). Procedural meshes, arcade model:
W/S accelerate/brake-reverse, A/D steer (steering scales with speed). While
riding, the camera trails the vehicle heading so W reads as forward, and the
avatar stays visible (`VehicleManager.syncRider`). `VehicleManager` owns
summon/mount/drive; `Vehicle` owns the mesh + physics.

**Rationale**

Spec lists vehicles as an explicit MVP non-goal (§74) and a stretch/future
feature (§42, §75); this is an optional gameplay layer on top of the core
exploration, isolated from the player controller.

**Notes**

- First pass reversed the controls (forward was relative to the vehicle's stale
  facing) and hid the avatar; both fixed. Heading on mount = camera yaw + π.
- The rider has no seated pose yet, so it overlaps the vehicle — polish later.

**Alternatives considered**

- Blender-authored vehicle GLBs — deferred; procedural is enough to prove it.

---

## ADR-0009 — Audio via a single WebAudio bus

**Status:** Accepted

**Decision**

All sound routes through `AudioManager` (one `AudioContext` + master gain).
Footsteps are **synthesized** (filtered noise burst with an envelope) — no asset
files yet. The context is created/resumed on the first user gesture (browser
autoplay policy). A mute/toggle API exists.

**Rationale**

A single bus keeps future layers — city ambience, birds, traffic, environmental
loops (spec §57) — consistent and easy to mix. Synthesized footsteps avoid asset
licensing and load cost for the first audio pass; sample-based footsteps can be
added later behind the same API.

**Alternatives considered**

- HTMLAudio/asset files now — licensing + load overhead for little gain yet.
- Third-party audio engine — unnecessary for this scope.
