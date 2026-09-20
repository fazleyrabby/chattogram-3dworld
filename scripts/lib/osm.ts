/**
 * Shared OSM/Overpass helpers for the world-generator scripts (spec §50).
 *
 * The public Overpass server is rate-limited, so queries are retried across
 * mirrors with a User-Agent header. Long-term, heavy extracts should come from
 * the Geofabrik PBF instead (see docs/references.md).
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  nodes?: number[];
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}

export async function overpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const body = `data=${encodeURIComponent(query)}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "chattogram-3dworld/0.1 (world-generator)",
          },
          body,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as { elements?: OverpassElement[] };
        return json.elements ?? [];
      } catch (error) {
        lastError = error;
        await sleep(1500 + attempt * 2000);
      }
    }
  }
  throw new Error(`Overpass failed on all endpoints: ${String(lastError)}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
