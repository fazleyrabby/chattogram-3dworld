import { WORLD_CONFIG } from "@/config/WorldConfig";

/**
 * Surface height of the curved "miniature globe" world (spec §5).
 *
 * The MVP uses a paraboloid approximation of a large sphere:
 * a downward drop proportional to the squared distance from the origin.
 * This keeps roads readable and buildings upright while giving the world a
 * subtle curved horizon instead of an infinite flat plane.
 */
export function surfaceHeight(x: number, z: number): number {
  const { mode, radius } = WORLD_CONFIG.curvature;
  if (mode === "flat") return 0;
  const r2 = x * x + z * z;
  return -(r2 / (2 * radius));
}

/** Approximate local up direction on the curved surface. */
export function surfaceNormal(x: number, z: number): [number, number, number] {
  const { mode, radius } = WORLD_CONFIG.curvature;
  if (mode === "flat") return [0, 1, 0];
  const nx = x / radius;
  const nz = z / radius;
  const nx2 = nx * nx;
  const nz2 = nz * nz;
  const len = Math.sqrt(nx2 + nz2 + 1);
  return [nx / len, 1 / len, nz / len];
}
