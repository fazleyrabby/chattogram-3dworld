export type CurvatureMode = "flat" | "curved" | "spherical";

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface WorldBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface WorldConfig {
  city: string;
  country: string;
  /** Geographic bounding box of the playable region (WGS84). */
  bounds: WorldBounds;
  /** Geographic coordinate that maps to local world origin (0, 0, 0). */
  origin: GeoCoordinate;
  /** Where the player spawns, in WGS84. */
  spawn: GeoCoordinate;
  curvature: {
    mode: CurvatureMode;
    /**
     * Radius used by the spherical/curved surface approximation, in meters.
     * Smaller radius = more exaggerated local curvature. This is intentionally
     * NOT Earth scale (Earth is ~6,371,000 m) so the curve reads on a city slice.
     */
    radius: number;
  };
  /** Chunk size in meters (see spec §21). */
  chunkSize: number;
  /** Sea level in meters, added to the curved surface. */
  seaLevel: number;
}

export const WORLD_CONFIG: WorldConfig = {
  city: "Chattogram",
  country: "Bangladesh",
  // Chittagong CITY only (spec §3) — not the wider district/region. Covers the
  // urban area across the Karnaphuli down toward Patenga. Scope decision:
  // ADR-0007.
  bounds: {
    north: 22.42,
    south: 22.24,
    east: 91.9,
    west: 91.74,
  },
  origin: {
    latitude: 22.33,
    longitude: 91.82,
  },
  spawn: {
    latitude: 22.3437,
    longitude: 91.8336,
  },
  curvature: {
    mode: "spherical",
    // Gentle bend over a ~30 km world. Real DEM elevation is the primary relief;
    // curvature only adds a subtle curved horizon (ADR-0003).
    radius: 3_000_000,
  },
  chunkSize: 500,
  seaLevel: 0,
};
