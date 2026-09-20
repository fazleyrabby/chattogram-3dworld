import { surfaceHeight } from "@/geography/Curvature";
import type { TerrainHeightfield } from "@/world/TerrainHeightfield";

/** Returns world-space ground height (curvature + terrain elevation) at x/z. */
export type HeightProvider = (x: number, z: number) => number;

/**
 * Combines the curved globe surface (spec §5) with DEM elevation (spec §18).
 * Before terrain loads, callers get the bare curved surface.
 */
export function createHeightProvider(
  heightfield?: TerrainHeightfield,
): HeightProvider {
  if (!heightfield) {
    return (x, z) => surfaceHeight(x, z);
  }
  return (x, z) => surfaceHeight(x, z) + heightfield.sampleLocal(x, z);
}
