/**
 * Extracts building footprints from OSM for the spawn district and writes them
 * projected into local world coordinates, with estimated heights, a type, and a
 * name for authentic/named buildings (spec §12–14, §16, §50).
 *
 * Data source: the OSM API `map` endpoint, tiled over small bboxes. This is
 * reliable for local areas; the Geofabrik PBF is impractical to download here
 * and public Overpass cannot serve building geometry for the city.
 *
 * Output: public/world/chattogram/buildings/buildings.json
 * Run:    npm run world:buildings
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { WORLD_CONFIG } from "../src/config/WorldConfig";
import { sleep } from "./lib/osm";

const METERS_PER_DEGREE_LAT = 111_320;
const LEVEL_HEIGHT = 3.0;
const API = "https://api.openstreetmap.org/api/0.6/map";
const USER_AGENT = "chattogram-3dworld/0.1 (world-generator)";

/** Spawn district around Cheragi Pahar (WorldConfig.spawn). */
const DISTRICT = { south: 22.3365, west: 91.8265, north: 22.3515, east: 91.8415 };
const TILE_DEG = 0.005;

const TYPE_DEFAULTS: Record<string, number> = {
  residential: 9,
  commercial: 14,
  industrial: 10,
  office: 22,
  school: 9,
  university: 12,
  hospital: 18,
  religious: 12,
  government: 14,
  warehouse: 9,
  hotel: 26,
  stadium: 22,
  unknown: 7,
};
const KNOWN_TYPES = new Set(Object.keys(TYPE_DEFAULTS));

interface OsmNode {
  id: string;
  lat: number;
  lon: number;
}
interface OsmWay {
  id: string;
  refs: string[];
  tags: Record<string, string>;
}
interface Building {
  id: string;
  type: string;
  name?: string;
  height: number;
  ring: Array<[number, number]>;
  wikidata?: string;
  wikipedia?: string;
  description?: string;
  amenity?: string;
  tourism?: string;
  roofShape?: string;
  colour?: string;
  levels?: number;
}

function classify(tags: Record<string, string>): string {
  const b = tags.building ?? "";
  const name = `${tags.name ?? ""} ${tags["name:en"] ?? ""}`;

  // Explicit tags win.
  if (tags.amenity === "place_of_worship" || b === "church" || b === "mosque") return "religious";
  if (tags.amenity === "hospital" || tags.amenity === "clinic") return "hospital";
  if (tags.amenity === "school" || tags.amenity === "kindergarten") return "school";
  if (tags.amenity === "university" || tags.amenity === "college") return "university";
  if (b === "industrial" || tags.landuse === "industrial") return "industrial";
  if (b !== "" && KNOWN_TYPES.has(b) && b !== "yes") return b;
  if (tags.office || b === "commercial") return "commercial";

  // Name heuristics (OSM building tags are often just building=yes).
  if (/masjid|mosque|jame|madrasah|mazar|dargah|buddhist|bihar|temple|church|mandir|khanqah/i.test(name)) {
    return "religious";
  }
  if (/school|college|academy|kindergarten/i.test(name)) return "school";
  if (/hospital|clinic|medical|diagnostic/i.test(name)) return "hospital";
  if (/university|polytechnic|institute of technology/i.test(name)) return "university";
  if (/bank|market|shopping|plaza|tower|center|centre|mall|hotel|restaurant/i.test(name)) {
    return "commercial";
  }

  if (b === "hotel") return "hotel";
  if (["house", "apartments", "detached", "terrace", "yes", "dormitory", "residential"].includes(b)) {
    return "residential";
  }
  return "unknown";
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = Number.parseFloat(match[0]);
  return Number.isFinite(n) ? n : undefined;
}

function estimateHeight(tags: Record<string, string>, type: string): number {
  const explicit = parseNumber(tags.height) ?? parseNumber(tags["building:height"]);
  if (explicit && explicit > 0 && explicit < 400) return explicit;
  const levels = parseNumber(tags["building:levels"]);
  if (levels && levels > 0 && levels < 100) return levels * LEVEL_HEIGHT;
  return TYPE_DEFAULTS[type] ?? 7;
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

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "node" || name === "way" || name === "nd" || name === "tag",
});

