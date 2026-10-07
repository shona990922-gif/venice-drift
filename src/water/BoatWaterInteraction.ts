import { Vector3 } from "three";
import type { DynamicRippleSystem } from "./DynamicRippleSystem";
import type { CanalSettings } from "./v2/Presets";
/** Ten waterline volume samples. The union is handled by upstream moveSpheres,
 * preventing overlap from creating multiple copies of the displaced volume. */
export class BoatWaterInteraction {
  readonly positions = {
    bow: new Vector3(),
    left: new Vector3(),
    right: new Vector3(),
    stern: new Vector3(),
  };
  readonly velocity = new Vector3();
  readonly centers: Vector3[] = [];
  readonly radii: number[] = [];
  enabled = true;
  count = 0;
  private old: Vector3[] = [];
  private previousPosition: Vector3 | null = null;
  private impulseDistance = 0;
  private low = false;
  constructor(low = false) {
    this.low = low;
  }
  reset() {
    this.old = [];
    this.previousPosition = null;
    this.impulseDistance = 0;
    this.velocity.set(0, 0, 0);
  }
  update(
    position: Vector3,
    forward: Vector3,
    speed: number,
    sim: Pick<DynamicRippleSystem, "createRipple"> &
      Partial<Pick<DynamicRippleSystem, "moveHull" | "enqueue">>,
    settings: CanalSettings,
  ) {
    const side = new Vector3(-forward.z, 0, forward.x);
    this.velocity.copy(forward).multiplyScalar(speed);
    // BoatVisual extends 5.15 m forward and 4.85 m aft. The old emitters
    // were underneath its raised tips, hiding the first outward wave.
    this.positions.bow.copy(position).addScaledVector(forward, 5.18);
    this.positions.stern.copy(position).addScaledVector(forward, -4.95);
    this.positions.left.copy(position).addScaledVector(side, -0.76);
    this.positions.right.copy(position).addScaledVector(side, 0.76);
    const layout = this.low
      ? [
          [4.95, 0, 0.38],
          [1.4, -0.67, 0.53],
          [1.4, 0.67, 0.53],
          [-1.6, -0.67, 0.5],
          [-1.6, 0.67, 0.5],
          [-4.65, 0, 0.38],
        ]
      : [
          [4.95, 0, 0.36],
          [3.8, 0, 0.49],
          [2.1, -0.7, 0.5],
          [2.1, 0.7, 0.5],
          [0.1, -0.75, 0.53],
          [0.1, 0.75, 0.53],
          [-2, -0.65, 0.5],
          [-2, 0.65, 0.5],
          [-3.8, 0, 0.48],
          [-4.65, 0, 0.34],
        ];
    this.centers.length = 0;
    this.radii.length = 0;
    for (const [along, lateral, radius] of layout) {
      const p = position
        .clone()
        .addScaledVector(forward, along)
        .addScaledVector(side, lateral);
      p.y = -0.11;
      this.centers.push(p);
      this.radii.push(radius);
    }
    const gain =
      Math.min(1.5, Math.max(0, speed / 1.55)) * settings.interaction;
    if (
      !this.enabled ||
      speed < 0.05 ||
      this.old.length !== this.centers.length
    ) {
      this.old = this.centers.map((p) => p.clone());
      this.previousPosition = position.clone();
      this.impulseDistance = 0;
      return;
    }
    if (this.old[0].distanceTo(this.centers[0]) > 3) {
      this.reset();
      this.old = this.centers.map((p) => p.clone());
      this.previousPosition = position.clone();
      return;
    }
    // Upstream moveSpheres already scales the displaced volume by 0.1.
    // Keep a centimetre-scale waterline response, without amplifying the
    // optical shader or repainting the water. Side control now affects drag.
    sim.moveHull?.(
      this.old,
      this.centers,
      this.radii,
      0.1 * gain * settings.side,
    );
    this.count++;
    this.old = this.centers.map((p) => p.clone());
    const previous = this.previousPosition ?? position;
    const travelled = previous.distanceTo(position);
    const spacing = 0.24;
    // Emit by travelled distance, including the remainder, rather than once
    // per render frame. A 30 Hz render must leave the same trail as 120 Hz.
    let next = spacing - this.impulseDistance;
    while (next <= travelled && travelled > 0) {
      const offset = previous
        .clone()
        .lerp(position, next / travelled)
        .sub(position);
      for (const [source, p, strength, radius] of [
        ["BOAT_BOW", this.positions.bow, -0.007 * settings.bow, 0.38],
        ["BOAT_STERN", this.positions.stern, -0.0045 * settings.stern, 0.34],
      ] as const) {
        const center = p.clone().add(offset);
        sim.enqueue?.({
          worldPosition: center,
          radius,
          strength: strength * gain,
          source,
        });
        sim.enqueue?.({
          worldPosition: center.clone().addScaledVector(forward, -0.3),
          radius,
          strength: -strength * gain,
          source,
        });
      }
      next += spacing;
    }
    this.impulseDistance = (this.impulseDistance + travelled) % spacing;
    this.previousPosition = position.clone();
  }
}
