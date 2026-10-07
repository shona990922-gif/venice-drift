import {
  BackSide,
  CubeCamera,
  Matrix3,
  Matrix4,
  Quaternion,
  type PerspectiveCamera,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLCubeRenderTarget,
  WebGLRenderer,
} from "three";
import { SkyFrameBlend } from "./SkyFrameBlend";
import { type AtmosphereState } from "@takustaqu/atmosphere";
import fragment from "../vendor/atmosphere/fragment.glsl?raw";
import { noiseLattice, NOISE_SIZE } from "../vendor/atmosphere/noise";
/** Adapter around the actual upstream FRAG: world rays, scene-linear output
 * and a tighter photographic solar glare. The cloud/sky model is upstream. */
export function atmosphereFragment() {
  const ray =
    "vec3 rd = viewRay(p * 2.0 - 1.0, u_cam.x, u_cam.y, u_cam.z, aspect);";
  if (!fragment.includes(ray)) throw Error("Atmosphere source seam changed");
  const tail = fragment.indexOf("  // ── Linear light → display ──");
  if (tail < 0) throw Error("Atmosphere output seam changed");
  return (
    "#define NOISE_FETCH(uv) textureLod(u_noise,(uv),0.0)\nvarying vec3 vSkyDirection;uniform float uSkyExposure;\n" +
    fragment
      .slice(0, tail)
      .replace(/\bpatch\b/g, "cloudPatch")
      .replace(/\bactive\b/g, "dropActive")
      // The demo's wide solar core reads as a large white blob at passenger FOV.
      // Halve its angular extent; retain the original scattering halo/lighting.
      .replace("sunAng * sunAng * 900.0", "sunAng * sunAng * 3600.0")
      .replace(ray, "vec3 rd = normalize(vSkyDirection);") +
    "\n gl_FragColor=vec4(max(sky,vec3(0.))*exp2(uSkyExposure),1.);\n}\n"
  );
}
/** Shared lookup for the sky dome AND the water fallback. Reproject only the
 * solar neighbourhood so two cached discs stay on the continuously moving sun.
 * Clouds away from the sun remain world anchored; their samples just crossfade. */
