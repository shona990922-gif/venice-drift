import { Vector2, Vector3 } from "three";
import { RouteController, ROUTE } from "../journey/RouteController";
/** Integer-texel moves only; the window never rotates with the boat. */
export class RippleWindow {
  readonly origin = new Vector2();
  private initialized = false;
  constructor(
    readonly span = 24,
    readonly resolution = 256,
  ) {}
  get cell() {
    return this.span / this.resolution;
  }
  move(position: Vector3) {
    const next = new Vector2(
      Math.floor((position.x - this.span / 2) / this.cell) * this.cell,
      Math.floor((position.z - this.span / 2) / this.cell) * this.cell,
    );
    const shift = this.initialized
      ? next.clone().sub(this.origin).divideScalar(this.span)
      : new Vector2();
    this.origin.copy(next);
    this.initialized = true;
    return shift;
  }
  worldToUV(p: Vector3, target = new Vector2()) {
    return target.set(
      (p.x - this.origin.x) / this.span,
      (p.z - this.origin.y) / this.span,
    );
  }
  contains(p: Vector3) {
    const uv = this.worldToUV(p);
    return uv.x >= 0 && uv.y >= 0 && uv.x <= 1 && uv.y <= 1;
  }
  reset() {
    this.initialized = false;
  }
}
export interface CanalHit {
  inside: boolean;
  distance: number;
  lateral: number;
  covered: boolean;
}
/** Segment proximity in metres, no per-raindrop mesh raycasts. */
export class CanalMask {
  readonly samples: { p: Vector3; width: number; distance: number }[] = [];
  constructor(readonly route: RouteController) {
    for (let d = -12; d <= route.length + 13; d += 1)
      this.samples.push({
        p: route.pointAtDistance(d),
        width: route.widthAt(d),
        distance: d,
      });
  }
  test(x: number, z: number, nearDistance?: number): CanalHit {
    let best = Infinity,
      distance = 0,
      lateral = 0,
      width = 0;
    const begin =
        nearDistance === undefined
          ? 0
          : Math.max(0, Math.floor(nearDistance + 12 - 36)),
      end =
        nearDistance === undefined
          ? this.samples.length - 1
          : Math.min(
              this.samples.length - 1,
              Math.ceil(nearDistance + 12 + 36),
            );
    for (let i = begin; i < end; i++) {
      const a = this.samples[i],
        b = this.samples[i + 1];
      if (
        nearDistance !== undefined &&
        Math.abs(a.distance - nearDistance) > 36
      )
        continue;
      const dx = b.p.x - a.p.x,
        dz = b.p.z - a.p.z;
      const f = Math.max(
        0,
        Math.min(
          1,
          ((x - a.p.x) * dx + (z - a.p.z) * dz) / (dx * dx + dz * dz),
        ),
      );
      const px = a.p.x + dx * f,
        pz = a.p.z + dz * f,
        dd = (x - px) ** 2 + (z - pz) ** 2;
      if (dd < best) {
        best = dd;
        distance = a.distance + f;
        const len = Math.hypot(dx, dz);
        lateral = ((x - px) * -dz + (z - pz) * dx) / len;
        width = a.width + (b.width - a.width) * f;
      }
    }
    return {
      inside: Math.sqrt(best) < width / 2 - 0.16,
      distance,
      lateral,
      covered: ROUTE.bridges.some(
        (b) =>
          Math.abs(b.distance - distance) < (b.style === 1 ? 1.35 : 1.85) + 0.5,
      ),
    };
  }
}
