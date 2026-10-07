import {
  BackSide,
  CubeCamera,
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
import { type AtmosphereState } from "@takustaqu/atmosphere";
import fragment from "../vendor/atmosphere/fragment.glsl?raw";
import { noiseLattice, NOISE_SIZE } from "../vendor/atmosphere/noise";
/** Adapter around the actual upstream FRAG. Changes are only ray input and
 * scene-linear output. No new cloud/sky model; no second tone map. */
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
      .replace(ray, "vec3 rd = normalize(vSkyDirection);") +
    "\n gl_FragColor=vec4(max(sky,vec3(0.))*exp2(uSkyExposure),1.);\n}\n"
  );
}
export class AtmosphereSky {
  readonly scene = new Scene();
  readonly target: WebGLCubeRenderTarget;
  readonly camera: CubeCamera;
  readonly material: ShaderMaterial;
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;
  readonly noise: DataTexture;
  readonly display: Mesh<SphereGeometry, ShaderMaterial>;
  renders = 0;
  private last = -100;
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
    this.target = new WebGLCubeRenderTarget(size, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
    this.camera = new CubeCamera(0.1, 10, this.target);
    this.display = new Mesh(
      new SphereGeometry(1000, 24, 16),
      new ShaderMaterial({
        uniforms: { uEnvironment: { value: this.target.texture } },
        vertexShader:
          "varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}",
        fragmentShader:
          "uniform samplerCube uEnvironment;varying vec3 dir;void main(){gl_FragColor=vec4(textureCube(uEnvironment,normalize(dir)).rgb,1.);}",
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
  update(
    s: AtmosphereState,
    time: number,
    wind: number,
    evo: number,
    exposure: number,
    force = false,
  ) {
    if (!force && time - this.last < 0.3) return false;
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
    this.camera.update(this.renderer, this.scene);
    this.last = time;
    this.renders++;
    return true;
  }
  dispose() {
    this.noise.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.display.geometry.dispose();
    this.display.material.dispose();
    this.target.dispose();
  }
}