export const SKY_SAMPLE_GLSL = `
uniform samplerCube uSkyPrevious,uSkyCurrent;
uniform float uSkyBlend;
uniform vec3 uSkyLiveSun;
uniform mat3 uSkyWarpPrevious,uSkyWarpCurrent;
vec3 sampleVeniceSky(vec3 ray){
  ray=normalize(ray);
  float solar=smoothstep(.9396926,.9945219,dot(ray,uSkyLiveSun));
  vec3 a=normalize(mix(ray,uSkyWarpPrevious*ray,solar));
  vec3 b=normalize(mix(ray,uSkyWarpCurrent*ray,solar));
  return mix(textureCube(uSkyPrevious,a).rgb,textureCube(uSkyCurrent,b).rgb,uSkyBlend);
}
`;
export class AtmosphereSky {
  readonly scene = new Scene();
  readonly targets: WebGLCubeRenderTarget[];
  readonly timeline = new SkyFrameBlend();
  readonly sampleUniforms: ShaderMaterial["uniforms"];
  get target() {
    return this.targets[this.timeline.current];
  }
  readonly camera: CubeCamera;
  readonly material: ShaderMaterial;
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;
  readonly noise: DataTexture;
  readonly display: Mesh<SphereGeometry, ShaderMaterial>;
  renders = 0;
  frameFaces = 0;
  totalFaces = 0;
  private initialized = false;
  private sunAtCapture = [new Vector3(), new Vector3(), new Vector3()];
  private liveSun = new Vector3();
  private rotation = new Quaternion();
  private matrix = new Matrix4();
  constructor(
    readonly renderer: WebGLRenderer,
    size = 256,
  ) {
    this.noise = new DataTexture(
      noiseLattice(),
      NOISE_SIZE,
      NOISE_SIZE,
      RedFormat,
      UnsignedByteType,
    );
    this.noise.wrapS = this.noise.wrapT = RepeatWrapping;
    this.noise.minFilter = this.noise.magFilter = LinearFilter;
    this.noise.generateMipmaps = false;
    this.noise.colorSpace = NoColorSpace;
    this.noise.needsUpdate = true;
    const uniforms: ShaderMaterial["uniforms"] = {
      u_noise: { value: this.noise },
      u_frame: { value: new Vector4(0, 0, size, size) },
      u_aspect: { value: 1 },
      u_cam: { value: new Vector3(0, 0, Math.PI / 2) },
      u_sun: { value: new Vector2() },
      u_high: { value: new Vector3() },
      u_mid: { value: new Vector3() },
      u_low: { value: new Vector4() },
      u_cbFeat: { value: new Vector2() },
      u_filtTint: { value: new Vector3(1, 1, 1) },
      u_tone: { value: new Vector4(0, 1, 0.8, 0) },
      u_pol: { value: new Vector4() },
      u_sky: { value: new Vector4(7, 0, 0, 0) },
      u_radiant: { value: new Vector2() },
      uSkyExposure: { value: 0 },
    };
    for (const key of [
      "time",
      "cover",
      "rain",
      "snow",
      "wind",
      "thunder",
      "haze",
      "windOff",
      "evo",
      "filtAmt",
      "filtSat",
      "filtLift",
      "p3",
      "headroom",
      "lensDrops",
      "lensFx",
      "fall",
    ])
      uniforms["u_" + key] = { value: 0 };
    uniforms.u_headroom.value = 1;
    uniforms.u_filtSat.value = 1;
    this.material = new ShaderMaterial({
      uniforms,
      vertexShader:
        "varying vec3 vSkyDirection;void main(){vSkyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: atmosphereFragment(),
      side: BackSide,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(new SphereGeometry(5, 16, 12), this.material);
    this.scene.add(this.mesh);
    this.targets = Array.from(
      { length: 3 },
      () =>
        new WebGLCubeRenderTarget(size, {
          type: HalfFloatType,
          minFilter: LinearFilter,
          magFilter: LinearFilter,
          generateMipmaps: false,
          depthBuffer: false,
        }),
    );
    this.camera = new CubeCamera(0.1, 10, this.target);
    this.sampleUniforms = {
      uSkyPrevious: { value: this.target.texture },
      uSkyCurrent: { value: this.target.texture },
      uSkyBlend: { value: 1 },
      uSkyLiveSun: { value: this.liveSun },
      uSkyWarpPrevious: { value: new Matrix3() },
      uSkyWarpCurrent: { value: new Matrix3() },
    };
    this.display = new Mesh(
      new SphereGeometry(1000, 24, 16),
      new ShaderMaterial({
        uniforms: this.sampleUniforms,
        vertexShader:
          "varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}",
        fragmentShader:
          SKY_SAMPLE_GLSL +
          "varying vec3 dir;void main(){gl_FragColor=vec4(sampleVeniceSky(dir),1.);}",
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.display.frustumCulled = false;
    this.display.layers.enable(1);
    this.display.layers.enable(2);
    this.display.renderOrder = -100;
  }
  private setCaptureState(
    s: AtmosphereState,
    time: number,
    wind: number,
    evo: number,
    exposure: number,
  ) {
    const u = this.material.uniforms,
      c = s.clouds;
    u.u_time.value = time % 4096;
    u.u_sun.value.set(s.sunElevation, s.sunAzimuth);
    u.u_cover.value = s.cloudCover;
    u.u_high.value.set(c.cirrus, c.cirrostratus, c.cirrocumulus);
    u.u_mid.value.set(c.altostratus, c.altocumulus, c.nimbostratus);
    u.u_low.value.set(c.stratus, c.stratocumulus, c.cumulus, c.cumulonimbus);
    u.u_rain.value = s.rain;
    u.u_wind.value = s.wind;
    u.u_haze.value = s.haze;
    u.u_cbFeat.value.set(s.features.anvil, s.features.velum);
    u.u_windOff.value = wind;
    u.u_evo.value = evo;
    u.u_sky.value.set(s.celestial.bortle, 0, 0, 0);
    u.uSkyExposure.value = exposure;
  }
  private renderFace(face: number, target: WebGLCubeRenderTarget) {
    // Same orientations/state restoration as Three.js CubeCamera.update;
    // spread its six renders over separate animation frames.
    const r = this.renderer,
      previous = r.getRenderTarget(),
      previousFace = r.getActiveCubeFace(),
      mip = r.getActiveMipmapLevel(),
      xr = r.xr.enabled;
    if (this.camera.coordinateSystem !== r.coordinateSystem) {
      this.camera.coordinateSystem = r.coordinateSystem;
      this.camera.updateCoordinateSystem();
    }
    this.camera.updateMatrixWorld();
    try {
      r.xr.enabled = false;
      r.setRenderTarget(target, face, 0);
      r.render(this.scene, this.camera.children[face] as PerspectiveCamera);
    } finally {
      r.setRenderTarget(previous, previousFace, mip);
      r.xr.enabled = xr;
    }
    this.frameFaces++;
    this.totalFaces++;
  }
  update(
    s: AtmosphereState,
    time: number,
    wind: number,
    evo: number,
    exposure: number,
    force = false,
  ) {
    this.frameFaces = 0;
    const h = Math.cos(s.sunElevation);
    this.liveSun.set(
      h * Math.sin(s.sunAzimuth),
      Math.sin(s.sunElevation),
      h * Math.cos(s.sunAzimuth),
    );
    let published: boolean;
    if (!this.initialized || force) {
      this.timeline.reset(time);
      this.setCaptureState(s, time, wind, evo, exposure);
      this.sunAtCapture[0].copy(this.liveSun);
      // Only the initial pre-journey bake is synchronous.
      for (let face = 0; face < 6; face++) this.renderFace(face, this.target);
      this.initialized = true;
      this.renders++;
      published = true;
    } else {
      published = this.timeline.tick(time);
      if (published) this.renders++;
      const face = this.timeline.pendingFace;
      // Keep a publication frame free for amortised IBL work as well.
      if (face !== null && !published) {
        if (face === 0) {
          this.setCaptureState(s, time, wind, evo, exposure);
          this.sunAtCapture[this.timeline.writing].copy(this.liveSun);
        }
        this.renderFace(face, this.targets[this.timeline.writing]);
        this.timeline.completeFace();
      }
    }
    const u = this.sampleUniforms;
    u.uSkyPrevious.value = this.targets[this.timeline.previous].texture;
    u.uSkyCurrent.value = this.target.texture;
    u.uSkyBlend.value = this.timeline.blend;
    for (const [name, slot] of [
      ["uSkyWarpPrevious", this.timeline.previous],
      ["uSkyWarpCurrent", this.timeline.current],
    ] as const) {
      this.rotation.setFromUnitVectors(this.liveSun, this.sunAtCapture[slot]);
      this.matrix.makeRotationFromQuaternion(this.rotation);
      (u[name].value as Matrix3).setFromMatrix4(this.matrix);
    }
    return published;
  }
  invalidate() {
    this.initialized = false;
  }
  dispose() {
    this.noise.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.display.geometry.dispose();
    this.display.material.dispose();
    for (const target of this.targets) target.dispose();
  }
}
