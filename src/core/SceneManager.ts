import * as THREE from "three";

const SKY_COLOR = 0x9fc4e8;

/**
 * Owns the Three.js scene and its atmospheric settings (spec §36, §40).
 */
export class SceneManager {
  readonly scene: THREE.Scene;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 900, 5200);
  }
}
