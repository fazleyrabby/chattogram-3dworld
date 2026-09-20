/**
 * Extracts major roads from OSM for the city bounds and writes them already
 * projected into local world coordinates (spec §7, §10, §50).
 *
 * Output: public/world/chattogram/roads/roads.json
 * Run:    npm run world:roads
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WORLD_CONFIG } from "../src/config/WorldConfig";
import { overpass, type OverpassElement } from "./lib/osm";

const METERS_PER_DEGREE_LAT = 111_320;

/** Rendering defaults, NOT claims about physical width (spec §10). */
const ROAD_WIDTHS: Record<string, number> = {
  motorway: 17,
  trunk: 15,
  primary: 13,
  secondary: 10,
  tertiary: 8,
  residential: 6,
  unclassified: 6,
  service: 4,
};

const HIGHWAY_FILTER = "^(motorway|trunk|primary|secondary|tertiary)$";

interface LocalRoad {
  id: string;
  type: string;
  name?: string;
  bridge: boolean;
  tunnel: boolean;
  width: number;
  points: Array<[number, number]>;
}

function main(): void {
  const { bounds, origin } = WORLD_CONFIG;
  const query = `[out:json][timeout:120];
    way["highway"~"${HIGHWAY_FILTER}"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    out geom;`;

  overpass(query)
    .then((elements) => {
      const lonScale = METERS_PER_DEGREE_LAT * Math.cos((origin.latitude * Math.PI) / 180);

      const toLocal = (lat: number, lon: number): [number, number] => [
        round((lon - origin.longitude) * lonScale),
        round((lat - origin.latitude) * METERS_PER_DEGREE_LAT),
      ];

      const roads: LocalRoad[] = [];

      for (const element of elements) {
        if (element.type !== "way" || !element.geometry) continue;
        const tags = element.tags ?? {};
        const type = tags.highway;
        if (!type || !(type in ROAD_WIDTHS)) continue;

        const points = element.geometry.map((p) => toLocal(p.lat, p.lon));
        if (points.length < 2) continue;

        const road: LocalRoad = {
          id: `way/${element.id}`,
          type,
          bridge: tags.bridge === "yes" || tags.bridge === "viaduct",
          tunnel: tags.tunnel === "yes",
          width: ROAD_WIDTHS[type] ?? 6,
          points,
        };
        if (tags.name) road.name = tags.name;
        roads.push(road);
      }

      const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../public/world/chattogram/roads");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        resolve(dir, "roads.json"),
        `${JSON.stringify(
          {
            attribution: "Map data © OpenStreetMap contributors (ODbL)",
            generatedAt: new Date().toISOString(),
            bounds,
            origin,
            roads,
          },
          null,
          0,
        )}\n`,
      );

      const byType: Record<string, number> = {};
      for (const road of roads) byType[road.type] = (byType[road.type] ?? 0) + 1;
      console.log(`[roads] ${roads.length} ways`, byType);
      console.log(`[roads] wrote ${resolve(dir, "roads.json")}`);
    })
    .catch((error: unknown) => {
      console.error("[roads] failed:", error);
      process.exitCode = 1;
    });
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

main();
