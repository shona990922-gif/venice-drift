import {
  BufferGeometry,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { Ocean, OCEAN_CONFIG } from "./vendor/waterthreejs/Ocean.js";
import { DynamicRippleSystem } from "../DynamicRippleSystem";
import { BoatWaterInteraction } from "../BoatWaterInteraction";
import { CanalMask } from "../RippleWindow";
import { HeightfieldAdapter } from "../simulation/HeightfieldAdapter";
import { makeCanalGeometry, makeCanalBed } from "./CanalGeometry";
import { GondolaWaterInteraction } from "./GondolaWaterInteraction";
import {
  CANAL_DEFAULTS,
  WATER_QUALITY,
  type CanalSettings,
  type ReflectionMode,
  type WaterQuality,
} from "./Presets";
import type { RouteController } from "../../journey/RouteController";
import type { PlanarReflection } from "../PlanarReflection";

/** Direct source integration. Ocean.js and common.js remain byte-for-byte upstream.
 * The following hooks are only the documented canal/renderer integration seams.
 */
export class WaterThreeCanal {
  readonly ocean: Ocean;
  readonly simulation: HeightfieldAdapter | DynamicRippleSystem;
  readonly interaction: GondolaWaterInteraction | BoatWaterInteraction;
  readonly settings: CanalSettings = { ...CANAL_DEFAULTS };
  readonly bed;
  originalLook = false;
  reflectionMode: ReflectionMode = "planar";
  constructor(
    renderer: WebGLRenderer,
    route: RouteController,
    sun: Vector3,
    readonly planar: PlanarReflection,
    readonly quality: WaterQuality = "medium",
    readonly dynamicV3 = false,
    halfFloat = false,
  ) {
    const q = WATER_QUALITY[quality];
    this.ocean = new Ocean(sun, new Vector2(1280, 720));
    this.ocean.mesh.geometry.dispose();
    this.mesh.geometry = makeCanalGeometry(route, 5.6, q.segments);
    this.ocean.mesh.name = "WaterThreeJS / Venetian canal";
    this.ocean.mesh.receiveShadow = true;
    this.bed = makeCanalBed(this.ocean.mesh.geometry);
    this.simulation = dynamicV3
      ? new DynamicRippleSystem(
          renderer,
          q.simulation,
          q.simulationHz,
          new CanalMask(route),
          halfFloat,
        )
      : new HeightfieldAdapter(renderer, q.simulation, q.simulationHz);
    this.interaction = dynamicV3
      ? new BoatWaterInteraction(quality === "low")
      : new GondolaWaterInteraction();
    const material = this.ocean.mesh.material;
    Object.assign(this.ocean.uniforms, UniformsUtils.clone(UniformsLib.lights));
    material.uniforms = this.ocean.uniforms;
    const u = material.uniforms;
    Object.assign(u, {
      uCanalMode: { value: 1 },
      uReflectionMode: { value: 1 },
      uPlanar: { value: planar.target.texture },
      uPlanarMatrix: { value: planar.matrix },
      uAbsorption: { value: new Vector3(0.45, 0.16, 0.1) },
      uMaxOpticalDepth: { value: 18 },
      uShadowAmbient: { value: 0.38 },
      uSSRStep: { value: 0.35 },
      uSSRThickness: { value: 0.55 },
      uSSRSteps: { value: q.ssrSteps },
      uDetailOctaves: { value: q.detailOctaves },
      uLocalField: { value: this.simulation.output.texture },
      uLocalOrigin: { value: this.simulation.origin },
      uLocalSpan: { value: this.simulation.span },
      uLocalStrength: { value: 1 },
      uWaterView: { value: 0 },
    });
    material.lights = true;
    material.vertexShader = `#include <common>\n#include <shadowmap_pars_vertex>\nattribute float bankDistance;
      uniform float uCanalMode,uLocalSpan,uLocalStrength;uniform vec2 uLocalOrigin;uniform sampler2D uLocalField;
      ${material.vertexShader}`;
    material.vertexShader = material.vertexShader.replace(
      "vec3 displaced = worldPos + w.displacement;",
      `
      float bankFade=mix(1.,smoothstep(0.,1.1,bankDistance),uCanalMode);
      w.displacement.xz*=bankFade;w.displacement.y*=mix(1.,.45+.55*bankFade,uCanalMode);
      vec2 localUV=(worldPos.xz-uLocalOrigin)/uLocalSpan;
      float localValid=step(0.,localUV.x)*step(0.,localUV.y)*step(localUV.x,1.)*step(localUV.y,1.);
      w.displacement.y+=texture2D(uLocalField,clamp(localUV,0.,1.)).a*localValid*uLocalStrength;
      vec3 displaced = worldPos + w.displacement;
      vec4 worldPosition=vec4(displaced,1.);
      vec3 transformedNormal=mat3(viewMatrix)*w.normal;
      #include <shadowmap_vertex>
    `,
    );
    material.fragmentShader = `#include <common>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>
      uniform float uCanalMode,uMaxOpticalDepth,uShadowAmbient,uSSRStep,uSSRThickness,uLocalSpan,uLocalStrength;
      uniform int uReflectionMode,uSSRSteps,uDetailOctaves,uWaterView;
      uniform vec3 uAbsorption;uniform sampler2D uPlanar,uLocalField;uniform mat4 uPlanarMatrix;uniform vec2 uLocalOrigin;
      ${material.fragmentShader}`;
    let frag = material.fragmentShader;
    // Preserve the upstream ray marcher; expose metre-scale integration controls.
    frag = frag
      .replace("float stepLen = 2.2;", "float stepLen = uSSRStep;")
      .replace(
        "vec3 p = ro + rd * (stepLen * float(i));",
        "if(i>uSSRSteps)break;\nvec3 p = ro + rd * (stepLen * float(i));",
      )
      .replace("diff < 6.0", "diff < uSSRThickness");
    frag = frag.replace(
      "for (int i = 0; i < 6; i++){",
      "for (int i = 0; i < 6; i++){\nif(i>=uDetailOctaves)break;",
    );
    frag = frag.replace(
      "vec3 Ns = N.y >= 0.0 ? N : -N;",
      `
      vec2 localUV=(vWorldPos.xz-uLocalOrigin)/uLocalSpan;
      float validField=step(0.,localUV.x)*step(0.,localUV.y)*step(localUV.x,1.)*step(localUV.y,1.);
      vec4 localField=texture2D(uLocalField,clamp(localUV,0.,1.))*validField*uLocalStrength;
      N=normalize(vec3(N.x-clamp(localField.x,-.2,.2),N.y,N.z-clamp(localField.y,-.2,.2)));
      vec3 Ns = N.y >= 0.0 ? N : -N;`,
    );
    frag = frag.replace(
      "float cs = 0.0;",
      "vec3 debugReflection=vec3(0.),debugRefraction=vec3(0.),debugAbsorption=vec3(0.),debugGlitter=vec3(0.);float debugDepth=0.,debugConfidence=0.;float geometryShadow=mix(1.,getShadowMask(),uCanalMode);\nfloat cs = 0.0;",
    );
    frag = frag.replace(
      "vec3 reflection = atmosphere(Rsky, sunDir);",
      "vec3 reflection=vec3(0.);if(uReflectionMode==0)reflection=atmosphere(Rsky,sunDir);",
    );
    frag = frag.replace(
      "if (uSSRStrength > 0.001){",
      `
      if(uReflectionMode!=0){
        vec4 pp=uPlanarMatrix*vec4(vWorldPos,1.);vec2 puv=pp.xy/pp.w;
        vec3 vn=mat3(viewMatrix)*(Nr-vec3(0.,1.,0.));
        puv+=vn.xy*(.013+.055/(1.+dist*.2));
        float inside=step(.002,puv.x)*step(.002,puv.y)*step(puv.x,.998)*step(puv.y,.998);
        reflection=texture2D(uPlanar,clamp(puv,.002,.998)).rgb;
      }
      if (uReflectionMode!=1 && uSSRStrength > 0.001){`,
    );
    frag = frag.replace(
      "vec4 s = ssr(vWorldPos, R);",
      "vec4 s = ssr(vWorldPos, R);debugConfidence=s.a;",
    );
    frag = frag.replace(
      "float thickness = max(sceneEye - waterEye, 0.0);",
      "float thickness = min(max(sceneEye - waterEye, 0.0),uMaxOpticalDepth);",
    );
    frag = frag.replace(
      "vec3 T = exp(-(ABSORB / uClarity) * thickness);",
      "vec3 T = exp(-(mix(ABSORB,uAbsorption,uCanalMode) / uClarity) * thickness);",
    );
    frag = frag.replace(
      "waterCol *= 0.5 + 0.5 * sunElev;",
      "waterCol *= (0.5 + 0.5 * sunElev)*mix(uShadowAmbient,1.,geometryShadow);",
    );
    frag = frag.replace(
      "color = mix(transmitted, reflection, fres);",
      `
      color = mix(transmitted, reflection, fres);
      debugReflection=reflection;debugRefraction=transmitted;debugDepth=thickness;debugAbsorption=T;`,
    );
    frag = frag.replace(
      "uSSSStrength * (1.0 - cs * 0.85)",
      "uSSSStrength * (1.0 - cs * 0.85)*geometryShadow",
    );
    frag = frag.replace(
      "uRoughness + (1.0 - detFade)",
      "uRoughness + localField.b*.05 + (1.0 - detFade)",
    );
    frag = frag.replace(
      "vec3(1.0, 0.94, 0.82) * D * fh",
      "mix(vec3(1.,.94,.82),mix(vec3(1.,.52,.24),vec3(1.,.96,.88),sunElev),uCanalMode) * D * fh",
    );
    frag = frag.replace(
      "sunElev * (1.0 - cs * 0.9)",
      "sunElev * (1.0 - cs * 0.9)*geometryShadow",
    );
    frag = frag.replace(
      "float breakE = smoothstep",
      "if(uFoamOpacity>.001){\nfloat breakE = smoothstep",
    );
    frag = frag.replace(
      "// ================= HORIZON / DISTANCE =================",
      "}\n// ================= HORIZON / DISTANCE =================",
    );
    frag = frag.replace(
      "gl_FragColor = vec4(color, 1.0);",
      `
      if(uWaterView==1)color=debugReflection;
      if(uWaterView==2)color=debugRefraction;
      if(uWaterView==3)color=vec3(debugDepth/6.);
      if(uWaterView==4)color=Ns*.5+.5;
      if(uWaterView==5)color=vec3(max(localField.a,0.)*30.,localField.b,max(-localField.a,0.)*30.);
      if(uWaterView==6)color=vec3(geometryShadow);
      if(uWaterView==7)color=vec3(debugConfidence);
      if(uWaterView==8)color=debugAbsorption;
      gl_FragColor = vec4(color, 1.0);`,
    );
    frag = frag.replace(
      /color \+= (mix\(vec3\(1\.,\.94,\.82\)[^\n]+);/,
      "debugGlitter=$1;color+=debugGlitter;",
    );
    frag = frag.replace(
      "if(uWaterView==8)color=debugAbsorption;",
      "if(uWaterView==8)color=debugAbsorption; if(uWaterView==9)color=debugGlitter;",
    );
    material.fragmentShader = frag;
    material.needsUpdate = true;
    this.applySettings();
  }
  get mesh() {
    return this.ocean.mesh as Mesh<BufferGeometry, ShaderMaterial>;
  }
  get uniforms() {
    return this.ocean.mesh.material.uniforms;
  }
  applySettings() {
    const u = this.uniforms,
      s = this.settings;
    const pairs = {
      uAmplitude: s.amplitude,
      uChoppy: s.choppiness,
      uWaveCount: s.waveCount,
      uSpeed: s.speed,
      uDirSpread: s.directionSpread,
      uBaseFreq: (2 * Math.PI) / s.swellLength,
      uDetailStrength: s.rippleDetail,
      uDetailScale: s.rippleScale,
      uRefractStrength: s.refraction,
      uSSRStrength: s.ssr,
      uSunGlitter: s.glitter,
      uRoughness: s.roughness,
      uClarity: s.clarity,
      uDepthFalloff: s.depthFalloff,
      uMaxOpticalDepth: s.maxOpticalDepth,
      uSSRStep: s.ssrStep,
      uSSRThickness: s.ssrThickness,
      uShadowAmbient: s.shadowAmbient,
      uLocalStrength: 1,
    };
    for (const [key, value] of Object.entries(pairs)) u[key].value = value;
    u.uAbsorption.value.set(
      s.absorptionRed,
      s.absorptionGreen,
      s.absorptionBlue,
    );
    u.uReflectionMode.value = { ssr: 0, planar: 1, hybrid: 2 }[
      this.reflectionMode
    ];
    u.uCanalMode.value = this.originalLook ? 0 : 1;
    u.uFoamOpacity.value = this.originalLook ? 0.95 : 0;
    this.simulation.dampingRate = 7 / Math.max(2, s.wakeLifetime);
    if (this.originalLook) {
      const c = OCEAN_CONFIG;
      Object.assign(pairs, {
        uAmplitude: c.amplitude,
        uChoppy: c.choppy,
        uWaveCount: c.waveCount,
        uSpeed: c.speed,
        uDirSpread: c.dirSpread,
        uBaseFreq: (2 * Math.PI) / c.baseWavelength,
        uDetailStrength: c.detailStrength,
        uDetailScale: c.detailScale,
        uRefractStrength: c.refractStrength,
        uClarity: c.clarity,
        uDepthFalloff: c.depthFalloff,
        uSunGlitter: c.sunGlitter,
        uRoughness: c.roughness,
        uMaxOpticalDepth: 8000,
        uSSRStep: 2.2,
        uSSRThickness: 6,
        uLocalStrength: 0,
      });
      for (const [key, value] of Object.entries(pairs)) u[key].value = value;
      u.uReflectionMode.value = 0;
      u.uSSRSteps.value = 32;
      u.uDetailOctaves.value = 6;
    } else {
      u.uSSRSteps.value = WATER_QUALITY[this.quality].ssrSteps;
      u.uDetailOctaves.value = WATER_QUALITY[this.quality].detailOctaves;
    }
  }
  update(
    dt: number,
    time: number,
    position: Vector3,
    forward: Vector3,
    speed: number,
  ) {
    // Do not call upstream Ocean.update(): its camera-local recentering belongs
    // to the open-ocean grid. The canal mesh is already world anchored.
    this.uniforms.uTime.value = time;
    this.simulation.centerOn(position);
    if (!this.originalLook)
      this.interaction.update(
        position,
        forward,
        speed,
        this.simulation,
        this.settings,
      );
    if (!this.originalLook) this.simulation.update(dt, position);
  }
  reset(position: Vector3) {
    this.simulation.clear();
    this.simulation.centerOn(position);
    this.interaction.reset();
  }
  dispose() {
    this.simulation.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.bed.geometry.dispose();
    this.bed.material.dispose();
  }
}
