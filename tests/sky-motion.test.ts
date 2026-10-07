import { describe, expect, it } from "vitest";
import { SkyFrameBlend } from "../src/environment/lab/SkyFrameBlend";

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
