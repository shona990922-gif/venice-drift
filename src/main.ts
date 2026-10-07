import "./style.css";
import { auditLook } from "./diagnostics/LookAudit";
import { disposeSceneAssets } from "./core/dispose";
import { JourneyAudit } from "./diagnostics/JourneyAudit";
import { AdaptiveQuality } from "./core/AdaptiveQuality";
import { AmbientAudio } from "./audio/AmbientAudio";
import {
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  SRGBColorSpace,
  PCFShadowMap,
} from "three";
import { RouteController, ROUTE } from "./journey/RouteController";
import { BoatController } from "./journey/BoatController";
import {
  PassengerCamera,
  PASSENGER_EYE_HEIGHT,
} from "./journey/PassengerCamera";
import { loadMaterials, materialWarnings } from "./city/Materials";
import { VenetianKit } from "./city/VenetianKit";
import { CityChunkManager } from "./city/CityChunkManager";
import { JourneyScenery } from "./city/JourneyScenery";
import { PlanarReflection } from "./water/PlanarReflection";
import { WaterThreeCanal } from "./water/v2/WaterThreeCanal";
import { WaterRenderer } from "./water/v2/WaterRenderer";
import { WATER_QUALITY, type WaterQuality } from "./water/v2/Presets";
import {
  JourneyEnvironment,
  JOURNEY_WEATHER,
} from "./environment/JourneyEnvironment";
import { DynamicRippleSystem } from "./water/DynamicRippleSystem";
import { RainWaterInteraction } from "./water/RainWaterInteraction";
import { GpuTimer } from "./diagnostics/GpuTimer";
const $ = (id: string) => document.getElementById(id)!;
const query = new URLSearchParams(location.search);
const debug = query.has("debug");
async function boot() {
  const canvas = $("scene") as HTMLCanvasElement;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false;
  if (
    !renderer.capabilities.isWebGL2 ||
    !renderer.extensions.has("EXT_color_buffer_float")
  )
    throw Error(
      "此设备缺少 Water V2 所需的 WebGL2 浮点纹理支持。请换用支持硬件加速的浏览器。",
    );
  const mobile = matchMedia("(pointer:coarse)").matches,
    adaptive = new AdaptiveQuality(mobile);
  const q = (query.get("quality") ||
      (mobile ? "low" : "medium")) as WaterQuality,
    quality = q in WATER_QUALITY ? q : "medium",
    profile = WATER_QUALITY[quality];
  const audio = new AmbientAudio();
  let soundWanted = true;
  try {
    soundWanted = localStorage.getItem("venice.sound") !== "off";
  } catch {
    /* Audio works without storage. */
  }
  const soundLabel = () => {
    const label = audio.enabled ? "Sound on" : "Sound off";
    $("sound").textContent = label;
    $("sound").setAttribute("aria-label", label);
  };
  const enableSound = () => {
    void audio.setEnabled(soundWanted).then(() => {
      soundLabel();
      if (audio.error)
        $("notice").textContent = "Audio unavailable; the journey continues.";
    });
  };
  $("sound").onclick = () => {
    soundWanted = !audio.enabled;
    try {
      localStorage.setItem("venice.sound", soundWanted ? "on" : "off");
    } catch {
      /* Optional preference. */
    }
    enableSound();
  };
  const scene = new Scene(),
    route = new RouteController(),
    boat = new BoatController();
  boat.update(route);
  scene.add(boat.root);
  const passenger = new PassengerCamera(boat.root, canvas);
  const planar = new PlanarReflection(renderer, profile.reflection);
  planar.interval = quality === "low" ? 2 : 1;
  const water = new WaterThreeCanal(
    renderer,
    route,
    new Vector3(0, 1, 0),
    planar,
    quality,
    query.get("water") !== "v2",
  );
  scene.add(water.mesh, water.bed);
  const environment = new JourneyEnvironment(
      scene,
      renderer,
      water,
      128, // Cloud cubemap is filtered for lighting; reserve GPU detail for water.
    ),
    pipeline = new WaterRenderer(renderer, scene, water, planar, quality),
    gpu = new GpuTimer(renderer.getContext() as WebGL2RenderingContext);
  const rain =
    water.simulation instanceof DynamicRippleSystem
      ? new RainWaterInteraction(water.simulation, quality)
      : null;
  if (rain) scene.add(rain.mesh);
  const weatherControl = $("weather") as HTMLSelectElement;
  const speedControl = $("speed") as HTMLSelectElement;
  let resumePace = 1;
  const changeWeather = () => environment.select(weatherControl.value);
  const changeSpeed = () => {
    route.setSpeedFactor(Number(speedControl.value));
    if (route.speedFactor > 0) resumePace = route.speedFactor;
  };
  weatherControl.onchange = changeWeather;
  speedControl.onchange = changeSpeed;
  const shortcut = (event: KeyboardEvent) => {
    if (
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName)))
    )
      return;
    const key = event.key.toLowerCase();
    if (key === "w") {
      weatherControl.value =
        JOURNEY_WEATHER[
          (JOURNEY_WEATHER.indexOf(environment.mode) + 1) %
            JOURNEY_WEATHER.length
        ];
      changeWeather();
    } else if (key === "v") {
      const speeds = [0, 0.65, 1, 1.25];
      speedControl.value = String(
        speeds[(speeds.indexOf(route.speedFactor) + 1) % speeds.length],
      );
      changeSpeed();
    } else if (event.code === "Space" && started) {
      event.preventDefault();
      speedControl.value = String(route.speedFactor === 0 ? resumePace : 0);
      changeSpeed();
    }
  };
  window.addEventListener("keydown", shortcut);
  const materials = await loadMaterials(
      quality === "low",
      debug && query.has("missingTexture"),
    ),
    kit = new VenetianKit(materials),
    city = new CityChunkManager(route, kit),
    scenery = new JourneyScenery(route, kit);
  scene.add(city.root, scenery.root);
  await city.start();
  environment.bindCity(kit);
  const size = new Vector2(),
    eye = new Vector3();
  let started = false,
    paused = false,
    time = 0,
    last = performance.now(),
    heave = 0,
    frames = 0,
    elapsed = 0,
    fps = 0,
    calls = 0,
    triangles = 0,
    cs = 0,
    ts = 0,
    fade = -1,
    fadeReset = false,
    loop = 0,
    shot = false,
    disposed = false,
    lookAuditBusy = false;
  const resize = () => {
    if (innerWidth < 2 || innerHeight < 2) return;
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, profile.pixelRatio) * adaptive.pixelScale,
    );
    renderer.setSize(innerWidth, innerHeight, false);
    passenger.resize(innerWidth, innerHeight);
    renderer.getDrawingBufferSize(size);
    pipeline.resize(size.x, size.y);
    planar.invalidate();
  };
  window.addEventListener("resize", resize);
  resize();
  environment.sun.shadow.mapSize.setScalar(
    quality === "high" ? 2048 : quality === "low" ? 512 : 1024,
  );
  let contextLost = false;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    contextLost = true;
    $("error").hidden = false;
    $("error").textContent =
      "The graphics connection was interrupted. Waiting to restore your journey…";
  });
  canvas.addEventListener("webglcontextrestored", () => location.reload());
  const start = () => {
    if (!started) enableSound();
    started = true;
    passenger.input.enabled = true;
    document.body.classList.add("started");
    $("hint").classList.add("visible");
    setTimeout(() => $("hint").classList.remove("visible"), 4200);
  };
  $("start").onclick = start;
  if (matchMedia("(pointer:coarse)").matches)
    $("hint").textContent = "Swipe to look around";
  const seek = (distance: number, preserveFade = false) => {
    if (!preserveFade) {
      fade = -1;
      fadeReset = false;
      pipeline.fadeAmount = 0;
    }
    route.seek(distance);
    boat.update(route);
    passenger.resetHeading(route.yaw);
    city.update(route.distance, quality === "low" || adaptive.reducedDetails);
    water.reset(route.position);
    planar.invalidate();
  };
  if (debug) {
    $("debug").hidden = false;
    $("inspect-go").onclick = () => {
      start();
      seek(Number(($("inspect-distance") as HTMLInputElement).value));
      paused = true;
      $("pause").textContent = "继续";
    };
    for (const [id, d] of [
      ["jump-start", 0],
      ["jump-bridge", ROUTE.bridgeDistance - 12],
      ["jump-hero", ROUTE.heroDistance],
      ["jump-golden", 300],
      ["jump-end", 465],
    ] as const)
      $(id).onclick = () => {
        start();
        seek(d);
      };
    $("pause").onclick = () => {
      paused = !paused;
      $("pause").textContent = paused ? "继续" : "暂停";
    };
    $("capture").onclick = () => (shot = true);
  }
  const fullscreenUnavailable = () => {
    $("notice").textContent = "Full screen is unavailable in this browser.";
  };
  document.addEventListener("fullscreenchange", () => {
    const label = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
    $("fullscreen").textContent = label;
    $("fullscreen").setAttribute("aria-label", label);
  });
  $("fullscreen").onclick = async () => {
    if (
      !document.fullscreenEnabled ||
      !document.documentElement.requestFullscreen
    ) {
      fullscreenUnavailable();
      return;
    }
    const entering = !document.fullscreenElement;
    const timeout = setTimeout(() => {
      if (entering && !document.fullscreenElement) fullscreenUnavailable();
    }, 1200);
    try {
      if (entering) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      if (entering && !document.fullscreenElement) fullscreenUnavailable();
    } catch {
      fullscreenUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  };
  ($("quality") as HTMLSelectElement).value = quality;
  ($("quality") as HTMLSelectElement).onchange = () => {
    const u = new URL(location.href);
    u.searchParams.set("quality", ($("quality") as HTMLSelectElement).value);
    try {
      sessionStorage.setItem(
        "venice.resume",
        JSON.stringify({
          started,
          distance: route.distance,
          weather: environment.mode,
          speedFactor: route.speedFactor,
          actualSpeed: route.speed,
          yaw: passenger.input.yaw,
          pitch: passenger.input.pitch,
        }),
      );
    } catch {
      /* Optional continuity on storage-restricted browsers. */
    }
    location.href = u.href;
  };
  const snapshot = () => ({
    resources: {
      sameOriginEncodedBytes: performance
        .getEntriesByType("resource")
        .filter((e) => e.name.startsWith(location.origin))
        .reduce(
          (s, e) => s + (e as PerformanceResourceTiming).encodedBodySize,
          0,
        ),
      pbrMemoryEstimateMiB: ((quality === "low" ? 15 : 24) * 4 * 4) / 3,
    },
    version: "1.0.0-rc.1",
    fps,
    gpu: gpu.stats("journey"),
    framebuffer: size.toArray(),
    drawCalls: calls,
    triangles,
    time,
    distance: route.distance,
    length: route.length,
    speed: route.speed,
    speedFactor: route.speedFactor,
    loop,
    quality,
    loadedChunks: [...city.loaded.keys()],
    pendingChunks: [...city.pending.keys()],
    chunkLoads: city.loads,
    chunkDisposals: city.unloads,
    geometryCount: renderer.info.memory.geometries,
    textureCount: renderer.info.memory.textures,
    sizedRenderTargets: 6,
    auxiliaryOnePixelTargets: 5,
    adaptive: { pixelScale: adaptive.pixelScale, changes: adaptive.changes },
    reflectionResolution: planar.target.width,
    simulationResolution: water.simulation.resolution,
    emissions: water.interaction.count,
    camera: passenger.camera.getWorldPosition(eye).toArray(),
    look: [passenger.input.yaw, passenger.input.pitch],
    pointer: passenger.input.lastPointerType,
    environment: {
      mode: environment.mode,
      rainIntensity: environment.weather.rainIntensity,
      rainImpacts: rain?.impacts ?? 0,
      elevation: environment.elevation,
      azimuth: environment.azimuth,
    },
    errors: [...city.errors, ...materialWarnings],
    audio: audio.snapshot(),
  });
  if (debug) {
    $("measure").onclick = () => {
      $("measurement").textContent = JSON.stringify(snapshot(), null, 2);
    };
    Object.assign(window, {
      __VENICE_DEBUG__: {
        snapshot,
        start,
        seek,
        route,
        boat,
        water,
        passenger,
        city,
        scenery,
        renderer,
        environment,
        pipeline,
        pause: (p: boolean) => (paused = p),
      },
    });
  }
  $("loading").remove();
  if (materialWarnings.length)
    $("notice").textContent =
      "Some scene details could not load; the journey continues.";
  ($("start") as HTMLButtonElement).disabled = false;
  if (query.has("autostart")) start();
  try {
    const saved = sessionStorage.getItem("venice.resume");
    sessionStorage.removeItem("venice.resume");
    if (saved) {
      const r = JSON.parse(saved);
      environment.select(r.weather);
      weatherControl.value = environment.mode;
      if ([0, 0.65, 1, 1.25].includes(r.speedFactor)) {
        speedControl.value = String(r.speedFactor);
        changeSpeed();
        if (Number.isFinite(r.actualSpeed))
          route.speed = Math.max(0, Math.min(1.9375, r.actualSpeed));
      }
      if (r.started) {
        start();
        seek(Math.max(0, Math.min(route.length, Number(r.distance) || 0)));
        passenger.input.yaw = passenger.input.targetYaw = Number(r.yaw) || 0;
        passenger.input.pitch = passenger.input.targetPitch = Math.max(
          -1.22,
          Math.min(1.32, Number(r.pitch) || 0),
        );
      }
    }
  } catch {
    /* Storage is optional. */
  }
  environment.initialize(route.distance / route.length);
  const save = (blob: Blob, name: string) => {
    if (
      import.meta.env.DEV ||
      (query.has("qa") &&
        ["127.0.0.1", "localhost"].includes(location.hostname))
    ) {
      void fetch("/__evidence?name=" + name, {
        method: "POST",
        body: blob,
      }).then((r) => {
        if (!r.ok) throw Error("Cannot save evidence");
        $("notice").textContent = "已保存 " + name;
      });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }
  };
  if (debug)
    $("interaction-check").onclick = async () => {
      const button = $("interaction-check") as HTMLButtonElement;
      button.disabled = true;
      button.textContent = "采样航行中的尾流…";
      const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      start();
      seek(ROUTE.heroDistance);
      paused = false;
      $("pause").textContent = "暂停";
      passenger.input.targetYaw = 0;
      passenger.input.targetPitch = -0.25;
      await wait(6500);
      paused = true;
      $("pause").textContent = "继续";
      await wait(900);
      const energy = () => {
        const data = water.simulation.sample();
        let peak = 0,
          sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          peak = Math.max(peak, Math.abs(data[i]));
          sum += data[i] * data[i];
        }
        return {
          peakHeightMetres: peak,
          meanSquareHeight: sum / (data.length / 4),
        };
      };
      const before = energy(),
        emissions = water.interaction.count,
        gl = renderer.getContext(),
        pixels = size.x * size.y * 4;
      const compare = (view: number) => {
        const a = new Uint8Array(pixels),
          b = new Uint8Array(pixels);
        water.uniforms.uWaterView.value = view;
        water.uniforms.uLocalStrength.value = 1;
        pipeline.render(passenger.camera, time);
        gl.readPixels(0, 0, size.x, size.y, gl.RGBA, gl.UNSIGNED_BYTE, a);
        water.uniforms.uLocalStrength.value = 0;
        pipeline.render(passenger.camera, time);
        gl.readPixels(0, 0, size.x, size.y, gl.RGBA, gl.UNSIGNED_BYTE, b);
        let changed = 0,
          max = 0;
        for (let i = 0; i < pixels; i += 4) {
          const v = Math.max(
            Math.abs(a[i] - b[i]),
            Math.abs(a[i + 1] - b[i + 1]),
            Math.abs(a[i + 2] - b[i + 2]),
          );
          if (v > 2) changed++;
          max = Math.max(max, v);
        }
        return { changedPixels: changed, maxChannelChange: max };
      };
      const reflection = compare(1),
        composite = compare(0);
      water.uniforms.uLocalStrength.value = 1;
      water.uniforms.uWaterView.value = 0;
      button.textContent = "验证停止后的自然衰减…";
      await wait(10000);
      const after = energy(),
        ratio =
          after.meanSquareHeight / Math.max(1e-16, before.meanSquareHeight);
      const result = {
        before,
        after,
        reflection,
        composite,
        energyRatio: ratio,
        emissionsAtStop: emissions,
        emissionsAfterDecay: water.interaction.count,
        pass:
          reflection.changedPixels > 20 &&
          composite.changedPixels > 20 &&
          ratio < 0.3 &&
          emissions === water.interaction.count,
        snapshot: snapshot(),
      };
      $("measurement").textContent = JSON.stringify(result, null, 2);
      save(
        new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        }),
        "sunset-wake-" + Date.now() + ".json",
      );
      button.disabled = false;
      button.textContent = "验证尾流";
    };
  if (debug)
    $("touch-check").onclick = async () => {
      start();
      paused = false;
      $("pause").textContent = "暂停";
      const distance = route.distance;
      const yaw = passenger.input.yaw,
        pitch = passenger.input.pitch;
      const options = {
        pointerType: "touch",
        pointerId: 901,
        isPrimary: true,
        button: 0,
        bubbles: true,
        cancelable: true,
      };
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...options,
          clientX: 160,
          clientY: 380,
        }),
      );
      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          ...options,
          clientX: 270,
          clientY: 330,
        }),
      );
      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          ...options,
          clientX: 270,
          clientY: 330,
        }),
      );
      await new Promise((r) => setTimeout(r, 600));
      const looked = [passenger.input.yaw, passenger.input.pitch];
      await new Promise((r) => setTimeout(r, 900));
      const result = {
        test: "Browser-dispatched touch PointerEvents; not a physical handset test",
        pointer: passenger.input.lastPointerType,
        angleChange: [looked[0] - yaw, looked[1] - pitch],
        routeAdvanced: route.distance - distance,
        noRecentering: Math.abs(passenger.input.yaw - looked[0]) < 0.002,
        pass:
          passenger.input.lastPointerType === "touch" &&
          Math.abs(looked[0] - yaw) > 0.3 &&
          Math.abs(looked[1] - pitch) > 0.1 &&
          route.distance - distance > 0.2,
        snapshot: snapshot(),
      };
      $("measurement").textContent = JSON.stringify(result, null, 2);
      save(
        new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        }),
        "touch-qa-" + Date.now() + ".json",
      );
    };
  if (debug)
    $("record").onclick = () => {
      const button = $("record") as HTMLButtonElement;
      if (!("MediaRecorder" in window)) {
        $("notice").textContent = "Recording unavailable in this browser.";
        return;
      }
      const stream = canvas.captureStream(30);
      for (const track of audio.stream?.stream.getAudioTracks() || [])
        stream.addTrack(track);
      const mime = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ].find(MediaRecorder.isTypeSupported);
      const recorder = new MediaRecorder(
          stream,
          mime ? { mimeType: mime, videoBitsPerSecond: 5500000 } : undefined,
        ),
        parts: BlobPart[] = [];
      button.disabled = true;
      button.textContent = "录制中…";
      recorder.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      recorder.onstop = () => {
        save(
          new Blob(parts, { type: "video/webm" }),
          "journey-clip-" + Date.now() + ".webm",
        );
        stream.getVideoTracks().forEach((t) => t.stop());
        button.disabled = false;
        button.textContent = "录制 12 秒";
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 12000);
    };
  if (debug)
    $("look-check").onclick = async () => {
      const button = $("look-check") as HTMLButtonElement;
      const old = { yaw: passenger.input.yaw, pitch: passenger.input.pitch };
      button.disabled = true;
      lookAuditBusy = true;
      try {
        const result = await auditLook(
          renderer,
          passenger.camera,
          (yaw, pitch) => {
            passenger.input.yaw = passenger.input.targetYaw = yaw;
            passenger.input.pitch = passenger.input.targetPitch = pitch;
            passenger.update(0, route.yaw);
            scene.updateMatrixWorld(true);
            planar.invalidate();
            pipeline.render(passenger.camera, time);
          },
        );
        const report = { ...result, ...snapshot() };
        $("measurement").textContent = JSON.stringify(report, null, 2);
        save(
          new Blob([JSON.stringify(report)], { type: "application/json" }),
          "look-audit-" + Date.now() + ".json",
        );
      } finally {
        passenger.input.yaw = passenger.input.targetYaw = old.yaw;
        passenger.input.pitch = passenger.input.targetPitch = old.pitch;
        lookAuditBusy = false;
        frames = elapsed = cs = ts = 0;
        last = performance.now();
        button.disabled = false;
      }
    };
  const audit = new JourneyAudit(
    snapshot,
    save,
    () => (shot = true),
    (t) => ($("audit-status").textContent = t),
  );
  if (debug)
    $("audit").onclick = () => {
      start();
      seek(0);
      loop = 0;
      fade = -1;
      pipeline.fadeAmount = 0;
      paused = false;
      $("pause").textContent = "暂停";
      audit.start(loop);
    };
  document.addEventListener("visibilitychange", () => {
    audit.visibility();
    last = performance.now();
    elapsed = 0;
    frames = 0;
    void audio.visible(!document.hidden);
  });
  function frame(now: number) {
    if (disposed) return;
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000;
    last = now;
    if (document.hidden || contextLost || lookAuditBusy) return;
    const dt = Math.min(0.05, Math.max(0, raw));
    time += dt;
    // Keep moving through the fade, including the hidden reset. The end must
    // never look like the gondola suddenly brakes against an invisible wall.
    if (started && !paused) route.update(dt);
    if (
      started &&
      !paused &&
      fade < 0 &&
      route.length - route.distance <= route.speed * 3.2
    ) {
      fade = 0;
      fadeReset = false;
    }
    if (fade >= 0) {
      fade += dt;
      pipeline.fadeAmount =
        fade < 3 ? fade / 3 : Math.max(0, 1 - (fade - 3) / 4);
      if (fade >= 3 && !fadeReset) {
        seek(0, true);
        loop++;
        fadeReset = true;
        pipeline.fadeAmount = 1;
      }
      if (fade > 7) {
        fade = -1;
        fadeReset = false;
      }
    }
    boat.update(route);
    const h = water.ocean.heightAt(route.position.x, route.position.z, time);
    heave += (h - heave) * (1 - Math.exp(-dt * 2.8));
    boat.visual.position.y = heave;
    boat.visual.rotation.z = Math.sin(time * 0.52) * 0.008;
    boat.visual.rotation.x = Math.sin(time * 0.41) * 0.004;
    passenger.passenger.position.y =
      PASSENGER_EYE_HEIGHT +
      heave * (matchMedia("(pointer:coarse)").matches ? 0.16 : 0.25);
    passenger.update(dt, route.yaw);
    passenger.camera.getWorldPosition(eye);
    renderer.info.reset();
    gpu.begin("journey");
    environment.advance(
      dt,
      time,
      route.position,
      eye,
      route.distance / route.length,
    );
    audio.update(
      route.distance,
      route.distance / route.length,
      started && !paused ? route.speed : 0,
      passenger.input.yaw,
      pipeline.fadeAmount,
      environment.weather.rainIntensity,
    );
    city.update(route.distance, quality === "low" || adaptive.reducedDetails);
    scenery.update(route.distance, environment.state.lights);
    scene.updateMatrixWorld(true);
    rain?.update(
      dt,
      environment.weather.rainIntensity,
      environment.current.wind,
      eye,
    );
    water.update(
      dt,
      time,
      route.position,
      route.tangent,
      started && !paused ? route.speed : 0,
    );
    pipeline.exposure = environment.exposure;
    pipeline.render(passenger.camera, time);
    gpu.end();
    gpu.poll();
    audit.frame(raw, route.distance, loop);
    cs += renderer.info.render.calls;
    ts += renderer.info.render.triangles;
    elapsed += raw;
    frames++;
    if (elapsed >= 0.7) {
      fps = frames / elapsed;
      if (adaptive.update(elapsed, 1000 / fps, gpu.mean("journey"))) {
        resize();
        planar.configure(
          Math.max(256, profile.reflection * adaptive.reflectionScale),
          quality === "low" ? 2 : 1,
        );
        const shadow = environment.sun.shadow;
        shadow.mapSize.setScalar(
          (quality === "high" ? 2048 : quality === "low" ? 512 : 1024) *
            adaptive.shadowScale,
        );
        shadow.map?.dispose();
        shadow.map = null;
      }
      calls = Math.round(cs / frames);
      triangles = Math.round(ts / frames);
      frames = 0;
      elapsed = 0;
      cs = 0;
      ts = 0;
      if (debug)
        $("stats").textContent =
          `${fps.toFixed(0)} FPS · ${gpu.mean("journey")?.toFixed(1) || "—"} GPU ms · ${calls} draws · ${Math.round(triangles / 1000)}k tri · ${route.distance.toFixed(0)}/${route.length.toFixed(0)}m · Chunks ${[...city.loaded.keys()].join(",")}`;
    }
    if (shot) {
      shot = false;
      const name = "journey-" + Math.round(route.distance) + "-" + Date.now();
      save(
        new Blob([JSON.stringify(snapshot(), null, 2)], {
          type: "application/json",
        }),
        name + ".json",
      );
      canvas.toBlob((b) => {
        if (b) save(b, name + ".png");
      });
    }
  }
  requestAnimationFrame(frame);
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      window.removeEventListener("keydown", shortcut);
      rain?.dispose();
      audio.dispose();
      disposeSceneAssets(scene);
      passenger.input.dispose();
      city.dispose();
      scenery.dispose();
      environment.dispose();
      water.dispose();
      planar.dispose();
      pipeline.dispose();
      gpu.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}
boot().catch((error) => {
  $("error").hidden = false;
  $("error").textContent = String(error);
  console.error(error);
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
