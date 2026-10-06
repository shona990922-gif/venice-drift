import { describe, it, expect } from "vitest";
import { AdaptiveQuality } from "../src/core/AdaptiveQuality";
describe("sustained performance adaptation", () => {
  it("does not degrade for a 30 Hz display cap or one loading spike", () => {
    const q = new AdaptiveQuality(false);
    for (let i = 0; i < 120; i++) q.update(0.5, 33.333, 10);
    expect(q.changes).toEqual([]);
    q.update(0.5, 150, 100);
    for (let i = 0; i < 10; i++) q.update(0.5, 16.667, 10);
    expect(q.changes).toEqual([]);
  });
  it("reduces resolution gradually before reflections, shadows and details", () => {
    const q = new AdaptiveQuality(false);
    for (let i = 0; i < 90; i++) q.update(0.5, 45, 35);
    expect(q.pixelScale).toBeCloseTo(0.76);
    expect(q.reflectionScale).toBe(0.5);
    expect(q.shadowScale).toBe(0.5);
    expect(q.reducedDetails).toBe(true);
    expect(q.changes.slice(0, 4)).toEqual(Array(4).fill("pixel ratio"));
    expect(q.changes.slice(4)).toEqual([
      "reflection resolution",
      "shadow resolution",
      "far detail",
    ]);
  });
});
