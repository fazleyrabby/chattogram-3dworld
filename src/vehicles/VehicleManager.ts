import * as THREE from "three";
import type { HeightProvider } from "@/geography/WorldHeight";
import type { Player } from "@/player/Player";
import type { Input } from "@/player/Input";
import { Vehicle, type VehicleKind } from "@/vehicles/Vehicle";

const SUMMON_DISTANCE = 3.5;
const MOUNT_RANGE = 6;

/**
 * Owns the summonable vehicles (spec §42). Keys:
 *   C — summon car,  B — summon bicycle,  F — mount / dismount
 */
export class VehicleManager {
  private readonly car: Vehicle;
  private readonly bicycle: Vehicle;
  private active: Vehicle | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getHeight: HeightProvider,
  ) {
    this.car = new Vehicle("car");
    this.bicycle = new Vehicle("bicycle");
    this.scene.add(this.car.object, this.bicycle.object);
  }

  get mounted(): Vehicle | null {
    return this.active;
  }

  /** Teleports the requested vehicle to just in front of the player. */
  summon(kind: VehicleKind, player: Player): void {
    const vehicle = kind === "car" ? this.car : this.bicycle;
    if (this.active === vehicle) this.dismount(player);

    const x = player.position.x + Math.sin(player.facing) * SUMMON_DISTANCE;
    const z = player.position.z + Math.cos(player.facing) * SUMMON_DISTANCE;
    vehicle.place(x, z, player.facing, this.getHeight);
  }

  /** Mounts the nearest vehicle, or dismounts if already riding. */
  toggleMount(player: Player): boolean {
    if (this.active) {
      this.dismount(player);
      return false;
    }

    let best: Vehicle | null = null;
    let bestDistance = MOUNT_RANGE;
    for (const vehicle of [this.car, this.bicycle]) {
      if (!vehicle.isVisible) continue;
      const distance = vehicle.object.position.distanceTo(player.position);
      if (distance < bestDistance) {
        best = vehicle;
        bestDistance = distance;
      }
    }
    if (!best) return false;

    this.active = best;
    player.object.visible = true;
    return true;
  }

  /**
   * Keeps the rider on the vehicle: seats the avatar and faces it along the
   * vehicle's heading. Called every frame while riding.
   */
  syncRider(player: Player): void {
    const vehicle = this.active;
    if (!vehicle) return;
    const p = vehicle.object.position;
    const seatHeight = vehicle.kind === "car" ? 0.5 : 0.3;
    player.position.set(p.x, p.y + seatHeight, p.z);
    player.facing = vehicle.heading;
    player.sync();
  }

  private dismount(player: Player): void {
    const vehicle = this.active;
    if (!vehicle) return;

    const px = vehicle.object.position.x + Math.cos(vehicle.heading) * 1.4;
    const pz = vehicle.object.position.z - Math.sin(vehicle.heading) * 1.4;
    player.position.set(px, this.getHeight(px, pz), pz);
    player.velocity.set(0, 0, 0);
    player.object.visible = true;
    player.sync();

    this.active = null;
  }

  drive(delta: number, input: Input): void {
    if (!this.active) return;
    this.active.update(delta, input.moveForward, input.moveRight, this.getHeight);
  }

  /** Fills `out` with the ride camera target; returns false when not riding. */
  getCameraTarget(out: THREE.Vector3): boolean {
    if (!this.active) return false;
    this.active.getPosition(out);
    out.y += 1.3;
    return true;
  }
}
