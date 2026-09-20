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
}

export const WORLD_CONFIG: WorldConfig = {
  city: "Chattogram",
  country: "Bangladesh",
  // Corridor: New Bridge -> central -> port/Karnaphuli -> Patenga (spec §3).
  bounds: {
    north: 22.45,
    south: 22.15,
    east: 91.95,
    west: 91.65,
  },
  origin: {
    latitude: 22.3437,
    longitude: 91.8336,
  },
  spawn: {
    latitude: 22.3437,
    longitude: 91.8336,
  },
  curvature: {
    mode: "spherical",
    radius: 50000,
  },
  chunkSize: 500,
};
