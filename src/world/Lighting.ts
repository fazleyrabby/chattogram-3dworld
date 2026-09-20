import * as THREE from "three";

/**
 * Daylight lighting rig (spec §35). Day/night cycle (§34) is added later;
 * for Milestone 1 this is a fixed, clean sun setup.
 */
export class Lighting {
  readonly object: THREE.Group;
  readonly sun: THREE.DirectionalLight;

  constructor(sceneSize = 6000) {
    this.object = new THREE.Group();
    this.object.name = "Lighting";

    const hemisphere = new THREE.HemisphereLight(0xbfd8ff, 0x4a5a3a, 0.9);
    this.object.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
    sun.position.set(1200, 1800, 900);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 5000;
    sun.shadow.bias = -0.0005;

    const extent = Math.min(sceneSize / 4, 1200);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.updateProjectionMatrix();

    this.sun = sun;
    this.object.add(sun);
    this.object.add(sun.target);
  }
}
