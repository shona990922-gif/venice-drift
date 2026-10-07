import { describe, expect, it } from "vitest";
import { SkyFrameBlend } from "../src/environment/lab/SkyFrameBlend";
import { StateAnimator } from "@takustaqu/atmosphere";
import {
  atmosphereState,
  CALM_SKY_ANIMATOR,
  PRESETS,
} from "../src/environment/lab/presets";

describe("quiet cloud motion", () => {
  for (const mode of ["day", "rain"] as const)
    it(`slows ${mode} clouds without slowing lighting transitions`, () => {
      const initial = atmosphereState(PRESETS.day),
        target = atmosphereState(PRESETS[mode]),
        upstream = new StateAnimator(initial, { tau: 3.2 }),
        calm = new StateAnimator(initial, CALM_SKY_ANIMATOR),
        wind = calm.wind,
        evolution = calm.evolution;
      for (let i = 0; i < 600; i++) {
        calm.step(target, 1 / 60);
        upstream.step(target, 1 / 60);
      }
      expect((calm.wind - wind) / (upstream.wind - wind)).toBeCloseTo(0.1, 6);
      expect(
        (calm.evolution - evolution) / (upstream.evolution - evolution),
      ).toBeCloseTo(0.025, 6);
      expect(calm.current).toEqual(upstream.current);
      const phase = [calm.wind, calm.evolution];
      calm.jump(atmosphereState(PRESETS.sunset));
      expect([calm.wind, calm.evolution]).toEqual(phase);
    });

  it("uses fewer high-resolution bakes while continuously blending complete cubes", () => {
    const frames = new SkyFrameBlend();
    frames.minimumDuration = 0.9;
    frames.reset(0);
    const captures = [0, 0, 0],
      finished = [true, false, false];
    let faces = 0,
      previous = 0;
    for (let i = 1; i <= 720; i++) {
      const time = i / 60,
        published = frames.tick(time);
      expect(finished[frames.current]).toBe(true);
      expect(finished[frames.previous]).toBe(true);
      const face = frames.pendingFace;
      if (!published && face !== null) {
        if (face === 0) {
          captures[frames.writing] = time;
          finished[frames.writing] = false;
        }
        frames.completeFace();
        faces++;
        if (face === 5) finished[frames.writing] = true;
      }
      const value =
        captures[frames.previous] * (1 - frames.blend) +
        captures[frames.current] * frames.blend;
      if (i > 120) {
        expect(value).toBeGreaterThan(previous);
        expect(value - previous).toBeLessThan(0.03);
      }
      previous = value;
    }
    expect(faces).toBeLessThan(90);
    expect(faces).toBeGreaterThan(60);
  });
});

describe("continuous sky publication", () => {
  for (const hz of [60, 30, 20])
    it(`keeps complete buffers and continuous light at ${hz} Hz`, () => {
      const frames = new SkyFrameBlend();
      frames.reset(0);
      const colours = [0, 0, 0],
        finished = [true, false, false];
      let previous = 0,
        held = 0,
        maxHeld = 0,
        publications = 0;
      for (let i = 1; i < 600; i++) {
        const time = i / hz;
        const oldCurrent = frames.current;
        const published = frames.tick(time);
        if (published) {
          publications++;
          expect(finished[frames.current]).toBe(true);
          expect(frames.previous).toBe(oldCurrent);
          expect(frames.blend).toBe(0);
        }
        expect(finished[frames.previous]).toBe(true);
        expect(finished[frames.current]).toBe(true);
        expect(frames.writing).not.toBe(frames.previous);
        expect(frames.writing).not.toBe(frames.current);
        const face = frames.pendingFace;
        if (face !== null && !published) {
          if (face === 0) {
            colours[frames.writing] = time;
            finished[frames.writing] = false;
          }
          frames.completeFace();
          if (face === 5) finished[frames.writing] = true;
        }
        const displayed =
          colours[frames.previous] * (1 - frames.blend) +
          colours[frames.current] * frames.blend;
        if (i > 50) {
          expect(displayed).toBeGreaterThanOrEqual(previous);
          expect(displayed - previous).toBeLessThan(2 / hz);
          held = displayed === previous ? held + 1 : 0;
          maxHeld = Math.max(maxHeld, held);
        }
        previous = displayed;
      }
      expect(publications).toBeGreaterThan(40);
      expect(maxHeld).toBeLessThanOrEqual(1);
    });
});
