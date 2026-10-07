import { WeatherController } from "../WeatherController";
import {
  celestialLights,
  DEFAULT_CAMERA,
  StateAnimator,
} from "@takustaqu/atmosphere";
import {
  Color,
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
import { AtmosphereSky, SKY_SAMPLE_GLSL } from "./AtmosphereSky";
import {
  atmosphereState,
  directSunVisibility,
  CALM_SKY_ANIMATOR,
  PRESETS,
  type EnvironmentPreset,
} from "./presets";
export class ManualEnvironment {
  readonly weather = new WeatherController();
  readonly sky: AtmosphereSky;
  readonly base: EnvironmentController;
  readonly animator = new StateAnimator(
    atmosphereState(PRESETS.day),
    CALM_SKY_ANIMATOR,
  );
  readonly pmrem: PMREMGenerator;
  target = { ...PRESETS.day };
  current = { ...PRESETS.day };
  private kit?: VenetianKit;
  private ibl: WebGLRenderTarget | null = null;
  private lastIBL = -100;
  private lastShadow = -100;
  private iblState = new Vector3(Infinity, Infinity, Infinity);
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
    scene.add(this.sky.display);
    this.pmrem = new PMREMGenerator(renderer);
    // The existing optical model stays intact. Replace only its environment
    // lookup and make already-present lighting terms follow this shared sky.
    const mat = water.mesh.material;
    Object.assign(mat.uniforms, this.sky.sampleUniforms);
    mat.uniforms.uLabBodyLight = { value: 1 };
    mat.uniforms.uLabDirect = { value: 1 };
    mat.fragmentShader =
      SKY_SAMPLE_GLSL +
      "uniform float uLabBodyLight,uLabDirect;\n" +
      mat.fragmentShader;
    mat.fragmentShader = mat.fragmentShader.replace(
      "vec3 atmosphere(vec3 dir, vec3 sunDir){",
      "vec3 atmosphere(vec3 dir,vec3 sunDir){return sampleVeniceSky(dir);}\nvec3 unusedSourceAtmosphere(vec3 dir, vec3 sunDir){",
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
      this.sky.invalidate();
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
    const visibility = directSunVisibility(s.rain);
    sun.intensity = p.lightIntensity * light.sun.intensity * visibility;
    this.water.ocean.setSun(new Vector3(...light.sun.direction));
    this.water.uniforms.uLabBodyLight.value =
      Math.max(0.065, MathUtils.smoothstep(light.sun.elevation, -0.2, 0.35)) *
      (1 - s.rain * 0.28);
    this.water.uniforms.uLabDirect.value = light.sun.intensity * visibility;
    this.water.uniforms.uCloudCover.value = 0; // occlusion comes from the shared atmosphere, not a second cloud field
    // Broaden the daylight glints gently and further at low sun; absorption,
    // body colour and the boat-driven normal field keep the canal baseline.
    const sunset = 1 - MathUtils.smoothstep(light.sun.elevation, 0.1, 0.38);
    this.water.uniforms.uSunGlitter.value = 0.26 + sunset * 0.02;
    this.water.uniforms.uRoughness.value =
      this.water.settings.roughness + 0.015 + sunset * 0.02;
    this.water.uniforms.uDetailStrength.value =
      this.water.settings.rippleDetail * (1 + sunset * 0.3);
    this.water.uniforms.uDetailScale.value =
      this.water.settings.rippleScale * (1 + sunset * 0.55);
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
    // Spend the saved motion budget on cleaner cloud silhouettes. Slow skies
    // need fewer expensive bakes, while display/sun alignment remain per-frame.
    const transitioning =
      Math.abs(this.target.elevation - MathUtils.radToDeg(s.sunElevation)) >
        0.2 ||
      Math.abs(this.target.cover - s.cloudCover) > 0.01 ||
      Math.abs(this.target.skyExposure - p.skyExposure) > 0.01;
    this.sky.timeline.minimumDuration = transitioning ? 0.4 : 0.9;
    const baked = this.sky.update(
      s,
      time,
      this.animator.wind,
      this.animator.evolution,
      p.skyExposure,
    );
    // Direct light and moving shadow position are not tied to cube publication.
    if (time - this.lastShadow >= 1 / 30) {
      sun.shadow.needsUpdate = true;
      this.lastShadow = time;
    }
    const changed =
      Math.abs(this.iblState.x - s.sunElevation) > 0.015 ||
      Math.abs(this.iblState.y - s.cloudCover) > 0.025 ||
      Math.abs(this.iblState.z - p.skyExposure) > 0.025;
    if (!this.ibl || (baked && time - this.lastIBL > (changed ? 0.6 : 5))) {
      // Reuse the allocated target; do not allocate/dispose a PMREM every second.
      this.ibl = this.pmrem.fromCubemap(this.sky.target.texture, this.ibl);
      this.scene.environment = this.ibl.texture;
      this.iblState.set(s.sunElevation, s.cloudCover, p.skyExposure);
      this.lastIBL = time;
    }
  }
  dispose() {
    this.ibl?.dispose();
    this.pmrem.dispose();
    this.sky.dispose();
    this.base.dispose();
  }
}
