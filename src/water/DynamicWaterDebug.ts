import {
  Box3,
  Box3Helper,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { DynamicRippleSystem } from "./DynamicRippleSystem";
import type { BoatWaterInteraction } from "./BoatWaterInteraction";
/** Development-only diagnostic views, never loaded by the journey entry. */
export class DynamicWaterDebug {
  readonly root = new Group();
  readonly screen = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly panel: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly boat: InstancedMesh;
  readonly impacts: Points<BufferGeometry, PointsMaterial>;
  readonly window: Box3Helper;
  constructor(readonly sim: DynamicRippleSystem) {
    this.panel = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          field: { value: sim.texture },
          mask: { value: sim.maskTexture },
          mode: { value: 0 },
        },
        vertexShader:
          "varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}",
        fragmentShader:
          "uniform sampler2D field,mask;uniform int mode;varying vec2 p;void main(){vec4 f=texture2D(field,p);vec3 c=vec3(.07,.1,.13)+vec3(max(f.r,0.),abs(f.g)*.5,max(-f.r,0.))*2500.;if(mode==1)c=vec3(.5+f.b*30.,.5,.5+f.a*30.);if(mode==2)c=vec3(texture2D(mask,p).r);gl_FragColor=vec4(c,1.);}",
      }),
    );
    this.screen.add(this.panel);
    this.boat = new InstancedMesh(
      new SphereGeometry(1, 12, 8),
      new MeshBasicMaterial({
        color: 0xffbd50,
        wireframe: true,
        depthTest: false,
      }),
      12,
    );
    this.boat.frustumCulled = false;
    this.boat.count = 0;
    this.impacts = new Points(
      new BufferGeometry(),
      new PointsMaterial({ color: 0x91dbf1, size: 0.12, depthTest: false }),
    );
    this.impacts.frustumCulled = false;
    this.window = new Box3Helper(new Box3(), 0xead088);
    this.root.add(this.boat, this.impacts, this.window);
    this.root.visible = false;
  }
  update(boat: BoatWaterInteraction) {
    const m = new Matrix4();
    this.boat.count = boat.centers.length;
    boat.centers.forEach((p, i) => {
      m.makeScale(boat.radii[i], boat.radii[i], boat.radii[i]);
      m.setPosition(p);
      this.boat.setMatrixAt(i, m);
    });
    this.boat.instanceMatrix.needsUpdate = true;
    this.impacts.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        this.sim.debugImpacts.flatMap((e) => [
          e.worldPosition.x,
          0.05,
          e.worldPosition.z,
        ]),
        3,
      ),
    );
    const p = this.sim.origin;
    this.window.box.set(
      new Vector3(p.x, 0.02, p.y),
      new Vector3(p.x + this.sim.span, 0.08, p.y + this.sim.span),
    );
  }
  render(renderer: WebGLRenderer, mode: number) {
    this.panel.material.uniforms.field.value = this.sim.texture;
    this.panel.material.uniforms.mode.value = mode;
    renderer.setRenderTarget(null);
    renderer.render(this.screen, this.camera);
  }
  dispose() {
    this.panel.geometry.dispose();
    this.panel.material.dispose();
    this.boat.geometry.dispose();
    (this.boat.material as MeshBasicMaterial).dispose();
    this.impacts.geometry.dispose();
    this.impacts.material.dispose();
    this.window.geometry.dispose();
    (this.window.material as MeshBasicMaterial).dispose();
  }
}

/** GPU readback test, isolated from the live scene and never changes its field. */
export function verifyRippleSolver(renderer: WebGLRenderer, halfFloat = false) {
  const sim = new DynamicRippleSystem(renderer, 256, 30, undefined, halfFloat),
    p = new Vector3(),
    dt = 1 / 30;
  const energy = () => {
    const data = sim.sample();
    let height = 0,
      normal = 0,
      peak = 0,
      finite = true;
    for (let i = 0; i < data.length; i += 4) {
      height += data[i] ** 2;
      normal += data[i + 2] ** 2 + data[i + 3] ** 2;
      peak = Math.max(peak, Math.abs(data[i]));
      finite &&= Number.isFinite(data[i]) && Number.isFinite(data[i + 2]);
    }
    return {
      height: height / (data.length / 4),
      normal: normal / (data.length / 4),
      peak,
      finite,
    };
  };
  sim.update(dt, p);
  sim.createRipple(p, -0.004, 0.25);
  sim.update(dt, p);
  const initial = energy();
  const before = sim.sample(),
    origin = sim.origin.clone(),
    moved = new Vector3(sim.window.cell * 3, 0, sim.window.cell * 2);
  sim.centerOn(moved);
  const shifted = sim.sample();
  let scrollError = 0;
  for (let y = 0; y < 250; y++)
    for (let x = 0; x < 250; x++) {
      const a = (y * 256 + x) * 4,
        b = ((y + 2) * 256 + x + 3) * 4;
      scrollError = Math.max(scrollError, Math.abs(shifted[a] - before[b]));
    }
  for (let i = 0; i < 30; i++) sim.update(dt, moved);
  const oneSecond = energy();
  for (let i = 0; i < 180; i++) sim.update(dt, moved);
  const sevenSeconds = energy();
  // Two fields at equal physical time with two different render cadences.
  const run = (fps: number) => {
    sim.clear();
    sim.update(0, p);
    sim.createRipple(p, -0.004, 0.25);
    for (let i = 0; i < fps * 2; i++) sim.update(1 / fps, p);
    return sim.sample();
  };
  const a = run(30),
    b = run(60);
  let cadenceError = 0;
  for (let i = 0; i < a.length; i++)
    cadenceError = Math.max(cadenceError, Math.abs(a[i] - b[i]));
  const result = {
    type: sim.textureType,
    resolution: sim.resolution,
    span: sim.span,
    initial,
    oneSecond,
    sevenSeconds,
    scrollTexels: [3, 2],
    originBefore: origin.toArray(),
    scrollError,
    cadenceError,
    pass:
      initial.peak > 0 &&
      oneSecond.finite &&
      sevenSeconds.finite &&
      scrollError < 1e-5 &&
      cadenceError < 1e-5 &&
      sevenSeconds.normal < oneSecond.normal * 0.3,
  };
  sim.dispose();
  return result;
}
