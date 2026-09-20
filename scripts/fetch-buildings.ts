/**
 * Extracts building footprints from OSM for a central Chittagong area and writes
 * them projected into local world coordinates with estimated heights (spec §12,
 * §13, §50).
 *
 * Buildings are fetched in small sub-tiles because a single Overpass query over
 * the city times out. Full-city coverage is a later milestone (chunking + LOD);
 * this MVP covers the dense centre.
 *
 * Output: public/world/chattogram/buildings/buildings.json
 * Run:    npm run world:buildings
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WORLD_CONFIG } from "../src/config/WorldConfig";
import { overpass, sleep, type OverpassElement } from "./lib/osm";

const METERS_PER_DEGREE_LAT = 111_320;
const LEVEL_HEIGHT = 3.0;

/** Central city sub-area for the first buildings pass. */
const BUILDING_BOUNDS = { south: 22.335, west: 91.805, north: 22.385, east: 91.855 };
const TILE_DEG = 0.025;

const TYPE_DEFAULTS: Record<string, number> = {
  residential: 9,
  commercial: 14,
  industrial: 10,
  office: 22,
  school: 9,
  university: 12,
  hospital: 18,
  religious: 10,
  government: 14,
  warehouse: 9,
  hotel: 26,
  stadium: 22,
  unknown: 7,
};

const KNOWN_TYPES = new Set(Object.keys(TYPE_DEFAULTS));

interface Building {
  id: string;
  type: string;
  height: number;
  ring: Array<[number, number]>;
}

function classify(tags: Record<string, string>): string {
  const b = tags.building ?? "";
  if (KNOWN_TYPES.has(b)) return b;
  if (tags.amenity === "place_of_worship" || b === "church" || b === "mosque") return "religious";
  if (tags.amenity === "hospital" || tags.amenity === "clinic") return "hospital";
  if (tags.amenity === "school" || tags.amenity === "kindergarten") return "school";
  if (tags.amenity === "university" || tags.amenity === "college") return "university";
  if (tags.office || b === "commercial") return "commercial";
  if (["house", "apartments", "detached", "terrace", "yes", "dormitory", "semidetached_house"].includes(b)) {
    return "residential";
  }
  if (b === "industrial" || tags.landuse === "industrial") return "industrial";
  return "unknown";
}

function parseHeight(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = Number.parseFloat(match[0]);
  return Number.isFinite(n) && n > 0 && n < 400 ? n : undefined;
}

function estimateHeight(tags: Record<string, string>, type: string): number {
  const explicit = parseHeight(tags.height) ?? parseHeight(tags["building:height"]);
  if (explicit) return explicit;

  const levels = parseHeight(tags["building:levels"]);
  if (levels) return levels * LEVEL_HEIGHT;

  return TYPE_DEFAULTS[type] ?? TYPE_DEFAULTS.unknown ?? 7;
}

function ringArea(ring: Array<[number, number]>): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    area += (b[0] + a[0]) * (b[1] - a[1]);
  }
  return Math.abs(area / 2);
}

async function main(): Promise<void> {
  const { origin } = WORLD_CONFIG;
  const lonScale = METERS_PER_DEGREE_LAT * Math.cos((origin.latitude * Math.PI) / 180);
  const toLocal = (lat: number, lon: number): [number, number] => [
    round((lon - origin.longitude) * lonScale),
    round((lat - origin.latitude) * METERS_PER_DEGREE_LAT),
  ];

  const buildings = new Map<string, Building>();
  let tiles = 0;
  let skipped = 0;

  for (let lat = BUILDING_BOUNDS.south; lat < BUILDING_BOUNDS.north; lat += TILE_DEG) {
    for (let lon = BUILDING_BOUNDS.west; lon < BUILDING_BOUNDS.east; lon += TILE_DEG) {
      const s = lat;
      const w = lon;
      const n = Math.min(lat + TILE_DEG, BUILDING_BOUNDS.north);
      const e = Math.min(lon + TILE_DEG, BUILDING_BOUNDS.east);
      const query = `[out:json][timeout:120];way["building"](${s},${w},${n},${e});out geom;`;

      process.stdout.write(`[buildings] tile ${++tiles} (${s.toFixed(3)},${w.toFixed(3)}) ... `);
      const elements = await overpass(query);
      let added = 0;

      for (const element of elements) {
        if (element.type !== "way" || !element.geometry) continue;
        const id = `way/${element.id}`;
        if (buildings.has(id)) continue;

        const ring = element.geometry.map((p) => toLocal(p.lat, p.lon));
        if (ring.length < 4) {
          skipped++;
          continue;
        }
        if (ringArea(ring) < 12) {
          skipped++;
          continue;
        }

        const tags = element.tags ?? {};
        const type = classify(tags);
        buildings.set(id, { id, type, height: round(estimateHeight(tags, type)), ring });
        added++;
      }
      console.log(`${elements.length} ways, +${added}`);

      await sleep(1500);
    }
  }

  const list = [...buildings.values()];
  const byType: Record<string, number> = {};
  for (const b of list) byType[b.type] = (byType[b.type] ?? 0) + 1;

  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../public/world/chattogram/buildings");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "buildings.json"),
    `${JSON.stringify(
      {
        attribution: "Map data © OpenStreetMap contributors (ODbL)",
        generatedAt: new Date().toISOString(),
        bounds: BUILDING_BOUNDS,
        origin,
        buildings: list,
      },
      null,
      0,
    )}\n`,
  );

  console.log(`[buildings] ${list.length} buildings (${skipped} skipped)`);
  console.log("[buildings] by type:", byType);
  console.log(`[buildings] wrote ${resolve(dir, "buildings.json")}`);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

main().catch((error: unknown) => {
  console.error("[buildings] failed:", error);
  process.exitCode = 1;
});
