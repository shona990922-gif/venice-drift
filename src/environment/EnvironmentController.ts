import {
  Color,
  DirectionalLight,
  Fog,
  MathUtils,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { Sky } from "../water/v2/vendor/waterthreejs/Sky.js";
import type { WaterThreeCanal } from "../water/v2/WaterThreeCanal";
import type { VenetianKit } from "../city/VenetianKit";
import { canalAtmosphere } from "./Atmosphere";
const smooth = (x: number, a: number, b: number) =>
  MathUtils.smoothstep(x, a, b);
/** Every journey environment state is derived here, in linear radiometric space. */
export function environmentAt(progress: number) {
  const golden = smooth(progress, 0.43, 0.7),
    sunset = smooth(progress, 0.64, 0.85);
  return {
    elevation: MathUtils.lerp(MathUtils.lerp(58, 14, golden), 5.8, sunset),
    azimuth: MathUtils.lerp(148, 267, golden),
    intensity: MathUtils.lerp(MathUtils.lerp(4.6, 3.4, golden), 2.5, sunset),
    exposure: MathUtils.lerp(1.05, 1.12, sunset),
    ambient: MathUtils.lerp(1.1, 1.02, sunset),
    cloudCoverage: MathUtils.lerp(0.65, 0.86, golden),
    lights: smooth(progress, 0.55, 0.98) * 0.55,
    golden,
    sunset,
  };
}
export class EnvironmentController {
  readonly sun = new DirectionalLight("#fff1d9", 4.6);
  readonly sky: Sky;
  readonly direction = new Vector3();
  private target: any = null;
  private pmrem: PMREMGenerator;
  private lastIBL = -100;
  private lastShadow = -100;
  private kit?: VenetianKit;
  private warm = new Color("#ffb07d");
  private neutral = new Color("#fff1d9");
  private dayFog = new Color("#aabecb");
  private eveningFog = new Color("#b4a0ac");
  readonly cityLights = { value: 0 };
  elevation = 58;
  azimuth = 148;
  exposure = 1.05;
  progress = 0;
  state = environmentAt(0);
  constructor(
    readonly scene: Scene,
    readonly renderer: WebGLRenderer,
    readonly water: WaterThreeCanal,
  ) {
    this.pmrem = new PMREMGenerator(renderer);
    this.sky = new Sky(new Vector3(0, 1, 0));
    this.sky.mesh.material.vertexShader =
      this.sky.mesh.material.vertexShader.replace(
        "gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);gl_Position.z=gl_Position.w;",
      );
    this.sky.mesh.material.fragmentShader = canalAtmosphere(
      this.sky.mesh.material.fragmentShader,
    );
    water.mesh.material.fragmentShader = canalAtmosphere(
      water.mesh.material.fragmentShader,
    );
    water.mesh.material.needsUpdate = true;
    this.sky.mesh.layers.enable(1);
    this.sky.mesh.layers.enable(2);
    scene.add(this.sky.mesh, this.sun, this.sun.target);
    this.sun.layers.enable(1);
    this.sun.layers.enable(2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -38,
      right: 38,
      top: 38,
      bottom: -38,
      near: 1,
      far: 165,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.00012;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.autoUpdate = false;
    scene.fog = new Fog("#aabecb", 90, 280);
    this.setSun(58, 148);
    this.refreshIBL();
  }
  bindCity(kit: VenetianKit) {
    this.kit = kit;
    kit.lamp.emissive.set("#ffc085");
    kit.lamp.emissiveIntensity = 0;
    // One shared facade material, but a stable different switch-on threshold for
    // each opening. It reads world-space cells, so streaming never changes lights.
    kit.glass.onBeforeCompile = (s) => {
      s.uniforms.uCityLights = this.cityLights;
      s.vertexShader =
        "attribute float _light_seed;varying float vWindowSeed;\n" +
        s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWindowSeed=_light_seed;",
      );
      s.fragmentShader =
        "uniform float uCityLights;varying float vWindowSeed;\n" +
        s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
    float seed=vWindowSeed;
    float lit=smoothstep(seed,seed+.12,uCityLights)*smoothstep(0.,.08,uCityLights);
    totalEmissiveRadiance+=vec3(1.,.40,.11)*lit*.55;`,
      );
    };
    kit.glass.customProgramCacheKey = () => "venice-evening-windows-v1";
    kit.glass.needsUpdate = true;
  }
  setSun(el: number, az: number) {
    this.elevation = el;
    this.azimuth = az;
    const e = MathUtils.degToRad(el),
      a = MathUtils.degToRad(az),
      h = Math.cos(e);
    this.direction.set(Math.cos(a) * h, Math.sin(e), Math.sin(a) * h);
    this.sky.setSun(this.direction);
    this.water.ocean.setSun(this.direction);
  }
  private refreshIBL() {
    const sc = new Scene(),
      mesh = this.sky.mesh.clone();
    mesh.position.set(0, 0, 0);
    sc.add(mesh);
    const old = this.target;
    this.target = this.pmrem.fromScene(sc, 0.05, 0.1, 8000);
    this.scene.environment = this.target.texture;
    old?.dispose();
  }
  update(position: Vector3, eye: Vector3, time: number, progress: number) {
    this.progress = progress;
    const s = (this.state = environmentAt(progress));
    this.setSun(s.elevation, s.azimuth);
    this.exposure = s.exposure;
    this.sun.intensity = s.intensity;
    this.sun.color
      .copy(this.neutral)
      .lerp(this.warm, s.golden * 0.5 + s.sunset * 0.5);
    this.sky.uniforms.uCloudCover.value = s.cloudCoverage;
    this.water.uniforms.uCloudCover.value = s.cloudCoverage;
    this.water.uniforms.uSunGlitter.value = 0.18 + 0.1 * s.sunset;
    this.scene.environmentIntensity = s.ambient;
    (this.scene.fog as Fog).color
      .copy(this.dayFog)
      .lerp(this.eveningFog, s.sunset * 0.74);
    this.cityLights.value = s.lights;
    if (this.kit) this.kit.lamp.emissiveIntensity = s.lights * 3.2;
    this.sun.position.copy(position).addScaledVector(this.direction, 95);
    this.sun.target.position.copy(position);
    this.sun.target.updateMatrixWorld();
    this.sky.mesh.position.copy(eye);
    this.sky.uniforms.uTime.value = time;
    if (time - this.lastShadow > 1 / 15) {
      this.sun.shadow.needsUpdate = true;
      this.lastShadow = time;
    }
    if (Math.abs(progress - this.lastIBL) > 0.012) {
      this.refreshIBL();
      this.lastIBL = progress;
      this.water.planar.invalidate();
    }
  }
  dispose() {
    this.target?.dispose();
    this.pmrem.dispose();
    this.sky.mesh.geometry.dispose();
    this.sky.mesh.material.dispose();
    this.sun.shadow.map?.dispose();
  }
}
