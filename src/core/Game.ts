import * as THREE from "three";
import { Renderer } from "@/core/Renderer";
import { SceneManager } from "@/core/SceneManager";
import { Terrain } from "@/world/Terrain";
import { Roads } from "@/world/Roads";
import { TerrainHeightfield } from "@/world/TerrainHeightfield";
import { Lighting } from "@/world/Lighting";
import { Player } from "@/player/Player";
import { PlayerController } from "@/player/PlayerController";
import { GltfAvatar } from "@/player/GltfAvatar";
import { AudioManager } from "@/audio/AudioManager";
import { Input } from "@/player/Input";
import { ThirdPersonCamera } from "@/camera/ThirdPersonCamera";
import { HUD } from "@/ui/HUD";
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
    await this.loadAvatar();

    this.sceneManager.scene.add(terrain.object, roads.object);

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
    this.controller.update(delta);

    this.player.getCameraTarget(this.cameraTarget);
    this.cameraRig.update(delta, this.cameraTarget);

    this.updateSun();
    this.renderer.instance.render(
      this.sceneManager.scene,
      this.cameraRig.camera,
    );
    this.hud.update(delta, this.player);
  };

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
