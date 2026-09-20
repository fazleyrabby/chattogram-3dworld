import * as THREE from "three";
import { Renderer } from "@/core/Renderer";
import { SceneManager } from "@/core/SceneManager";
import { Terrain } from "@/world/Terrain";
import { Roads } from "@/world/Roads";
import { Buildings } from "@/world/Buildings";
import { TerrainHeightfield } from "@/world/TerrainHeightfield";
import { Lighting } from "@/world/Lighting";
import { Player } from "@/player/Player";
import { PlayerController } from "@/player/PlayerController";
import { GltfAvatar } from "@/player/GltfAvatar";
import { AudioManager } from "@/audio/AudioManager";
import { VehicleManager } from "@/vehicles/VehicleManager";
import { Input } from "@/player/Input";
import { ThirdPersonCamera } from "@/camera/ThirdPersonCamera";
import { HUD } from "@/ui/HUD";
import { WorldLabels } from "@/ui/WorldLabels";
import { Minimap } from "@/ui/Minimap";
import { WORLD_CONFIG } from "@/config/WorldConfig";
import { geoToLocal } from "@/geography/Projection";
import { createHeightProvider, type HeightProvider } from "@/geography/WorldHeight";

/**
 * Owns the game loop and wires the systems together (spec §61).
 *
 * Systems stay independent: the loop advances player, camera, and (later) the
 * world streamer, then renders. World assets are loaded in `load()` before the
 * loop starts.
 */
export class Game {
  private readonly clock = new THREE.Clock();
  private readonly renderer: Renderer;
  private readonly sceneManager = new SceneManager();
  private readonly lighting = new Lighting();
  private readonly input: Input;
  private readonly player = new Player();
  private readonly cameraRig: ThirdPersonCamera;
  private readonly hud: HUD;
  private readonly cameraTarget = new THREE.Vector3();

  private controller: PlayerController;
  private getHeight: HeightProvider = createHeightProvider();
  private heightfield?: TerrainHeightfield;
  private labels?: WorldLabels;
  private minimap?: Minimap;
  private vehicles?: VehicleManager;
  private readonly audio = new AudioManager();
  private running = false;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.cameraRig = new ThirdPersonCamera(this.renderer.aspect);
    this.controller = new PlayerController(
      this.player,
      this.input,
      this.cameraRig,
      this.getHeight,
    );
    this.hud = new HUD(hudRoot);

    this.player.onFootstep = (intensity) => this.audio.footstep(intensity);
    window.addEventListener("pointerdown", this.onFirstGesture, { once: true });
    window.addEventListener("keydown", this.onFirstGesture, { once: true });

    this.sceneManager.scene.add(this.lighting.object, this.player.object);

    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  /** Browsers require a user gesture before audio can start. */
  private onFirstGesture = (): void => {
    this.audio.resume();
  };

  /** Loads world assets and sets up the player at the configured spawn. */
  async load(): Promise<void> {
    this.heightfield = await TerrainHeightfield.load();
    this.getHeight = createHeightProvider(this.heightfield);
    this.controller = new PlayerController(
      this.player,
      this.input,
      this.cameraRig,
      this.getHeight,
    );

    const terrain = new Terrain(this.heightfield);
    const roads = await Roads.load(this.getHeight);
    const buildings = await Buildings.load(this.getHeight);
    this.labels = new WorldLabels(buildings.named, this.getHeight);
    this.minimap = new Minimap(document.body, buildings.list, roads.roads, buildings.named);
    this.vehicles = new VehicleManager(this.sceneManager.scene, this.getHeight);
    await this.loadAvatar();

    this.sceneManager.scene.add(terrain.object, roads.object, buildings.object);

    this.spawnPlayer();
  }

  private async loadAvatar(): Promise<void> {
    try {
      const avatar = await GltfAvatar.load();
      this.player.setAvatar(avatar);
    } catch (error) {
      console.warn("[avatar] GLB unavailable; using procedural avatar.", error);
    }
  }

  private spawnPlayer(): void {
    const spawn = geoToLocal(WORLD_CONFIG.spawn);
    this.player.position.set(
      spawn.x,
      this.getHeight(spawn.x, spawn.z),
      spawn.z,
    );
    this.player.sync();
  }

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.cameraRig.resize(width / height);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    const delta = Math.min(this.clock.getDelta(), 0.05);

    this.cameraRig.handleInput(this.input);
    this.handleVehicleInput();

    const mounted = this.vehicles?.mounted ?? null;
    if (mounted) {
      this.vehicles?.drive(delta, this.input);
      this.vehicles?.syncRider(this.player);
      // Camera trails the vehicle so W reads as forward.
      this.cameraRig.yaw = mounted.heading + Math.PI;
      if (!this.vehicles?.getCameraTarget(this.cameraTarget)) {
        this.player.getCameraTarget(this.cameraTarget);
      }
    } else {
      this.controller.update(delta);
      this.player.getCameraTarget(this.cameraTarget);
    }

    this.cameraRig.update(delta, this.cameraTarget);

    this.labels?.update(this.cameraRig.camera);
    this.minimap?.update(this.player);
    this.updateSun();
    this.renderer.instance.render(
      this.sceneManager.scene,
      this.cameraRig.camera,
    );
    this.hud.update(delta, this.player);
    this.input.endFrame();
  };

  private handleVehicleInput(): void {
    const vehicles = this.vehicles;
    if (!vehicles) return;

    if (this.input.wasPressed("KeyC")) vehicles.summon("car", this.player);
    if (this.input.wasPressed("KeyB")) vehicles.summon("bicycle", this.player);
    if (this.input.wasPressed("KeyM")) this.minimap?.toggle();
    if (this.input.wasPressed("KeyF")) {
      vehicles.toggleMount(this.player);
      const mounted = vehicles.mounted;
      if (mounted) {
        // Face away from the camera so W accelerates into the screen.
        mounted.heading = this.cameraRig.yaw + Math.PI;
        this.cameraRig.distance = mounted.spec.camDistance;
      } else {
        this.cameraRig.distance = 12;
      }
    }
  }

  private updateSun(): void {
    const p = this.player.position;
    // Snap the shadow frustum to the shadow-map texel grid. Without this the
    // moving shadow camera re-samples the map every frame and edges shimmer.
    const texel = this.lighting.shadowTexel;
    const sx = Math.round(p.x / texel) * texel;
    const sz = Math.round(p.z / texel) * texel;

    this.lighting.sun.position.set(sx + 1200, p.y + 1800, sz + 900);
    this.lighting.sun.target.position.set(sx, p.y, sz);
    this.lighting.sun.target.updateMatrixWorld();
  }
}
