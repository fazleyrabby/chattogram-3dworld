import * as THREE from "three";
import { surfaceHeight } from "@/geography/Curvature";
import { WORLD_CONFIG } from "@/config/WorldConfig";

/**
 * The curved "miniature globe" ground surface (spec §5).
 *
 * Milestone 1 uses a single procedural curved plane. Real terrain (DEM),
 * roads, water and chunks replace/augment this in later milestones.
 */
export class WorldSurface {
  readonly object: THREE.Group;
  private readonly size: number;

  constructor(size = 6000, segments = 240) {
    this.size = size;
    this.object = new THREE.Group();
    this.object.name = "WorldSurface";

    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, surfaceHeight(x, z));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x6f8f5a,
      roughness: 0.95,
      metalness: 0.0,
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.receiveShadow = true;
    ground.name = "Ground";
    this.object.add(ground);

    const grid = new THREE.GridHelper(
      this.size,
      Math.round(this.size / WORLD_CONFIG.chunkSize),
      0x2f4a25,
      0x3d5a30,
    );
    grid.position.y = surfaceHeight(0, 0) + 0.05;
    grid.name = "Grid";
    this.object.add(grid);

    const axes = new THREE.AxesHelper(50);
    axes.name = "OriginAxes";
    this.object.add(axes);
  }

  get terrainSize(): number {
    return this.size;
  }
}
