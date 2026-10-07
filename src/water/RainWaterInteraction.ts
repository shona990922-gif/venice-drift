import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  LineSegments,
  ShaderMaterial,
  Vector3,
} from "three";
import type { DynamicRippleSystem } from "./DynamicRippleSystem";
import type { WaterQuality } from "./v2/Presets";
/** The rendered streak and its queued impact share one world-space position.
 * No rain raycasts; canopy/bridge and canal checks are cheap route tests. */
export class RainWaterInteraction {
  readonly mesh: LineSegments<BufferGeometry, ShaderMaterial>;
  readonly particles: Vector3[] = [];
  readonly impactsPerFrame: number;
  impacts = 0;
  collisions = 0;
  sampledOut = 0;
  enabled = true;
  particlesVisible = true;
  private positions: Float32Array;
  private roofs = new WeakMap<Vector3, boolean>();
  private initialized = false;
  private elapsed = 0;
  private seed = 9417;
  constructor(
    readonly simulation: DynamicRippleSystem,
    readonly quality: WaterQuality = "medium",
  ) {
    const count = quality === "low" ? 420 : quality === "high" ? 1000 : 720;
    this.impactsPerFrame = quality === "low" ? 2 : quality === "high" ? 8 : 4;
    this.positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) this.particles.push(new Vector3());
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage),
    );
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      uniforms: { opacity: { value: 0.18 } },
      vertexShader:
        "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "uniform float opacity;void main(){gl_FragColor=vec4(.5,.58,.64,opacity);}",
    });
    this.mesh = new LineSegments(geometry, material);
    this.mesh.name = "Light rain / world impact positions";
    this.mesh.frustumCulled = false;
  }
  private random() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private spawn(p: Vector3, eye: Vector3, initial = false) {
    p.set(
      eye.x + (this.random() - 0.5) * 24,
      initial ? this.random() * 13 : 11 + this.random() * 3,
      eye.z + (this.random() - 0.5) * 24,
    );
    this.roofs.set(p, this.simulation.mask?.test(p.x, p.z).covered ?? false);
  }
  update(dt: number, intensity: number, wind: number, eye: Vector3) {
    if (!this.initialized) {
      for (const p of this.particles) this.spawn(p, eye, true);
      this.initialized = true;
    }
    this.elapsed += dt;
    const count = Math.floor(
      this.particles.length * Math.max(0, Math.min(1, intensity / 0.45)),
    );
    let sampled = 0;
    this.mesh.visible = this.particlesVisible && intensity > 0.002;
    this.mesh.geometry.setDrawRange(0, count * 2);
    this.mesh.material.uniforms.opacity.value =
      0.16 * Math.min(1, intensity / 0.08);
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const fall = 6.8 + (i % 13) * 0.12,
        dx = wind * 0.09,
        dz = wind * 0.04;
      // Intersect this exact rendered trajectory with the known water plane.
      const oldY = p.y;
      p.x += dx * dt;
      p.y -= fall * dt;
      p.z += dz * dt;
      if (p.y <= 0) {
        this.collisions++;
        const overshoot = -p.y / fall,
          hit = p.clone();
        hit.x -= dx * overshoot;
        hit.z -= dz * overshoot;
        hit.y = 0;
        if (this.enabled && sampled < this.impactsPerFrame && oldY >= 0) {
          const test = this.simulation.mask?.test(hit.x, hit.z);
          if (!test || (test.inside && !test.covered)) {
            this.simulation.enqueue({
              worldPosition: hit,
              radius: 0.055 + this.random() * 0.04,
              // Compensate coarse-grid area filtering: Low otherwise rounds
              // sub-texel rain away before it affects a reflection pixel.
              // The result remains around a millimetre, far below the hull.
              strength: -0.0014 * (this.quality === "low" ? 12 : 1),
              source: "RAIN",
            });
            sampled++;
            this.impacts++;
          }
        } else this.sampledOut++;
        this.spawn(p, eye);
      } else if (Math.abs(p.x - eye.x) > 14 || Math.abs(p.z - eye.z) > 14)
        this.spawn(p, eye);
      const k = i * 6;
      this.positions[k] = p.x;
      const visibleY = this.roofs.get(p) && p.y < 5.5 ? -100 : p.y;
      this.positions[k + 1] = visibleY;
      this.positions[k + 2] = p.z;
      this.positions[k + 3] = p.x - dx * 0.03;
      this.positions[k + 4] = visibleY + fall * 0.03;
      this.positions[k + 5] = p.z - dz * 0.03;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
