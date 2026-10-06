import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import data from '../../routes/venice-route-01.json';
export const ROUTE = data;
export const wrap = (n: number, length: number) => ((n % length) + length) % length;
export function shortestDistance(a: number, b: number, length: number) {
  return Math.abs(wrap(a - b + length / 2, length) - length / 2);
}
export class RouteController {
  readonly curve = new CatmullRomCurve3(data.points.map(p => new Vector3(...p as [number, number, number])), true, 'centripetal');
  readonly length: number;
  distance = 0;
  totalDistance = 0;
  speed = data.cruiseSpeed;
  readonly position = new Vector3();
  readonly tangent = new Vector3();
  yaw = 0;
  curvature = 0;
  private ahead = new Vector3();
  constructor() {
    // Include every spline knot in the arc-length LUT to avoid tiny speed steps.
    this.curve.arcLengthDivisions = data.points.length * 1024;
    this.curve.updateArcLengths();
    this.length = this.curve.getLength();
    this.sample();
  }
  pointAtDistance(distance: number, target = new Vector3()) {
    return this.curve.getPointAt(wrap(distance, this.length) / this.length, target);
  }
  tangentAtDistance(distance: number, target = new Vector3()) {
    return this.curve.getTangentAt(wrap(distance, this.length) / this.length, target);
  }
  sample() {
    this.pointAtDistance(this.distance, this.position);
    this.tangentAtDistance(this.distance, this.tangent);
    // The gondola's local forward is -Z. LookRig owns the passenger's yaw.
    this.yaw = Math.atan2(-this.tangent.x, -this.tangent.z);
  }
  update(dt: number) {
    this.tangentAtDistance(this.distance + 6, this.ahead);
    this.curvature = Math.acos(MathUtils.clamp(this.tangent.dot(this.ahead), -1, 1)) / 6;
    const bridgeDistance = shortestDistance(this.distance, data.bridgeDistance, this.length);
    const bridgeSlow = 1 - 0.17 * (1 - MathUtils.smoothstep(bridgeDistance, 3, 15));
    const turnSlow = 1 - MathUtils.clamp(this.curvature * 2.5, 0, 0.18);
    const target = data.cruiseSpeed * Math.min(bridgeSlow, turnSlow);
    this.speed = MathUtils.damp(this.speed, target, 1.4, dt);
    const travel = this.speed * dt;
    this.distance = wrap(this.distance + travel, this.length);
    this.totalDistance += travel;
    this.sample();
  }
  seek(distance: number) { this.distance = wrap(distance, this.length); this.sample(); }
}
