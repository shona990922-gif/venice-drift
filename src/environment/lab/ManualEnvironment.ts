import { WeatherController } from "../WeatherController";
import {
  celestialLights,
  DEFAULT_CAMERA,
  StateAnimator,
} from "@takustaqu/atmosphere";
import {
  Color,
  DirectionalLight,
  Fog,
  MathUtils,
  MeshStandardMaterial,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { EnvironmentController } from "../EnvironmentController";
import { type VenetianKit } from "../../city/VenetianKit";
import { type WaterThreeCanal } from "../../water/v2/WaterThreeCanal";
import { AtmosphereSky } from "./AtmosphereSky";
import { atmosphereState, PRESETS, type EnvironmentPreset } from "./presets";
export class ManualEnvironment {
  readonly weather = new WeatherController();
  readonly sky: AtmosphereSky;
  readonly base: EnvironmentController;
  readonly moon = new DirectionalLight("#b4c2e8", 0);
  readonly animator = new StateAnimator(atmosphereState(PRESETS.day), {
    tau: 3.2,
  });
  readonly pmrem: PMREMGenerator;
  target = { ...PRESETS.day };
  current = { ...PRESETS.day };
  private kit?: VenetianKit;
  private ibl: WebGLRenderTarget | null = null;
  private lastIBL = -100;
  private wetMaterials: {
    material: MeshStandardMaterial;
    color: Color;
    roughness: number;
  }[] = [];
  constructor(
    readonly scene: Scene,
    readonly renderer: WebGLRenderer,
    readonly water: WaterThreeCanal,
    size = 256,
  ) {
    this.base = new EnvironmentController(scene, renderer, water);
    this.base.sky.mesh.visible = false;
    this.sky = new AtmosphereSky(renderer, size);
    scene.add(this.sky.display, this.moon, this.moon.target);
    this.moon.layers.enable(1);
    this.moon.layers.enable(2);
    this.pmrem = new PMREMGenerator(renderer);
    // The existing optical model stays intact. Replace only its environment
    // lookup and make already-present lighting terms follow this shared sky.
    const mat = water.mesh.material;
    mat.uniforms.uLabSky = { value: this.sky.target.texture };
    mat.uniforms.uLabBodyLight = { value: 1 };
    mat.uniforms.uLabDirect = { value: 1 };
    mat.fragmentShader =
      "uniform samplerCube uLabSky;uniform float uLabBodyLight,uLabDirect;\n" +
      mat.fragmentShader;
    mat.fragmentShader = mat.fragmentShader.replace(
      "vec3 atmosphere(vec3 dir, vec3 sunDir){",
      "vec3 atmosphere(vec3 dir,vec3 sunDir){return textureCube(uLabSky,normalize(dir)).rgb;}\nvec3 unusedSourceAtmosphere(vec3 dir, vec3 sunDir){",
    );
    mat.fragmentShader = mat.fragmentShader.replace(
      "waterCol *= (0.5",
      "waterCol *= uLabBodyLight*(0.5",
    );
    mat.fragmentShader = mat.fragmentShader.replace(
      "uSSSStrength * (1.0 - cs * 0.85)",
      "uSSSStrength * uLabDirect * (1.0 - cs * 0.85)",
    );
    mat.fragmentShader = mat.fragmentShader.replace(
      "* sunNoL * 3.0",
      "* sunNoL * uLabDirect * 3.0",
    );
    mat.needsUpdate = true;
  }
  bindCity(kit: VenetianKit) {
    this.kit = kit;
    this.base.bindCity(kit);
    this.wetMaterials = [
      ...kit.walls,
      kit.stone,
      kit.brick,
      kit.wood,
      kit.roof,
    ].map((material) => ({
      material,
      color: material.color.clone(),
      roughness: material.roughness,
    }));
  }
  apply(p: EnvironmentPreset, immediate = false) {
    this.target = { ...p };
    this.weather.setRain(p.precipitation / 5, immediate);
    if (immediate) {
      this.current = { ...p };
      this.animator.jump(atmosphereState(p));
      this.lastIBL = -100;
    }
  }
  update(dt: number, time: number, position: Vector3, eye: Vector3) {
    this.weather.update(dt);
    const k = 1 - Math.exp(-dt / 3.2);
    for (const [key, value] of Object.entries(this.target)) {
      if (typeof value === "number" && key !== "azimuth")
        (this.current as unknown as Record<string, unknown>)[key] =
          MathUtils.lerp(
            this.current[key as keyof EnvironmentPreset] as number,
            value,
            key === "wetness" && value < (this.current[key] as number)
              ? 1 - Math.exp(-dt / 14)
              : k,
          );
    }
    this.current.id = this.target.id;
    this.current.label = this.target.label;
    this.animator.step(atmosphereState(this.target), dt);
    const s = this.animator.current,
      p = this.current;
    const light = celestialLights(s, DEFAULT_CAMERA, 1);
    const sun = this.base.sun;
    sun.position
      .copy(position)
      .addScaledVector(new Vector3(...light.sun.direction), 95);
    sun.target.position.copy(position);
    sun.target.updateMatrixWorld();
    sun.color.setRGB(...light.sun.color);
    sun.intensity = p.lightIntensity * light.sun.intensity;
    this.moon.position
      .copy(position)
      .addScaledVector(new Vector3(...light.moon.direction), 95);
    this.moon.target.position.copy(position);
    this.moon.target.updateMatrixWorld();
    this.moon.intensity = p.lightIntensity * light.moon.intensity * 0.7;
    this.water.ocean.setSun(new Vector3(...light.sun.direction));
    this.water.uniforms.uLabBodyLight.value =
      Math.max(0.065, MathUtils.smoothstep(light.sun.elevation, -0.2, 0.35)) *
      (1 - s.rain * 0.28);
    this.water.uniforms.uLabDirect.value = light.sun.intensity;
    this.water.uniforms.uCloudCover.value = 0; // occlusion comes from the shared atmosphere, not a second cloud field
    this.water.uniforms.uSunGlitter.value = 0.22;
    this.base.cityLights.value = p.cityLights;
    if (this.kit) this.kit.lamp.emissiveIntensity = p.cityLights * 3.2;
    this.scene.environmentIntensity = p.ambient;
    const fog = this.scene.fog as Fog;
    fog.color
      .set("#b9c6d2")
      .lerp(
        new Color("#182339"),
        1 - MathUtils.smoothstep(light.sun.elevation, -0.25, 0.1),
      );
    if (s.rain > 0.01) fog.color.lerp(new Color("#77848c"), s.rain);
    fog.near = MathUtils.lerp(95, 48, s.haze);
    fog.far = MathUtils.lerp(300, 175, s.haze);
    for (const m of this.wetMaterials) {
      m.material.color.copy(m.color).multiplyScalar(1 - p.wetness * 0.1);
      m.material.roughness = Math.max(0.36, m.roughness - p.wetness * 0.2);
    }
    this.sky.display.position.copy(eye);
    const baked = this.sky.update(
      s,
      time,
      this.animator.wind,
      this.animator.evolution,
      p.skyExposure,
    );
    if (baked) {
      this.water.planar.invalidate();
      sun.shadow.needsUpdate = true;
      if (time - this.lastIBL > 0.9) {
        const old = this.ibl;
        this.ibl = this.pmrem.fromCubemap(this.sky.target.texture);
        this.scene.environment = this.ibl.texture;
        old?.dispose();
        this.lastIBL = time;
      }
    }
  }
  dispose() {
    this.ibl?.dispose();
    this.pmrem.dispose();
    this.sky.dispose();
    this.base.dispose();
  }
}
