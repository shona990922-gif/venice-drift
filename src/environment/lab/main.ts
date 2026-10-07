import { RainAmbience } from "../../audio/RainAmbience";
import "./style.css";
import {
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { BoatController } from "../../journey/BoatController";
import { RouteController, ROUTE } from "../../journey/RouteController";
import { PassengerCamera } from "../../journey/PassengerCamera";
import { loadMaterials } from "../../city/Materials";
import { VenetianKit } from "../../city/VenetianKit";
import { CityChunkManager } from "../../city/CityChunkManager";
import { JourneyScenery } from "../../city/JourneyScenery";
import { PlanarReflection } from "../../water/PlanarReflection";
import { WaterThreeCanal } from "../../water/v2/WaterThreeCanal";
import { WaterRenderer } from "../../water/v2/WaterRenderer";
import { WATER_QUALITY, type WaterQuality } from "../../water/v2/Presets";
import { GpuTimer } from "../../diagnostics/GpuTimer";
import { ManualEnvironment } from "./ManualEnvironment";
import {
  DynamicWaterDebug,
  verifyRippleSolver,
} from "../../water/DynamicWaterDebug";
import { BoatWaterInteraction } from "../../water/BoatWaterInteraction";
import { RainWaterInteraction } from "../../water/RainWaterInteraction";
import { DynamicRippleSystem } from "../../water/DynamicRippleSystem";
import { PRESETS, type PresetId, type EnvironmentPreset } from "./presets";
import { REFERENCES, ReferenceSky, type ReferenceId } from "./ReferenceSky";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const query = new URLSearchParams(location.search);
async function boot() {
  const canvas = $<HTMLCanvasElement>("scene"),
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false;
  if (!renderer.extensions.has("EXT_color_buffer_float"))
    throw Error("此实验需要 WebGL2 浮点纹理支持。正式旅程保留在首页。");
  const quality: WaterQuality =
      query.get("quality") === "low"
        ? "low"
        : query.get("quality") === "high"
          ? "high"
          : "medium",
    q = WATER_QUALITY[quality];
  const route = new RouteController();
  route.seek(ROUTE.heroDistance);
  const scene = new Scene(),
    boat = new BoatController();
  boat.update(route);
  scene.add(boat.root);
  const passenger = new PassengerCamera(boat.root, canvas);
  passenger.input.enabled = true;
  const planar = new PlanarReflection(renderer, q.reflection);
  const water = new WaterThreeCanal(
    renderer,
    route,
    new Vector3(0, 1, 0),
    planar,
    quality,
    true,
    query.has("halfFloat"),
  );
  scene.add(water.mesh, water.bed);
  const pipeline = new WaterRenderer(renderer, scene, water, planar, quality);
  const environment = new ManualEnvironment(
    scene,
    renderer,
    water,
    quality === "low" ? 128 : 256,
  );
  const kit = new VenetianKit(
    await loadMaterials(quality === "low", false, "../"),
  );
  const city = new CityChunkManager(route, kit, "../"),
    scenery = new JourneyScenery(route, kit);
  scene.add(city.root, scenery.root);
  await city.start();
  environment.bindCity(kit);
  const ripple = water.simulation as DynamicRippleSystem;
  const rain = new RainWaterInteraction(ripple, quality);
  const rainAudio = new RainAmbience();
  const dynamicDebug = new DynamicWaterDebug(ripple);
  scene.add(dynamicDebug.root);
  const hull = water.interaction as BoatWaterInteraction;
  let rippleView = "final",
    simulationEnabled = true;
  scene.add(rain.mesh);
  const reference = new ReferenceSky();
  const skyScene = new Scene(),
    skyMesh = environment.sky.display.clone();
  skyScene.add(skyMesh);
  const gpu = new GpuTimer(renderer.getContext() as WebGL2RenderingContext);
  let selected: PresetId = "day",
    playing = false,
    view = "canal",
    time = 0,
    last = performance.now(),
    fps = 0,
    frameCount = 0,
    frameSeconds = 0,
    capture = false,
    disposed = false;
  const eye = new Vector3(),
    size = new Vector2();
  const updateSize = () => {
    renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
    renderer.setSize(innerWidth, innerHeight, false);
    passenger.resize(innerWidth, innerHeight);
    renderer.getDrawingBufferSize(size);
    pipeline.resize(size.x, size.y);
  };
  updateSize();
  window.addEventListener("resize", updateSize);
  for (const p of Object.values(PRESETS)) {
    const button = document.createElement("button");
    button.textContent = p.label;
    button.dataset.preset = p.id;
    button.setAttribute("aria-pressed", String(p.id === selected));
    button.onclick = () => choose(p.id);
    $("presets").append(button);
  }
  type Field = keyof EnvironmentPreset;
  const fields: [string, [Field, string, number, number, number, string][]][] =
    [
      [
        "太阳与照明",
        [
          ["elevation", "太阳高度", -3, 75, 0.1, "°"],
          ["azimuth", "太阳方位", 0, 360, 1, "°"],
          ["exposure", "曝光", 0.65, 1.8, 0.01, ""],
          ["skyExposure", "天空曝光", -1, 1, 0.02, "EV"],
          ["lightIntensity", "主光强度", 0, 6, 0.05, ""],
          ["ambient", "环境光", 0.3, 5, 0.05, ""],
          ["cityLights", "城市灯", 0, 1, 0.01, ""],
        ],
      ],
      [
        "云层与天气",
        [
          ["cover", "总云量", 0, 1, 0.01, ""],
          ["cumulus", "积云", 0, 1, 0.01, ""],
          ["cirrus", "卷云", 0, 1, 0.01, ""],
          ["altocumulus", "高积云", 0, 1, 0.01, ""],
          ["stratus", "层云", 0, 1, 0.01, ""],
          ["visibility", "能见度", 3, 50, 0.5, "km"],
          ["wind", "风速", 0, 7, 0.1, "m/s"],
          ["precipitation", "降雨", 0, 4, 0.1, "mm/h"],
          ["wetness", "湿润度", 0, 0.8, 0.01, ""],
          ["bortle", "城市光污染", 5, 9, 0.1, ""],
        ],
      ],
    ];
  const inputs = new Map<
    Field,
    { input: HTMLInputElement; output: HTMLOutputElement; unit: string }
  >();
  for (const [title, rows] of fields) {
    const details = document.createElement("details");
    details.open = title === "太阳与照明";
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.append(summary);
    for (const [key, label, min, max, step, unit] of rows) {
      const row = document.createElement("label");
      row.className = "range-row";
      row.textContent = label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.setAttribute("aria-label", label);
      input.id = "param-" + key;
      const output = document.createElement("output");
      row.append(input, output);
      details.append(row);
      inputs.set(key, { input, output, unit });
      input.oninput = () => {
        const p = { ...environment.target, [key]: Number(input.value) };
        environment.apply(p);
        output.value = Number(input.value).toFixed(step < 1 ? 2 : 0) + unit;
        $("preset-note").textContent = PRESETS[selected].label + " · 手动调整";
      };
    }
    $("sliders").append(details);
  }
  function sync() {
    for (const [key, { input, output, unit }] of inputs) {
      const value = environment.target[key] as number;
      input.value = String(value);
      output.value = value.toFixed(Number(input.step) < 1 ? 2 : 0) + unit;
    }
  }
  function choose(id: PresetId) {
    selected = id;
    environment.apply({ ...PRESETS[id] });
    sync();
    for (const button of $("presets").querySelectorAll("button"))
      button.setAttribute("aria-pressed", String(button.dataset.preset === id));
    $("preset-note").textContent =
      id === "rain"
        ? "Rain · 轻雨 / 无闪电 / 水面细小涟漪"
        : "手动模式 · 时间不会随航程推进";
    $("status").textContent =
      PRESETS[id].label + "：正在平滑切换天空、光照与反射";
  }
  const check = (id: string) => $<HTMLInputElement>(id).checked;
  $("boat-ripple").onchange = () => (hull.enabled = check("boat-ripple"));
  $("rain-ripple").onchange = () => (rain.enabled = check("rain-ripple"));
  $("rain-particles").onchange = () =>
    (rain.particlesVisible = check("rain-particles"));
  $("base-wave").onchange = () =>
    (water.uniforms.uAmplitude.value = check("base-wave")
      ? water.settings.amplitude
      : 0);
  $("micro-wave").onchange = () =>
    (water.uniforms.uDetailStrength.value = check("micro-wave")
      ? water.settings.rippleDetail
      : 0);
  $("ssr").onchange = () =>
    (water.uniforms.uSSRStrength.value = check("ssr") ? water.settings.ssr : 0);
  $("gizmos").onchange = () => (dynamicDebug.root.visible = check("gizmos"));
  $("ripple-view").onchange = () => {
    rippleView = $<HTMLSelectElement>("ripple-view").value;
    water.uniforms.uWaterView.value =
      rippleView === "reflection"
        ? 1
        : rippleView === "refraction"
          ? 2
          : rippleView === "glitter"
            ? 9
            : 0;
  };
  const setRain = (on: boolean) => {
    const p = environment.target;
    environment.apply({
      ...p,
      precipitation: on ? 1.8 : 0,
      cover: on ? 0.76 : PRESETS[selected === "rain" ? "day" : selected].cover,
      stratus: on ? 0.4 : 0,
      visibility: on ? 10 : 35,
      wetness: on ? 0.6 : 0,
    });
    sync();
  };
  $("rain-on").onclick = () => setRain(true);
  $("rain-off").onclick = () => setRain(false);
  $("drop").onclick = () =>
    ripple.createRipple(
      route.position.clone().addScaledVector(route.tangent, 7),
      -0.006,
      0.25,
    );
  $("backward").onclick = () => {
    passenger.input.targetYaw = Math.PI;
    passenger.input.targetPitch = -0.3;
  };
  $("boat-only").onclick = () => {
    water.uniforms.uDetailStrength.value = 0;
    water.uniforms.uAmplitude.value = 0;
    rain.enabled = false;
    $<HTMLInputElement>("micro-wave").checked = false;
    $<HTMLInputElement>("base-wave").checked = false;
    $<HTMLInputElement>("rain-ripple").checked = false;
  };
  $("rain-only").onclick = () => {
    setRain(true);
    rain.particlesVisible = false;
    hull.enabled = false;
    $<HTMLInputElement>("rain-particles").checked = false;
    $<HTMLInputElement>("boat-ripple").checked = false;
  };
  const report = (name: string, result: unknown) => {
    const json = JSON.stringify(result, null, 2);
    $("ripple-result").textContent = json;
    save(
      new Blob([json], { type: "application/json" }),
      name + "-" + Date.now() + ".json",
    );
  };
  $("solver-check").onclick = () => {
    try {
      report(
        "dynamic-solver",
        verifyRippleSolver(renderer, query.has("halfFloat")),
      );
    } catch (e) {
      $("ripple-result").textContent = String(e);
    }
  };
  const wait = (ms: number) => {
    const end = time + ms / 1000;
    return new Promise<void>((resolve) => {
      const poll = () => {
        if (disposed || time >= end) resolve();
        else setTimeout(poll, 50);
      };
      poll();
    });
  };
  $("optics-check").onclick = async () => {
    const btn = $<HTMLButtonElement>("optics-check");
    btn.disabled = true;
    btn.textContent = "采样移动船体…";
    seek(ROUTE.heroDistance);
    playing = true;
    hull.enabled = true;
    rain.enabled = false;
    passenger.input.targetPitch = -0.25;
    await wait(6500);
    playing = false;
    await wait(500);
    const energy = () => {
      const a = ripple.sample();
      let sum = 0,
        normal = 0,
        peak = 0;
      for (let i = 0; i < a.length; i += 4) {
        sum += a[i] * a[i];
        normal += a[i + 2] ** 2 + a[i + 3] ** 2;
        peak = Math.max(peak, Math.abs(a[i]));
      }
      return {
        height: sum / (a.length / 4),
        normal: normal / (a.length / 4),
        peak,
      };
    };
    const before = energy(),
      emissions = ripple.emissions;
    const compare = (v: number, camera = passenger.camera) => {
      const gl = renderer.getContext(),
        a = new Uint8Array(canvas.width * canvas.height * 4),
        b = new Uint8Array(a.length);
      water.uniforms.uWaterView.value = v;
      water.uniforms.uLocalStrength.value = 1;
      planar.invalidate();
      pipeline.render(camera, time);
      gl.readPixels(
        0,
        0,
        canvas.width,
        canvas.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        a,
      );
      water.uniforms.uLocalStrength.value = 0;
      planar.invalidate();
      pipeline.render(camera, time);
      gl.readPixels(
        0,
        0,
        canvas.width,
        canvas.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        b,
      );
      let changed = 0,
        max = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.max(
          Math.abs(a[i] - b[i]),
          Math.abs(a[i + 1] - b[i + 1]),
          Math.abs(a[i + 2] - b[i + 2]),
        );
        if (d > 2) changed++;
        max = Math.max(max, d);
      }
      return { changedPixels: changed, maxChannelChange: max };
    };
    const reflection = compare(1),
      refraction = compare(2),
      glitter = compare(9),
      composite = compare(0);
    // A separate, explicitly unoccluded optical fixture checks GGX sensitivity.
    // The actual hero result above retains the real sun and city shadows.
    const previousSun = water.uniforms.uSunDir.value.clone();
    const previousCanal = water.uniforms.uCanalMode.value;
    const fixtureTarget = route.position
      .clone()
      .addScaledVector(route.tangent, -6);
    const side = new Vector3(-route.tangent.z, 0, route.tangent.x);
    const fixtureCamera = new PerspectiveCamera(
      65,
      canvas.width / canvas.height,
      0.1,
      500,
    );
    fixtureCamera.position.copy(fixtureTarget).addScaledVector(side, 3);
    fixtureCamera.position.y = 2;
    fixtureCamera.lookAt(fixtureTarget);
    fixtureCamera.updateMatrixWorld(true);
    water.uniforms.uSunDir.value.copy(side).multiplyScalar(-3);
    water.uniforms.uSunDir.value.y = 2;
    water.uniforms.uSunDir.value.normalize();
    water.uniforms.uCanalMode.value = 0;
    const unoccludedGGXFixture = compare(9, fixtureCamera);
    water.uniforms.uSunDir.value.copy(previousSun);
    water.uniforms.uCanalMode.value = previousCanal;
    water.uniforms.uLocalStrength.value = 1;
    water.uniforms.uWaterView.value = 0;
    btn.textContent = "验证停止后 7 秒衰减…";
    await wait(7000);
    const after = energy();
    report("dynamic-optics", {
      before,
      after,
      reflection,
      refraction,
      glitter,
      unoccludedGGXFixture,
      composite,
      emissionsAtStop: emissions,
      emissionsAfter: ripple.emissions,
      pass:
        reflection.changedPixels > 20 &&
        composite.changedPixels > 20 &&
        after.normal < before.normal * 0.35 &&
        emissions === ripple.emissions,
      snapshot: snapshot(),
    });
    btn.textContent = "验证倒影与衰减";
    btn.disabled = false;
    rain.enabled = check("rain-ripple");
  };
  $("rain-sound").onclick = async () => {
    try {
      $("rain-sound").textContent = (await rainAudio.toggle())
        ? "雨声：开"
        : "雨声：关";
    } catch {
      $("status").textContent = "雨声暂不可用，水面继续运行";
    }
  };
  $("rain-check").onclick = async () => {
    const btn = $<HTMLButtonElement>("rain-check");
    btn.disabled = true;
    btn.textContent = "采样雨滴波纹…";
    playing = false;
    hull.enabled = false;
    rain.enabled = true;
    setRain(true);
    await wait(14000);
    const energy = () => {
      const d = ripple.sample();
      let n = 0,
        peak = 0;
      for (let i = 0; i < d.length; i += 4) {
        n += d[i + 2] ** 2 + d[i + 3] ** 2;
        peak = Math.max(peak, Math.abs(d[i]));
      }
      return { normal: n / (d.length / 4), peak };
    };
    const wet = energy(),
      gl = renderer.getContext(),
      a = new Uint8Array(canvas.width * canvas.height * 4),
      b = new Uint8Array(a.length);
    water.uniforms.uWaterView.value = 1;
    water.uniforms.uLocalStrength.value = 1;
    planar.invalidate();
    pipeline.render(passenger.camera, time);
    gl.readPixels(
      0,
      0,
      canvas.width,
      canvas.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      a,
    );
    water.uniforms.uLocalStrength.value = 0;
    planar.invalidate();
    pipeline.render(passenger.camera, time);
    gl.readPixels(
      0,
      0,
      canvas.width,
      canvas.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      b,
    );
    let changed = 0;
    for (let i = 0; i < a.length; i += 4)
      if (
        Math.max(
          Math.abs(a[i] - b[i]),
          Math.abs(a[i + 1] - b[i + 1]),
          Math.abs(a[i + 2] - b[i + 2]),
        ) > 2
      )
        changed++;
    water.uniforms.uWaterView.value = 0;
    water.uniforms.uLocalStrength.value = 1;
    const impacts = ripple.debugImpacts.filter((e) => e.source === "RAIN");
    const allOnWater = impacts.every((e) => {
      const hit = ripple.mask!.test(e.worldPosition.x, e.worldPosition.z);
      return hit.inside && !hit.covered && e.worldPosition.y === 0;
    });
    setRain(false);
    const retainedImmediately = energy();
    btn.textContent = "检查停雨渐变与历史波纹…";
    await wait(12000);
    const transitionIntensity = environment.weather.rainIntensity;
    rain.enabled = false;
    await wait(7000);
    const dry = energy();
    report("dynamic-rain", {
      wet,
      retainedImmediately,
      dry,
      changedReflectionPixels: changed,
      allOnWater,
      sampledPoints: impacts.length,
      rainIntensityAfter12s: transitionIntensity,
      pass:
        wet.peak > 0 &&
        wet.peak < 0.01 &&
        changed > 20 &&
        allOnWater &&
        retainedImmediately.normal === wet.normal &&
        dry.normal < wet.normal * 0.4,
      snapshot: snapshot(),
    });
    hull.enabled = check("boat-ripple");
    rain.enabled = check("rain-ripple");
    btn.textContent = "验证雨滴光学与停雨";
    btn.disabled = false;
  };
  $("profile").onclick = async () => {
    const btn = $<HTMLButtonElement>("profile");
    btn.disabled = true;
    const rows = [];
    for (const mode of ["baseline", "boat", "boat+rain"]) {
      btn.textContent = "采样 " + mode;
      seek(ROUTE.heroDistance);
      playing = true;
      simulationEnabled = mode !== "baseline";
      water.uniforms.uLocalStrength.value = simulationEnabled ? 1 : 0;
      hull.enabled = true;
      rain.enabled = mode === "boat+rain";
      environment.apply(
        { ...PRESETS.day, precipitation: mode === "boat+rain" ? 1.8 : 0 },
        true,
      );
      await wait(2000);
      gpu.values.frame = [];
      const start = ripple.passes,
        rainStart = rain.impacts,
        ticks = ripple.steps;
      await wait(6500);
      rows.push({
        mode,
        ...snapshot(),
        passesPerSecond: (ripple.passes - start) / 6.5,
        impactsPerSecond: (rain.impacts - rainStart) / 6.5,
        simulationHz: (ripple.steps - ticks) / 6.5,
      });
    }
    simulationEnabled = true;
    playing = false;
    rain.enabled = check("rain-ripple");
    report("dynamic-profile", rows);
    btn.textContent = "三组性能对比";
    btn.disabled = false;
  };
  const initial = (query.get("preset") || "day") as PresetId;
  choose(initial in PRESETS ? initial : "day");
  environment.apply(environment.target, true);
  const seek = (d: number) => {
    route.seek(d);
    boat.update(route);
    passenger.resetHeading(route.yaw);
    passenger.input.yaw = passenger.input.targetYaw = 0;
    passenger.input.pitch = passenger.input.targetPitch = -0.03;
    water.reset(route.position);
    city.update(d, quality === "low");
    planar.invalidate();
  };
  $("hero").onclick = () => {
    seek(ROUTE.heroDistance);
    $("status").textContent = "夕阳取景点 · 同一构图比较三个 preset";
  };
  $("bridge").onclick = () => {
    seek(45);
    $("status").textContent = "第一座桥下 · 查看水色、阴影与反射";
  };
  $("play").onclick = () => {
    playing = !playing;
    $("play").textContent = playing ? "暂停航行" : "开始航行";
  };
  $("panel-toggle").onclick = () => {
    const hidden = document.body.classList.toggle("panel-hidden");
    $("panel-toggle").textContent = hidden ? "展开面板" : "收起面板";
    $("panel-toggle").setAttribute("aria-expanded", String(!hidden));
  };
  async function showReference() {
    const id = $<HTMLSelectElement>("reference").value as ReferenceId;
    $("reference-status").textContent = "正在读取原始 HDRI…";
    try {
      const current = await reference.load(id);
      if (!current) return;
      $("reference-status").textContent =
        REFERENCES[id].role + " · 1K HDR / CC0";
      $("reference-link").setAttribute("href", "https://polyhaven.com/a/" + id);
      view = "reference";
      $<HTMLSelectElement>("view").value = view;
      $("view-label").textContent =
        REFERENCES[id].label.toUpperCase() + " / HDRI REFERENCE";
    } catch (error) {
      $("reference-status").textContent =
        "参考加载失败，可重新选择；场景继续运行。" + String(error);
    }
  }
  $("show-reference").onclick = () => void showReference();
  $("reference").onchange = () => void showReference();
  const returnScene = () => {
    view = "canal";
    $<HTMLSelectElement>("view").value = view;
    $("view-label").textContent = "VENICE CANAL / MANUAL ENVIRONMENT";
  };
  $("return-scene").onclick = returnScene;
  $("view").onchange = () => {
    const choice = $<HTMLSelectElement>("view").value;
    if (choice === "reference") void showReference();
    else {
      view = choice;
      $("view-label").textContent =
        choice === "sky"
          ? "TAKUSTAQU / SKY ONLY"
          : "VENICE CANAL / MANUAL ENVIRONMENT";
    }
  };
  $("reference-yaw").oninput = () => {
    const value = Number($<HTMLInputElement>("reference-yaw").value);
    reference.material.uniforms.uYaw.value = value / 360;
    $("reference-yaw-value").textContent = value + "°";
  };
  $("golden-study").onclick = () => {
    choose("sunset");
    environment.apply({
      ...PRESETS.sunset,
      elevation: 8.5,
      cover: 0.18,
      cirrus: 0.1,
      altocumulus: 0.08,
      cityLights: 0.2,
    });
    sync();
    $("preset-note").textContent = "Golden 校准点 · 核心 Sunset 预设的早期阶段";
    $<HTMLSelectElement>("reference").value = "venice_sunrise";
    returnScene();
  };
  $("twilight-study").onclick = () => {
    choose("sunset");
    environment.apply({
      ...PRESETS.sunset,
      elevation: -1,
      cover: 0.32,
      altocumulus: 0.24,
      skyExposure: 0.5,
      ambient: 3.2,
    });
    sync();
    $("preset-note").textContent = "晚霞校准点 · 保持建筑与水面清晰可见";
    $<HTMLSelectElement>("reference").value = "twilight_sunset";
    returnScene();
  };
  $("reset").onclick = () => choose(selected);
  const snapshot = () => ({
    preset: selected,
    parameters: environment.target,
    actualSun: {
      elevation: (environment.animator.current.sunElevation * 180) / Math.PI,
      azimuth: (environment.animator.current.sunAzimuth * 180) / Math.PI,
    },
    fps,
    gpu: gpu.stats("frame"),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometry: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    cubeBakes: environment.sky.renders,
    cubeResolution: environment.sky.target.width,
    quality,
    view,
    routeDistance: route.distance,
    waterEmissions: water.interaction.count,
    rainImpacts: rain.impacts,
    weather: {
      intensity: environment.weather.rainIntensity,
      wetness: environment.weather.wetness,
    },
    simulation: {
      resolution: ripple.resolution,
      hz: ripple.hz,
      type: ripple.textureType,
      origin: ripple.origin.toArray(),
      steps: ripple.steps,
      passes: ripple.passes,
      framePasses: ripple.lastPasses,
      scrolls: ripple.scrolls,
      emissions: ripple.emissions,
      rain: ripple.injectedRain,
      rejected: ripple.rejected,
      queue: ripple.queue.length,
    },
    waterSettings: water.settings,
    directSun: water.uniforms.uLabDirect.value,
    framebuffer: { width: canvas.width, height: canvas.height },
    cityErrors: city.errors,
  });
  function save(blob: Blob, name: string) {
    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
      void fetch("../__evidence?name=" + name, { method: "POST", body: blob })
        .then((r) => {
          if (!r.ok) throw Error("save failed");
          $("status").textContent = "已保存 qa/" + name;
        })
        .catch((e) => ($("status").textContent = String(e)));
    } else {
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
  }
  $("export").onclick = () => {
    const p = {
      schema: "venice-atmosphere-v1",
      source: "takustaqu/atmosphere@0.3.2",
      preset: environment.target,
    };
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }),
      );
    a.href = url;
    a.download = "VENICE_" + selected.toUpperCase() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  $("capture").onclick = () => (capture = true);
  $("measure").onclick = () => {
    $("measurement").textContent = JSON.stringify(snapshot(), null, 2);
    save(
      new Blob([JSON.stringify(snapshot(), null, 2)], {
        type: "application/json",
      }),
      "atmosphere-" + selected + "-" + Date.now() + ".json",
    );
  };
  let busy = false;
  async function frame(now: number) {
    if (disposed) return;
    requestAnimationFrame(frame);
    if (document.hidden || busy) {
      last = now;
      return;
    }
    const wallDt = (now - last) / 1000;
    const dt = Math.min(0.05, wallDt);
    last = now;
    time += dt;
    frameSeconds += wallDt;
    frameCount++;
    if (playing) {
      route.update(dt);
      if (route.distance > route.length - 3) {
        playing = false;
        $("play").textContent = "开始航行";
      }
    }
    boat.update(route);
    const heave = water.ocean.heightAt(
      route.position.x,
      route.position.z,
      time,
    );
    boat.visual.position.y = heave;
    passenger.update(dt, route.yaw);
    passenger.camera.getWorldPosition(eye);
    renderer.info.reset();
    gpu.begin("frame");
    environment.update(dt, time, route.position, eye);
    city.update(route.distance, quality === "low");
    scenery.update(route.distance, environment.current.cityLights);
    rainAudio.update(environment.weather.rainIntensity);
    rain.update(
      dt,
      environment.weather.rainIntensity,
      environment.current.wind,
      eye,
    );
    if (simulationEnabled)
      water.update(
        dt,
        time,
        route.position,
        route.tangent,
        playing ? route.speed : 0,
      );
    if (dynamicDebug.root.visible) dynamicDebug.update(hull);
    scene.updateMatrixWorld(true);
    pipeline.exposure = environment.current.exposure;
    if (
      rippleView === "height" ||
      rippleView === "normal" ||
      rippleView === "mask"
    )
      dynamicDebug.render(
        renderer,
        { height: 0, normal: 1, mask: 2 }[rippleView],
      );
    else if (view === "canal") pipeline.render(passenger.camera, time);
    else {
      const sc = view === "sky" ? skyScene : reference.scene;
      const m = view === "sky" ? skyMesh : reference.mesh;
      m.position.copy(eye);
      passenger.camera.updateWorldMatrix(true, false);
      renderer.setRenderTarget(pipeline.hdr);
      renderer.render(sc, passenger.camera);
      const u = pipeline.post.compositeMat.uniforms;
      u.tScene.value = pipeline.hdr.texture;
      u.tBloom.value = pipeline.hdr.texture;
      u.uExposure.value = environment.current.exposure;
      u.uBloom.value = 0;
      u.uSaturation.value = 1;
      u.uContrast.value = 1;
      u.uGrain.value = 0;
      u.uCA.value = 0;
      u.uVignetteAir.value = 0;
      pipeline.post._draw(pipeline.post.compositeMat, null);
    }
    gpu.end();
    gpu.poll();
    if (frameSeconds > 1) {
      fps = frameCount / frameSeconds;
      frameCount = 0;
      frameSeconds = 0;
      $("ripple-stats").textContent = `Origin: ${ripple.origin
        .toArray()
        .map((v) => v.toFixed(2))
        .join(
          ", ",
        )} m\n${ripple.resolution}² / ${ripple.textureType} / ${ripple.hz} Hz\n${ripple.lastPasses} passes this frame / ${ripple.steps} ticks\n${ripple.injectedRain} rain impacts / ${ripple.queue.length} queued`;
      $("stats").textContent =
        Math.round(fps) +
        " FPS · GPU " +
        (gpu.mean("frame")?.toFixed(1) ?? "—") +
        " ms · " +
        renderer.info.render.calls +
        " draws";
    }
    if (capture) {
      capture = false;
      busy = true;
      const name = "atmosphere-" + selected + "-" + view + "-" + Date.now();
      save(
        new Blob([JSON.stringify(snapshot(), null, 2)], {
          type: "application/json",
        }),
        name + ".json",
      );
      canvas.toBlob((blob) => {
        if (blob) save(blob, name + ".png");
        busy = false;
      }, "image/png");
    }
  }
  $("status").textContent = "准备就绪 · 三个预设可直接切换，拖动自由环视";
  if (matchMedia("(max-width:700px)").matches) {
    document.body.classList.add("panel-hidden");
    $("panel-toggle").textContent = "展开面板";
    $("panel-toggle").setAttribute("aria-expanded", "false");
  }
  requestAnimationFrame(frame);
  const dispose = () => {
    disposed = true;
    window.removeEventListener("resize", updateSize);
    passenger.input.dispose();
    city.dispose();
    rain.dispose();
    rainAudio.dispose();
    dynamicDebug.dispose();
    reference.dispose();
    environment.dispose();
    pipeline.dispose();
    water.dispose();
    planar.dispose();
    gpu.dispose();
    scene.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    renderer.dispose();
  };
  window.addEventListener("pagehide", dispose, { once: true });
}
boot().catch((error) => {
  $("status").textContent = "实验页无法启动：" + String(error);
  console.error(error);
});
