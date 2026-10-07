import {
  FloatType,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import type { ManualEnvironment } from "../environment/lab/ManualEnvironment";
import { PRESETS, sunDirection } from "../environment/lab/presets";
/** Sample the actual shared sky shader, not merely its state variables.
 * The small offscreen readback is QA only, excluded from journey profiling. */
export async function auditSkyMotion(
  renderer: WebGLRenderer,
  env: ManualEnvironment,
) {
  const scene = new Scene(),
    camera = new PerspectiveCamera(85, 1.5, 0.1, 2000);
  scene.add(new Mesh(env.sky.display.geometry, env.sky.display.material));
  camera.lookAt(sunDirection(30, 154));
  const target = new WebGLRenderTarget(96, 64, {
    type: FloatType,
    depthBuffer: false,
  });
  let previous = new Float32Array(96 * 64 * 4),
    pixels = new Float32Array(previous.length);
  const saved = { ...env.target },
    origin = new Vector3(),
    eye = new Vector3(0, 1.5, 0);
  const phases = [];
  let time = 0;
  try {
    for (const mode of ["day", "sunset", "rain"] as const) {
      env.apply(PRESETS[mode], mode === "day");
      let held = 0,
        maxHeld = 0,
        changedFrames = 0,
        maxFaces = 0;
      const differences = [];
      for (let i = 0; i < 150; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        time += 1 / 60;
        env.update(1 / 60, time, origin, eye);
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, 96, 64, pixels);
        renderer.setRenderTarget(null);
        let difference = 0;
        for (let p = 0; p < pixels.length; p += 4)
          difference +=
            Math.abs(pixels[p] - previous[p]) +
            Math.abs(pixels[p + 1] - previous[p + 1]) +
            Math.abs(pixels[p + 2] - previous[p + 2]);
        difference /= 96 * 64 * 3;
        if (i >= 30) {
          differences.push(difference);
          if (difference > 1e-7) {
            changedFrames++;
            held = 0;
          } else held++;
          maxHeld = Math.max(maxHeld, held);
          maxFaces = Math.max(maxFaces, env.sky.frameFaces);
        }
        [pixels, previous] = [previous, pixels];
      }
      phases.push({
        mode,
        frames: 120,
        changedFrames,
        maxHeldFrames: maxHeld,
        maxSkyFacesPerFrame: maxFaces,
        meanDifference:
          differences.reduce((a, b) => a + b, 0) / differences.length,
        maxDifference: Math.max(...differences),
        pass: changedFrames >= 114 && maxHeld <= 2 && maxFaces <= 1,
      });
    }
    return {
      test: "Actual linear HDR sky pixels; fixed camera; 60 Hz simulation, QA readback excluded from performance measurements",
      phases,
      pass: phases.every((p) => p.pass),
    };
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    // Mesh borrows live geometry/material; only dispose the QA render target.
    env.apply(saved, true);
  }
}
