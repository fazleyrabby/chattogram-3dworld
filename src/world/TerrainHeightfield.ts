import { localToGeo } from "@/geography/Projection";

export interface TerrainMetadata {
  city: string;
  country: string;
  bounds: { north: number; south: number; east: number; west: number };
  width: number;
  height: number;
  spacingMeters: number;
  noData: number;
  elevation: { min: number; max: number };
  source: string;
  attribution: string;
  generatedAt: string;
}

export const TERRAIN_BASE_PATH = "/world/chattogram/terrain";

/**
 * Loads the generated DEM heightmap and samples it (spec §18).
 *
 * The raw grid is row-major, north-to-south rows, west-to-east columns, encoded
 * as little-endian float32 by scripts/fetch-dem.ts.
 */
export class TerrainHeightfield {
  private constructor(
    private readonly data: Float32Array,
    readonly metadata: TerrainMetadata,
  ) {}

  static async load(base = TERRAIN_BASE_PATH): Promise<TerrainHeightfield> {
    const [metaResponse, binResponse] = await Promise.all([
      fetch(`${base}/metadata.json`),
      fetch(`${base}/heightmap.f32`),
    ]);
    if (!metaResponse.ok || !binResponse.ok) {
      throw new Error(`Failed to load terrain from ${base}`);
    }

    const metadata = (await metaResponse.json()) as TerrainMetadata;
    const buffer = await binResponse.arrayBuffer();
    const count = buffer.byteLength / 4;
    if (count !== metadata.width * metadata.height) {
      throw new Error(
        `Heightmap size mismatch: expected ${metadata.width * metadata.height}, got ${count}`,
      );
    }

    // Decode explicitly as little-endian for platform independence.
    const view = new DataView(buffer);
    const data = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      data[i] = view.getFloat32(i * 4, true);
    }

    return new TerrainHeightfield(data, metadata);
  }

  /** Elevation in meters at a local world coordinate. */
  sampleLocal(x: number, z: number): number {
    const geo = localToGeo({ x, z });
    return this.sampleGeo(geo.latitude, geo.longitude);
  }

  /** Elevation in meters at a WGS84 coordinate. */
  sampleGeo(latitude: number, longitude: number): number {
    const { bounds, width, height } = this.metadata;
    const fx = ((longitude - bounds.west) / (bounds.east - bounds.west)) * (width - 1);
    const fy = ((bounds.north - latitude) / (bounds.north - bounds.south)) * (height - 1);
    return this.bilinear(fx, fy);
  }

  /** Raw elevation at a grid cell (clamped). */
  getByGrid(gx: number, gy: number): number {
    const { width, height } = this.metadata;
    const x = Math.max(0, Math.min(width - 1, gx));
    const y = Math.max(0, Math.min(height - 1, gy));
    return this.data[y * width + x] ?? 0;
  }

  private bilinear(fx: number, fy: number): number {
    const { width, height } = this.metadata;
    const cx = Math.max(0, Math.min(width - 1, fx));
    const cy = Math.max(0, Math.min(height - 1, fy));

    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = cx - x0;
    const ty = cy - y0;

    const a = this.getByGrid(x0, y0);
    const b = this.getByGrid(x1, y0);
    const c = this.getByGrid(x0, y1);
    const d = this.getByGrid(x1, y1);

    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
}
