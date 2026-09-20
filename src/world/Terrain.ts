import * as THREE from "three";
import { surfaceHeight } from "@/geography/Curvature";
import { geoToLocal } from "@/geography/Projection";
import type { TerrainHeightfield } from "@/world/TerrainHeightfield";

interface Band {
  max: number;
  color: [number, number, number];
}

/** Simple elevation ramp: water-side green -> hills -> rocky highlands. */
const ELEVATION_BANDS: Band[] = [
  { max: 5, color: [0.3, 0.42, 0.28] },
  { max: 30, color: [0.28, 0.45, 0.24] },
  { max: 100, color: [0.35, 0.46, 0.26] },
  { max: 250, color: [0.5, 0.47, 0.33] },
  { max: 400, color: [0.56, 0.5, 0.42] },
  { max: Infinity, color: [0.62, 0.6, 0.56] },
];

function elevationColor(elevation: number, out: THREE.Color): THREE.Color {
  for (const band of ELEVATION_BANDS) {
    if (elevation <= band.max) {
      return out.setRGB(band.color[0], band.color[1], band.color[2]);
    }
  }
  return out.setRGB(0.62, 0.6, 0.56);
}

/**
 * Builds a renderable terrain mesh from the DEM heightfield (spec §18).
 *
 * `stride` decimates the DEM grid for Milestone 2 (chunked, full-resolution
 * meshes arrive with world streaming in Milestone 6). Player physics samples the
 * full-resolution heightfield, so it stays smooth even where the mesh is coarse.
 */
export class Terrain {
  readonly object: THREE.Mesh;

  constructor(heightfield: TerrainHeightfield, stride = 1) {
    const { bounds, width, height } = heightfield.metadata;
    const cols = Math.floor((width - 1) / stride) + 1;
    const rows = Math.floor((height - 1) / stride) + 1;

    const positions = new Float32Array(cols * rows * 3);
    const colors = new Float32Array(cols * rows * 3);
    const indices: number[] = [];
    const color = new THREE.Color();

    for (let row = 0; row < rows; row++) {
      const gy = Math.min(row * stride, height - 1);
      const lat = bounds.north - (gy / (height - 1)) * (bounds.north - bounds.south);

      for (let col = 0; col < cols; col++) {
        const gx = Math.min(col * stride, width - 1);
        const lon = bounds.west + (gx / (width - 1)) * (bounds.east - bounds.west);

        const local = geoToLocal({ latitude: lat, longitude: lon });
        const elevation = heightfield.getByGrid(gx, gy);
        const y = surfaceHeight(local.x, local.z) + elevation;

        const vi = (row * cols + col) * 3;
        positions[vi] = local.x;
        positions[vi + 1] = y;
        positions[vi + 2] = local.z;

        elevationColor(elevation, color);
        colors[vi] = color.r;
        colors[vi + 1] = color.g;
        colors[vi + 2] = color.b;
      }
    }

    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const a = row * cols + col;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        // Counter-clockwise when viewed from above (+Y) so normals point up.
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    });

    this.object = new THREE.Mesh(geometry, material);
    this.object.name = "Terrain";
    this.object.receiveShadow = true;
    this.object.castShadow = false;
  }
}