/** Fetch and parse one bbox via the OSM API. */
async function fetchTile(s: number, w: number, n: number, e: number): Promise<{ nodes: OsmNode[]; ways: OsmWay[] }> {
  const url = `${API}?bbox=${w},${s},${e},${n}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  const doc = parser.parse(xml) as { osm?: { node?: unknown[]; way?: unknown[] } };
  const osm = doc.osm ?? {};

  const nodes: OsmNode[] = (osm.node ?? []).map((raw) => {
    const o = raw as { "@_id": string; "@_lat": string; "@_lon": string };
    return { id: o["@_id"], lat: Number(o["@_lat"]), lon: Number(o["@_lon"]) };
  });

  const ways: OsmWay[] = (osm.way ?? []).map((raw) => {
    const o = raw as { "@_id": string; nd?: Array<{ "@_ref": string }>; tag?: Array<{ "@_k": string; "@_v": string }> };
    const tags: Record<string, string> = {};
    for (const t of o.tag ?? []) tags[t["@_k"]] = t["@_v"];
    return { id: o["@_id"], refs: (o.nd ?? []).map((nd) => nd["@_ref"]), tags };
  });

  return { nodes, ways };
}

async function main(): Promise<void> {
  const { origin } = WORLD_CONFIG;
  const lonScale = METERS_PER_DEGREE_LAT * Math.cos((origin.latitude * Math.PI) / 180);
  const toLocal = (lat: number, lon: number): [number, number] => [
    round((lon - origin.longitude) * lonScale),
    round((lat - origin.latitude) * METERS_PER_DEGREE_LAT),
  ];

  const buildings = new Map<string, Building>();
  const nodes = new Map<string, [number, number]>();
  let tiles = 0;
  let skipped = 0;

  for (let south = DISTRICT.south; south < DISTRICT.north; south += TILE_DEG) {
    for (let west = DISTRICT.west; west < DISTRICT.east; west += TILE_DEG) {
      const n = Math.min(south + TILE_DEG, DISTRICT.north);
      const e = Math.min(west + TILE_DEG, DISTRICT.east);

      process.stdout.write(`[buildings] tile ${++tiles} ... `);
      let tile;
      try {
        tile = await fetchTile(south, west, n, e);
      } catch (error) {
        console.log(`failed (${String(error)})`);
        await sleep(2000);
        continue;
      }

      for (const node of tile.nodes) nodes.set(node.id, toLocal(node.lat, node.lon));

      let added = 0;
      for (const way of tile.ways) {
        if (!way.tags.building) continue;
        const id = `way/${way.id}`;
        if (buildings.has(id)) continue;

        const ring: Array<[number, number]> = [];
        let ok = true;
        for (const ref of way.refs) {
          const coord = nodes.get(ref);
          if (!coord) {
            ok = false;
            break;
          }
          ring.push(coord);
        }
        if (!ok || ring.length < 4) {
          skipped++;
          continue;
        }
        if (ringArea(ring) < 12) {
          skipped++;
          continue;
        }

        const type = classify(way.tags);
        const building: Building = {
          id,
          type,
          height: round(estimateHeight(way.tags, type)),
          ring,
        };
        if (way.tags["roof:shape"]) building.roofShape = way.tags["roof:shape"];
        if (way.tags["building:colour"] || way.tags["building:color"]) {
          building.colour = way.tags["building:colour"] ?? way.tags["building:color"];
        }
        const levels = parseNumber(way.tags["building:levels"]);
        if (levels) building.levels = Math.round(levels);
        const name = way.tags.name ?? way.tags["name:en"];
        if (name) {
          building.name = name;
          if (way.tags.wikidata) building.wikidata = way.tags.wikidata;
          if (way.tags.wikipedia) building.wikipedia = way.tags.wikipedia;
          if (way.tags.description) building.description = way.tags.description;
          if (way.tags.amenity) building.amenity = way.tags.amenity;
          if (way.tags.tourism) building.tourism = way.tags.tourism;
        }
        buildings.set(id, building);
        added++;
      }

      console.log(`${tile.nodes.length} nodes, ${tile.ways.length} ways, +${added}`);
      await sleep(800);
    }
  }

  const list = [...buildings.values()];
  const named = list.filter((b) => b.name);
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
        bounds: DISTRICT,
        origin,
        buildings: list,
      },
      null,
      0,
    )}\n`,
  );

  console.log(`[buildings] ${list.length} buildings (${skipped} skipped), ${named.length} named`);
  console.log("[buildings] by type:", byType);
  console.log("[buildings] named:", named.map((b) => b.name).slice(0, 30));
  console.log(`[buildings] wrote ${resolve(dir, "buildings.json")}`);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

main().catch((error: unknown) => {
  console.error("[buildings] failed:", error);
  process.exitCode = 1;
});
