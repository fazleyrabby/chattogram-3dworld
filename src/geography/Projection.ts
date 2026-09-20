import { WORLD_CONFIG, type GeoCoordinate } from "@/config/WorldConfig";

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Converts WGS84 lat/lon into a local metric frame centered on WORLD_CONFIG.origin.
 *
 * This is a local equirectangular approximation, which is accurate enough for a
 * city-scale slice and keeps the projection deterministic and dependency-free.
 * A full projection (e.g. UTM 46N via proj4) can replace this later without
 * touching call sites, because everything consumes LocalPoint.
 */
export interface LocalPoint {
  /** East/west, meters. +X = east. */
  x: number;
  /** North/south, meters. +Z = north (Three.js forward is -Z). */
  z: number;
}

export function metersPerDegreeLon(latitude: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
}

export function geoToLocal(coord: GeoCoordinate): LocalPoint {
  const lonScale = metersPerDegreeLon(WORLD_CONFIG.origin.latitude);
  return {
    x: (coord.longitude - WORLD_CONFIG.origin.longitude) * lonScale,
    z: (coord.latitude - WORLD_CONFIG.origin.latitude) * METERS_PER_DEGREE_LAT,
  };
}

export function localToGeo(point: LocalPoint): GeoCoordinate {
  const lonScale = metersPerDegreeLon(WORLD_CONFIG.origin.latitude);
  return {
    latitude: WORLD_CONFIG.origin.latitude + point.z / METERS_PER_DEGREE_LAT,
    longitude: WORLD_CONFIG.origin.longitude + point.x / lonScale,
  };
}
