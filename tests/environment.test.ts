import { describe, it, expect } from "vitest";
import { environmentAt } from "../src/environment/EnvironmentController";
import {
  journeyPreset,
  JOURNEY_WEATHER,
} from "../src/environment/JourneyEnvironment";
import {
  PRESETS,
  directSunVisibility,
  atmosphereState,
} from "../src/environment/lab/presets";
describe("desktop weather controls", () => {
  it("keeps the daylight baseline and ends at sunset, never night", () => {
    expect(journeyPreset(0)).toEqual(PRESETS.day);
    expect(journeyPreset(0.43)).toEqual(PRESETS.day);
    expect(journeyPreset(1).elevation).toBe(PRESETS.sunset.elevation);
    expect(JOURNEY_WEATHER).toEqual(["journey", "day", "sunset", "rain"]);
    let previous = journeyPreset(0);
    for (let i = 1; i <= 1000; i++) {
      const next = journeyPreset(i / 1000);
      expect(Math.abs(next.elevation - previous.elevation)).toBeLessThan(0.14);
      expect(next.elevation).toBeGreaterThanOrEqual(5.5);
      expect(next.precipitation).toBe(0);
      previous = next;
    }
  });
});
describe("legacy cinematic environment progression", () => {
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

describe("rain obscures the direct sun", () => {
  it("shares a continuous visibility gate and fully obscures the light-rain preset", () => {
    expect(directSunVisibility(atmosphereState(PRESETS.day).rain)).toBe(1);
    expect(directSunVisibility(atmosphereState(PRESETS.sunset).rain)).toBe(1);
    expect(directSunVisibility(atmosphereState(PRESETS.rain).rain)).toBe(0);
    let last = 1;
    for (let i = 0; i <= 300; i++) {
      const value = directSunVisibility(i / 1000);
      expect(value).toBeLessThanOrEqual(last);
      expect(last - value).toBeLessThan(0.01);
      last = value;
    }
  });
});
