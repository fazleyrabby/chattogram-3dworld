import * as THREE from "three";
import { Renderer } from "@/core/Renderer";
import { SceneManager } from "@/core/SceneManager";
import { Terrain } from "@/world/Terrain";
import { Roads } from "@/world/Roads";
import { Buildings } from "@/world/Buildings";
import { LandmarkDetails } from "@/world/LandmarkDetails";
import { StreetProps } from "@/world/StreetProps";
import { Pedestrians } from "@/world/Pedestrians";
import { Traffic } from "@/world/Traffic";
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
import { PostFX } from "@/rendering/PostFX";
import { Minimap } from "@/ui/Minimap";
import { LandmarkPanel } from "@/ui/LandmarkPanel";
import { LandmarkManager } from "@/landmarks/LandmarkManager";
import { TimeOfDay } from "@/world/TimeOfDay";
import {
  clearLocationWatch,
  getCurrentLocation,
  insideWorldBounds,
  watchLocation,
  type DeviceLocation,
} from "@/geography/Geolocation";
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
  private pedestrians?: Pedestrians;
  private traffic?: Traffic;
  private landmarks?: LandmarkManager;
  private vehicles?: VehicleManager;
  private postfx: PostFX | undefined;
  private readonly audio = new AudioManager();
  private readonly timeOfDay = new TimeOfDay();
  private gpsWatchId: number | null = null;
  private gpsTracking = false;
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

    try {
      this.postfx = new PostFX(
        this.renderer.instance,
        this.sceneManager.scene,
        this.cameraRig.camera,
        window.innerWidth,
        window.innerHeight,
      );
    } catch (error) {
      console.warn("[postfx] disabled:", error);
      this.postfx = undefined;
    }
  }

  /** Browsers require a user gesture before audio can start. */
  private onFirstGesture = (): void => {
    this.audio.resume();
    this.audio.startAmbience();
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
    const landmarkDetails = LandmarkDetails.build(
      buildings.list,
      buildings.named,
      this.getHeight,
    );
    const streetProps = new StreetProps(roads.roads, this.getHeight);
    this.pedestrians = new Pedestrians(roads.roads, this.getHeight);
    this.traffic = new Traffic(roads.roads, this.getHeight);
    this.sceneManager.scene.add(
      landmarkDetails.object,
      streetProps.object,
      this.pedestrians.object,
      this.traffic.object,
    );

    const landmarkPanel = new LandmarkPanel(document.body);
    this.landmarks = new LandmarkManager(buildings.named, landmarkPanel, this.hud);
    this.labels = new WorldLabels(buildings.named, this.getHeight, (name) =>
      this.landmarks?.selectByName(name),
    );
    this.minimap = new Minimap(
      document.body,
      buildings.list,
      roads.roads,
      buildings.named,
      (x, z) => this.travelTo(x, z),
    );
    this.vehicles = new VehicleManager(this.sceneManager.scene, this.getHeight);
    await this.loadAvatar();

    this.sceneManager.scene.add(terrain.object, roads.object, buildings.object);

    this.spawnPlayer();

    // Try to start the player at the device's real location (spec §54 extension).
    void this.startAtDeviceLocation();
  }

  private async loadAvatar(): Promise<void> {
    try {
      const avatar = await GltfAvatar.load();
      this.player.setAvatar(avatar);
    } catch (error) {
      console.warn("[avatar] GLB unavailable; using procedural avatar.", error);
    }
  }

  /** Requests the device location and spawns/marks it if inside the world. */
  private async startAtDeviceLocation(): Promise<void> {
    const location = await getCurrentLocation(8000);
    if (!location) {
      this.hud.setGps("GPS unavailable — press L to retry");
      return;
    }
    this.applyDeviceLocation(location);
  }

  private applyDeviceLocation(location: DeviceLocation): void {
    const inside = insideWorldBounds(location.latitude, location.longitude);
    const coords = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    const local = geoToLocal({ latitude: location.latitude, longitude: location.longitude });
    this.minimap?.setGps(local);

    if (!inside) {
      this.hud.setGps(`GPS ${coords} · outside Chattogram map`);
      return;
    }

    this.player.position.set(local.x, this.getHeight(local.x, local.z), local.z);
    this.player.velocity.set(0, 0, 0);
    this.player.sync();
    this.hud.setGps(`GPS ${coords}${this.gpsTracking ? " · live" : ""}`);
  }

  private toggleGpsTracking(): void {
    if (this.gpsTracking) {
      if (this.gpsWatchId !== null) clearLocationWatch(this.gpsWatchId);
      this.gpsWatchId = null;
      this.gpsTracking = false;
      this.hud.setGps("GPS tracking off");
      return;
    }

    const id = watchLocation((location) => this.applyDeviceLocation(location));
    if (id === null) {
      this.hud.setGps("GPS unavailable");
      return;
    }
    this.gpsWatchId = id;
    this.gpsTracking = true;
    this.hud.setGps("GPS tracking on");
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
    this.postfx?.setSize(width, height);
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

    this.pedestrians?.update(delta);
    this.traffic?.update(delta, this.timeOfDay.isNight);

    this.cameraRig.handleInput(this.input);
    this.handleVehicleInput();

    const mounted = this.vehicles?.mounted ?? null;
    if (mounted) {
      this.vehicles?.drive(delta, this.input);
      this.vehicles?.syncRider(this.player);
      this.player.updateRiding(delta);
      // Camera is free to orbit while riding (mouse drag / wheel zoom), exactly
      // like on foot; it only follows the vehicle's position.
      if (!this.vehicles?.getCameraTarget(this.cameraTarget)) {
        this.player.getCameraTarget(this.cameraTarget);
      }
    } else {
      this.controller.update(delta);
      this.player.getCameraTarget(this.cameraTarget);
    }

    this.cameraRig.update(delta, this.cameraTarget);

    this.landmarks?.update(this.player, this.input);
    this.labels?.update(this.cameraRig.camera);
    this.minimap?.update(this.player);

    // Day/night (spec §34): hold T to fast-forward.
    this.timeOfDay.update(delta, this.input.isDown("KeyT"));
    this.lighting.applyTimeOfDay(
      this.timeOfDay.lightColor,
      this.timeOfDay.sunIntensity,
      this.timeOfDay.ambientIntensity,
    );
    this.sceneManager.setSky(this.timeOfDay.skyColor);
    this.hud.setClock(this.timeOfDay.label);
    this.audio.updateAmbience(delta, this.timeOfDay.isNight);
    this.updateSun(this.timeOfDay.getLightDirection());

    if (this.postfx) {
      this.postfx.render(delta, this.sceneManager.scene, this.cameraRig.camera);
    } else {
      this.renderer.instance.render(
        this.sceneManager.scene,
        this.cameraRig.camera,
      );
    }
    this.hud.update(delta, this.player);
    this.input.endFrame();
  };

  private handleVehicleInput(): void {
    const vehicles = this.vehicles;
    if (!vehicles) return;

    if (this.input.wasPressed("KeyC")) vehicles.summon("car", this.player);
    if (this.input.wasPressed("KeyB")) vehicles.summon("bicycle", this.player);
    if (this.input.wasPressed("KeyM")) this.minimap?.toggle();
    if (this.input.wasPressed("KeyN")) this.minimap?.toggleLarge();
    if (this.input.wasPressed("KeyL")) void this.startAtDeviceLocation();
    if (this.input.wasPressed("KeyG")) this.toggleGpsTracking();
    if (this.input.wasPressed("KeyP")) this.postfx?.toggle();
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

  /** Teleports the player to a world position (map click / pin). */
  private travelTo(x: number, z: number): void {
    if (this.vehicles?.mounted) this.vehicles.toggleMount(this.player);
    this.player.position.set(x, this.getHeight(x, z), z);
    this.player.velocity.set(0, 0, 0);
    this.player.sync();
    this.cameraRig.snap();
  }

  private updateSun(direction: THREE.Vector3): void {
    const p = this.player.position;
    // Snap the shadow frustum to the shadow-map texel grid. Without this the
    // moving shadow camera re-samples the map every frame and edges shimmer.
    const texel = this.lighting.shadowTexel;
    const sx = Math.round(p.x / texel) * texel;
    const sz = Math.round(p.z / texel) * texel;
    const distance = 2500;

    this.lighting.sun.position.set(
      sx + direction.x * distance,
      p.y + direction.y * distance,
      sz + direction.z * distance,
    );
    this.lighting.sun.target.position.set(sx, p.y, sz);
    this.lighting.sun.target.updateMatrixWorld();
  }
}
