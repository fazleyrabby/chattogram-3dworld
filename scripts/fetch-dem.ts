/**
 * DEM acquisition + heightmap generation (spec §18, §50).
 *
 * Reads Copernicus DEM GLO-30 (EPSG:4326 COG) directly over HTTP, resamples the
 * configured Chattogram bounds to a fixed metric grid, and writes:
 *   - public/world/chattogram/terrain/heightmap.f32  (little-endian Float32)
 *   - public/world/chattogram/terrain/metadata.json
 *
 * Run: npm run world:dem
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fromUrl } from "geotiff";
import { WORLD_CONFIG } from "../src/config/WorldConfig";

const METERS_PER_DEGREE_LAT = 111_320;
const TARGET_SPACING_M = 30;
const NO_DATA = -32767;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = resolve(ROOT, "public/world/chattogram/terrain");

function copernicusTileUrl(latDeg: number, lonDeg: number): string {
  const ns = latDeg >= 0 ? "N" : "S";
  const ew = lonDeg >= 0 ? "E" : "W";
  const name = `Copernicus_DSM_COG_10_${ns}${Math.abs(latDeg)
    .toString()
    .padStart(2, "0")}_00_${ew}${Math.abs(lonDeg)
    .toString()
    .padStart(3, "0")}_00_DEM`;
  return `https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`;
}

async function main(): Promise<void> {
  const { bounds, origin } = WORLD_CONFIG;

  const lonScale = METERS_PER_DEGREE_LAT * Math.cos((origin.latitude * Math.PI) / 180);
  const spanX = (bounds.east - bounds.west) * lonScale;
  const spanZ = (bounds.north - bounds.south) * METERS_PER_DEGREE_LAT;

  const width = Math.round(spanX / TARGET_SPACING_M);
  const height = Math.round(spanZ / TARGET_SPACING_M);

  // Copernicus GLO-30 uses 1°x1° tiles named by their SW corner.
  const tileLat = Math.floor(bounds.south);
  const tileLon = Math.floor(bounds.west);
  const url = copernicusTileUrl(tileLat, tileLon);

  console.log(`[dem] bounds S${bounds.south} W${bounds.west} N${bounds.north} E${bounds.east}`);
  console.log(`[dem] grid ${width} x ${height} @ ~${TARGET_SPACING_M}m`);
  console.log(`[dem] tile   ${url}`);

  const tiff = await fromUrl(url);
  const image = await tiff.getImage();

  // Read the target bounds as a *native-resolution pixel window* and do our own
  // box-filter downsample. Do NOT pass { bbox, width, height } to readRasters:
  // on this COG that path mis-samples and invents huge spikes (e.g. a bogus
  // ~455 m ridge at the NE corner where the real terrain is ~5 m).
  const [resX, resY] = image.getResolution();
  const [originX, originY] = image.getOrigin();
  const absX = Math.abs(resX);
  const absY = Math.abs(resY);

  const px0 = Math.max(0, Math.floor((bounds.west - originX) / absX));
  const px1 = Math.min(image.getWidth(), Math.ceil((bounds.east - originX) / absX));
  const py0 = Math.max(0, Math.floor((originY - bounds.north) / absY));
  const py1 = Math.min(image.getHeight(), Math.ceil((originY - bounds.south) / absY));

  console.log(`[dem] native window ${px0},${py0} .. ${px1},${py1} (${px1 - px0}x${py1 - py0} px)`);

  const rasters = await image.readRasters({ window: [px0, py0, px1, py1] });
  const band = rasters[0] as ArrayLike<number>;
  const srcW = px1 - px0;
  const srcH = py1 - py0;
  if (srcW <= 0 || srcH <= 0) {
    throw new Error("[dem] empty pixel window for the configured bounds");
  }

  // Area-average each target cell from the native pixels that fall inside it.
  const data = new Float32Array(width * height);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let row = 0; row < height; row++) {
    const sy0 = Math.floor((row / height) * srcH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((row + 1) / height) * srcH));

    for (let col = 0; col < width; col++) {
      const sx0 = Math.floor((col / width) * srcW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((col + 1) / width) * srcW));

      let sum = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1 && sy < srcH; sy++) {
        for (let sx = sx0; sx < sx1 && sx < srcW; sx++) {
          const raw = band[sy * srcW + sx] as number;
          if (raw === NO_DATA || !Number.isFinite(raw)) continue;
          sum += raw;
          count += 1;
        }
      }

      const value = count > 0 ? sum / count : 0;
      data[row * width + col] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const binPath = resolve(OUT_DIR, "heightmap.f32");
  writeFileSync(binPath, Buffer.from(data.buffer, data.byteOffset, data.byteLength));

  const metadata = {
    city: WORLD_CONFIG.city,
    country: WORLD_CONFIG.country,
    bounds,
    origin,
    width,
    height,
    spacingMeters: TARGET_SPACING_M,
    layout: "row-major, north-to-south rows, west-to-east columns",
    encoding: "float32le",
    noData: NO_DATA,
    elevation: { min: round(min), max: round(max) },
    source: "Copernicus DEM GLO-30",
    attribution:
      "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.",
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(
    resolve(OUT_DIR, "metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );

  console.log(`[dem] elevation ${round(min)}m .. ${round(max)}m`);
  console.log(`[dem] wrote ${binPath} (${(data.byteLength / 1e6).toFixed(1)} MB)`);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

main().catch((error: unknown) => {
  console.error("[dem] failed:", error);
  process.exitCode = 1;
});
