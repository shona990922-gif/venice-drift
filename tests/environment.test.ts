import { describe, it, expect } from "vitest";
import { environmentAt } from "../src/environment/EnvironmentController";
describe("cinematic environment progression", () => {
  it("preserves the daylight baseline through the first 43% of the trip", () => {
    expect(environmentAt(0.4)).toEqual(environmentAt(0));
    expect(environmentAt(0).elevation).toBe(58);
  });
  it("moves the sun and exposure continuously without a preset switch", () => {
    let last = environmentAt(0);
    for (let i = 1; i <= 10000; i++) {
      const s = environmentAt(i / 10000);
      expect(Math.abs(s.elevation - last.elevation)).toBeLessThan(0.05);
      expect(Math.abs(s.azimuth - last.azimuth)).toBeLessThan(0.08);
      expect(Math.abs(s.exposure - last.exposure)).toBeLessThan(0.001);
      expect(s.lights).toBeGreaterThanOrEqual(last.lights);
      last = s;
    }
    expect(last.elevation).toBeCloseTo(5.8);
    expect(last.lights).toBe(0.55);
  });
  it("places the low sun ahead at the hero basin, with open sky above the arch", () => {
    const hero = environmentAt(381 / 499.727);
    expect(hero.azimuth).toBe(267);
    expect(hero.elevation).toBeGreaterThan(7.3);
    expect(hero.elevation).toBeLessThan(12);
  });
});
