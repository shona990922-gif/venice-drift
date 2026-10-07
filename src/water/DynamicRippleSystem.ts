import {
  BufferGeometry,
  Float32BufferAttribute,
  DoubleSide,
  Color,
  DataUtils,
  FloatType,
  HalfFloatType,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { Water } from "./vendor/b/Water";
import { RippleWindow, CanalMask } from "./RippleWindow";
import { RainImpactQueue, type WaterImpact } from "./WaterImpact";
const VERT =
  "varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}";
const MAX_DROPS = 24;
/** jeantimex's original ping-pong solver and normals, with an integration shell:
 * metre scale, bounded fixed ticks, integer scroll, canal boundary, batched drops.
 * Actual source G is velocity, despite the upstream Water.ts class comment. */
export class DynamicRippleSystem {
  readonly window: RippleWindow;
  readonly origin: Vector2;
  readonly span = 24;
  readonly b: Water;
  readonly output: WebGLRenderTarget;
  readonly maskTarget: WebGLRenderTarget;
  readonly queue = new RainImpactQueue(96);
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly debugImpacts: WaterImpact[] = [];
  private quad: Mesh<PlaneGeometry, ShaderMaterial>;
  private scroll: ShaderMaterial;
  private boundary: ShaderMaterial;
  private normal: ShaderMaterial;
  private drops: ShaderMaterial;
  private maskScene = new Scene();
  private maskMaterial: ShaderMaterial;
  private maskGeometry = new BufferGeometry();
  private maskOrigin = new Vector2(Infinity, Infinity);
  private clock = 0;
  private outputDirty = true;
  private hull: {
    old: Vector3[];
    next: Vector3[];
    radii: number[];
    gain: number;
  } | null = null;
  steps = 0;
  scrolls = 0;
  emissions = 0;
  waveSpeed = 1.15;
  dampingRate = 0.9;
  lastStep = 0;
  passes = 0;
  lastPasses = 0;
  injectedRain = 0;
  rejected = 0;
  hullPasses = 0;
  droppedTime = 0;
  constructor(
    readonly renderer: WebGLRenderer,
    readonly resolution = 256,
    readonly hz = 30,
    readonly mask?: CanalMask,
    halfFloat = false,
  ) {
    this.window = new RippleWindow(this.span, resolution);
    this.origin = this.window.origin;
    this.b = new Water(
      renderer,
      resolution,
      halfFloat ? HalfFloatType : undefined,
      12,
    );
    this.output = new WebGLRenderTarget(resolution, resolution, {
      type: this.b.textureA.texture.type,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
    });
    this.maskTarget = new WebGLRenderTarget(256, 256, {
      type: UnsignedByteType,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
    });
    this.maskMaterial = new ShaderMaterial({
      uniforms: { origin: { value: this.origin }, span: { value: this.span } },
      vertexShader:
        "uniform vec2 origin;uniform float span;void main(){gl_Position=vec4((position.xz-origin)/span*2.-1.,0.,1.);}",
      fragmentShader: "void main(){gl_FragColor=vec4(1.);}",
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const vertices: number[] = [];
    if (mask) {
      const rows = mask.samples;
      for (let i = 0; i < rows.length - 1; i++) {
        const a = rows[i],
          b = rows[i + 1],
          dir = b.p.clone().sub(a.p).normalize(),
          right = new Vector3(-dir.z, 0, dir.x);
        const al = a.p.clone().addScaledVector(right, a.width / 2 - 0.16),
          ar = a.p.clone().addScaledVector(right, -a.width / 2 + 0.16),
          bl = b.p.clone().addScaledVector(right, b.width / 2 - 0.16),
          br = b.p.clone().addScaledVector(right, -b.width / 2 + 0.16);
        for (const p of [al, ar, bl, ar, br, bl]) vertices.push(p.x, 0, p.z);
      }
    }
    this.maskGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(vertices, 3),
    );
    const maskMesh = new Mesh(this.maskGeometry, this.maskMaterial);
    maskMesh.frustumCulled = false;
    this.maskScene.add(maskMesh);
    const material = (
      fragmentShader: string,
      uniforms: ShaderMaterial["uniforms"],
    ) =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
    this.scroll = material(
      "uniform sampler2D field;uniform vec2 shift;varying vec2 uv0;void main(){vec2 uv=uv0+shift;float valid=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);gl_FragColor=texture2D(field,clamp(uv,0.,1.))*valid;}",
      { field: { value: null }, shift: { value: new Vector2() } },
    );
    this.boundary = material(
      "uniform sampler2D field,mask;varying vec2 uv0;void main(){vec4 v=texture2D(field,uv0);float edge=smoothstep(0.,.055,min(min(uv0.x,uv0.y),min(1.-uv0.x,1.-uv0.y)));v.rg*=edge*texture2D(mask,uv0).r;v.rg=clamp(v.rg,vec2(-.06),vec2(.06));gl_FragColor=v;}",
      { field: { value: null }, mask: { value: this.maskTexture } },
    );
    this.normal = material(
      "uniform sampler2D field;varying vec2 uv0;void main(){vec4 v=texture2D(field,uv0);vec2 n=clamp(v.ba,vec2(-.45),vec2(.45));float y=sqrt(max(.1,1.-dot(n,n)));vec2 g=-n/y;gl_FragColor=vec4(g,clamp(length(g)*14.,0.,1.),v.r);}",
      { field: { value: null } },
    );
    // Exact cosine addDrop profile from WaterRipple.frag, evaluated for a bounded
    // batch in physical metres. Energy is area-corrected for sub-texel rain.
    this.drops = material(
      `uniform sampler2D field;uniform vec4 drops[${MAX_DROPS}];uniform int count;uniform vec2 origin;uniform float span;varying vec2 uv0;void main(){vec4 v=texture2D(field,uv0);vec2 p=origin+uv0*span;for(int i=0;i<${MAX_DROPS};i++){if(i>=count)break;float d=max(0.,1.-distance(p,drops[i].xy)/drops[i].z);d=.5-cos(d*3.14159265359)*.5;v.r+=d*drops[i].w;}gl_FragColor=v;}`,
      {
        field: { value: null },
        drops: {
          value: Array.from({ length: MAX_DROPS }, () => new Vector4()),
        },
        count: { value: 0 },
        origin: { value: this.origin },
        span: { value: this.span },
      },
    );
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.scroll);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.clear();
  }
  get read() {
    return this.b.textureA;
  }
  get write() {
    return this.b.textureB;
  }
  get texture() {
    return this.read.texture;
  }
  get textureType() {
    return this.read.texture.type === FloatType ? "Float32" : "Float16";
  }
  private pass(m: ShaderMaterial, target: WebGLRenderTarget) {
    const previous = this.renderer.getRenderTarget();
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(previous);
    this.passes++;
  }
  centerOn(p: Vector3) {
    const shift = this.window.move(p);
    if (shift.lengthSq() > 0) {
      this.scroll.uniforms.field.value = this.read.texture;
      this.scroll.uniforms.shift.value.copy(shift);
      this.pass(this.scroll, this.write);
      this.b.swapTextures();
      this.scrolls++;
      this.outputDirty = true;
    }
  }
  get maskTexture() {
    return this.maskTarget.texture;
  }
  private updateMask() {
    if (this.maskOrigin.equals(this.origin)) return;
    this.maskOrigin.copy(this.origin);
    const previous = this.renderer.getRenderTarget(),
      color = new Color();
    this.renderer.getClearColor(color);
    const alpha = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(this.maskTarget);
    this.renderer.setClearColor(this.mask ? 0 : 0xffffff, 1);
    this.renderer.clear();
    if (this.mask) this.renderer.render(this.maskScene, this.camera);
    this.renderer.setRenderTarget(previous);
    this.renderer.setClearColor(color, alpha);
    this.passes++;
  }
  enqueue(impact: WaterImpact) {
    if (
      !Number.isFinite(impact.strength) ||
      !Number.isFinite(impact.radius) ||
      impact.radius <= 0
    )
      return;
    const p = impact.worldPosition;
    if (this.mask) {
      const hit = this.mask.test(p.x, p.z);
      if (!hit.inside || (impact.source === "RAIN" && hit.covered)) {
        this.rejected++;
        return;
      }
    }
    this.queue.push(impact);
    this.emissions++;
    this.debugImpacts.push({ ...impact, worldPosition: p.clone() });
    if (this.debugImpacts.length > 32) this.debugImpacts.shift();
  }
  createRipple(p: Vector3, strength = 0.008, radius = 0.4) {
    this.enqueue({ worldPosition: p, radius, strength, source: "DEBUG" });
  }
  moveHull(
    oldCenters: Vector3[],
    newCenters: Vector3[],
    radii: number[],
    gain: number,
  ) {
    if (gain <= 0) return;
    this.hull = {
      old: (this.hull?.old ?? oldCenters).map((p) => p.clone()),
      next: newCenters.map((p) => p.clone()),
      radii: [...radii],
      gain,
    };
  }
  private flush() {
    if (this.hull) {
      const h = this.hull,
        offset = new Vector3(
          this.origin.x + this.span / 2,
          0,
          this.origin.y + this.span / 2,
        );
      this.b.moveSpheres(
        h.old.map((p) => p.clone().sub(offset)),
        h.next.map((p) => p.clone().sub(offset)),
        h.radii,
        h.gain,
        this.span / 2,
        this.span / 2,
      );
      this.hull = null;
      this.passes++;
      this.hullPasses++;
    }
    const events = this.queue.consume(MAX_DROPS),
      values = this.drops.uniforms.drops.value as Vector4[];
    let count = 0;
    for (const e of events) {
      if (!this.window.contains(e.worldPosition)) continue;
      const r = Math.max(e.radius, this.window.cell * 1.6),
        energy = Math.min(1, (e.radius / r) ** 2);
      values[count++].set(
        e.worldPosition.x,
        e.worldPosition.z,
        r,
        e.strength * energy,
      );
      if (e.source === "RAIN") this.injectedRain++;
    }
    if (count) {
      this.drops.uniforms.field.value = this.read.texture;
      this.drops.uniforms.count.value = count;
      this.pass(this.drops, this.write);
      this.b.swapTextures();
    }
  }
  update(dt: number, boat: Vector3) {
    const before = this.passes;
    this.centerOn(boat);
    this.updateMask();
    this.clock += Math.min(0.1, dt);
    const tick = 1 / this.hz;
    let count = 0;
    while (this.clock >= tick && count < 3) {
      count++;
      const previous = this.renderer.getRenderTarget();
      this.flush();
      const subdt = tick / 2,
        c = Math.min(0.45, ((this.waveSpeed * subdt) / this.window.cell) ** 2);
      this.b.configure(c, Math.exp(-this.dampingRate * subdt));
      this.b.stepSimulation(this.span / 2, this.span / 2);
      this.b.stepSimulation(this.span / 2, this.span / 2);
      this.passes += 2;
      this.boundary.uniforms.field.value = this.read.texture;
      this.pass(this.boundary, this.write);
      this.b.swapTextures();
      this.b.updateNormals(this.span / 2, this.span / 2);
      this.passes++;
      this.renderer.setRenderTarget(previous);
      this.clock -= tick;
      this.steps++;
      this.outputDirty = true;
    }
    if (this.clock >= tick) {
      this.droppedTime += this.clock;
      this.clock = 0;
    }
    if (this.outputDirty) {
      this.normal.uniforms.field.value = this.read.texture;
      this.pass(this.normal, this.output);
      this.outputDirty = false;
    }
    this.lastPasses = this.passes - before;
    this.lastStep = count > 1 ? this.hz : 0;
  }
  clear() {
    this.queue.clear();
    this.hull = null;
    this.b.clearTextures();
    const previous = this.renderer.getRenderTarget(),
      color = new Color();
    this.renderer.getClearColor(color);
    const alpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0, 0);
    this.renderer.setRenderTarget(this.output);
    this.renderer.clear();
    this.renderer.setRenderTarget(previous);
    this.renderer.setClearColor(color, alpha);
    this.clock = 0;
    this.window.reset();
    this.maskOrigin.set(Infinity, Infinity);
    this.outputDirty = true;
  }
  sample() {
    if (this.read.texture.type === HalfFloatType) {
      const raw = new Uint16Array(this.resolution ** 2 * 4);
      this.renderer.readRenderTargetPixels(
        this.read,
        0,
        0,
        this.resolution,
        this.resolution,
        raw,
      );
      return Float32Array.from(raw, DataUtils.fromHalfFloat);
    }
    const data = new Float32Array(this.resolution ** 2 * 4);
    this.renderer.readRenderTargetPixels(
      this.read,
      0,
      0,
      this.resolution,
      this.resolution,
      data,
    );
    return data;
  }
  dispose() {
    this.b.dispose();
    this.output.dispose();
    this.maskTarget.dispose();
    this.maskMaterial.dispose();
    this.maskGeometry.dispose();
    this.scroll.dispose();
    this.boundary.dispose();
    this.normal.dispose();
    this.drops.dispose();
    this.quad.geometry.dispose();
  }
}
