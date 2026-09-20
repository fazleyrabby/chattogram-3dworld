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

  // readRasters with bbox + width/height resamples the COG to our grid.
  const rasters = await image.readRasters({
    bbox: [bounds.west, bounds.south, bounds.east, bounds.north],
    width,
    height,
    resampleMethod: "bilinear",
  });

  const band = rasters[0] as ArrayLike<number>;
  const data = new Float32Array(width * height);

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < data.length; i++) {
    const raw = band[i] as number;
    const value = raw === NO_DATA || !Number.isFinite(raw) ? 0 : raw;
    data[i] = value;
    if (value < min) min = value;
    if (value > max) max = value;
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
