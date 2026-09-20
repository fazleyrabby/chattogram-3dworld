import * as THREE from "three";
import { Renderer } from "@/core/Renderer";
import { SceneManager } from "@/core/SceneManager";
import { WorldSurface } from "@/world/WorldSurface";
import { Lighting } from "@/world/Lighting";
import { Player } from "@/player/Player";
import { PlayerController } from "@/player/PlayerController";
import { Input } from "@/player/Input";
import { ThirdPersonCamera } from "@/camera/ThirdPersonCamera";
import { HUD } from "@/ui/HUD";
import { WORLD_CONFIG } from "@/config/WorldConfig";
import { geoToLocal } from "@/geography/Projection";
import { surfaceHeight } from "@/geography/Curvature";

/**
 * Owns the game loop and wires the systems together (spec §61).
 *
 * Systems stay independent: the loop advances player, camera, and (later) the
 * world streamer, then renders. Nothing here reaches into world generation.
 */
export class Game {
  private readonly clock = new THREE.Clock();
  private readonly renderer: Renderer;
  private readonly sceneManager = new SceneManager();
  private readonly surface = new WorldSurface();
  private readonly lighting = new Lighting();
  private readonly input: Input;
  private readonly player = new Player();
  private readonly controller: PlayerController;
  private readonly cameraRig: ThirdPersonCamera;
  private readonly hud: HUD;
  private readonly cameraTarget = new THREE.Vector3();

  private running = false;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.cameraRig = new ThirdPersonCamera(this.renderer.aspect);
    this.controller = new PlayerController(this.player, this.input, this.cameraRig);
    this.hud = new HUD(hudRoot);

    this.sceneManager.scene.add(
      this.surface.object,
      this.lighting.object,
      this.player.object,
    );

    this.spawnPlayer();

    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  private spawnPlayer(): void {
    const spawn = geoToLocal(WORLD_CONFIG.spawn);
    this.player.position.set(
      spawn.x,
      surfaceHeight(spawn.x, spawn.z),
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

    // Clamp delta so a background tab or stall cannot teleport the player.
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
    this.lighting.sun.position.set(p.x + 1200, p.y + 1800, p.z + 900);
    this.lighting.sun.target.position.copy(p);
    this.lighting.sun.target.updateMatrixWorld();
  }
}
