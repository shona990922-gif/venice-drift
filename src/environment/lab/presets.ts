import {
  resolveConditions,
  type AtmosphereState,
  type AnimatorOptions,
} from "@takustaqu/atmosphere";
import { MathUtils, Vector3 } from "three";
// Use the upstream animator's independent integrated rates, preserving its
// phase/seed and weather response. Clouds drift slowly and keep their shape;
// cinematic sun movement must not accelerate cloud motion into a time lapse.
export const CALM_SKY_ANIMATOR: AnimatorOptions = {
  tau: 3.2,
  windBase: 0.0006,
  windGust: 0.022,
  evoBase: 0.00175,
  evoGust: 0.00225,
  windPerHour: 0,
  evoPerHour: 0,
};
export type PresetId = "day" | "sunset" | "rain";
export interface EnvironmentPreset {
  id: PresetId;
  label: string;
  elevation: number;
  azimuth: number;
  cover: number;
  precipitation: number;
  wind: number;
  visibility: number;
  cirrus: number;
  cumulus: number;
  stratus: number;
  altocumulus: number;
  exposure: number;
  skyExposure: number;
  lightIntensity: number;
  ambient: number;
  cityLights: number;
  wetness: number;
  bortle: number;
}
export const PRESETS: Record<PresetId, EnvironmentPreset> = {
  day: {
    id: "day",
    label: "Sunny",
    elevation: 43,
    azimuth: 125,
    cover: 0.34,
    precipitation: 0,
    wind: 2,
    visibility: 55,
    cirrus: 0.16,
    cumulus: 0.48,
    stratus: 0,
    altocumulus: 0.16,
    exposure: 1.12,
    skyExposure: 0.05,
    lightIntensity: 5.0,
    ambient: 1.5,
    cityLights: 0,
    wetness: 0,
    bortle: 7,
  },
  sunset: {
    id: "sunset",
    label: "Sunset",
    elevation: 5.5,
    azimuth: 183,
    cover: 0.29,
    precipitation: 0,
    wind: 1.7,
    visibility: 55,
    cirrus: 0.18,
    cumulus: 0.04,
    stratus: 0,
    altocumulus: 0.88,
    exposure: 1.15,
    skyExposure: 0.1,
    lightIntensity: 3.9,
    ambient: 2.2,
    cityLights: 0.5,
    wetness: 0,
    bortle: 7,
  },
  rain: {
    id: "rain",
    label: "Light rain",
    elevation: 24,
    azimuth: 160,
    cover: 0.76,
    precipitation: 1.8,
    wind: 3,
    visibility: 9,
    cirrus: 0,
    cumulus: 0,
    stratus: 0.4,
    altocumulus: 0,
    exposure: 1.08,
    skyExposure: 0,
    lightIntensity: 1.6,
    ambient: 1.5,
    cityLights: 0.28,
    wetness: 0.6,
    bortle: 7,
  },
};
export function atmosphereState(p: EnvironmentPreset): AtmosphereState {
  const s = resolveConditions({
    time: 12,
    weather: {
      cloudCover: p.cover,
      precipitation: p.precipitation,
      windSpeed: p.wind,
      visibility: p.visibility,
      thunder: 0,
      clouds: {
        cirrus: p.cirrus,
        cumulus: p.cumulus,
        stratus: p.stratus,
        altocumulus: p.altocumulus,
        nimbostratus: p.precipitation > 0 ? 0.32 : 0,
        altostratus: p.precipitation > 0 ? 0.16 : 0,
      },
    },
    filter: "none",
    lens: { droplets: 0 },
    particles: { precipitation: 0 },
    celestial: { bortle: p.bortle, milkyWay: 0, meteors: 0 },
    tone: "neutral",
  });
  s.sunElevation = MathUtils.degToRad(p.elevation);
  s.sunAzimuth = MathUtils.degToRad(p.azimuth);
  // Explicit cover is an occlusion/weather control; cloud genera control shapes.
  s.cloudCover = p.cover;
  return s;
}
export function sunDirection(elevation: number, azimuth: number) {
  const e = MathUtils.degToRad(elevation),
    a = MathUtils.degToRad(azimuth);
  return new Vector3(
    Math.cos(e) * Math.sin(a),
    Math.sin(e),
    Math.cos(e) * Math.cos(a),
  );
}
export function validatePreset(input: unknown): EnvironmentPreset {
  if (!input || typeof input !== "object") throw Error("Invalid preset");
  const p = input as EnvironmentPreset;
  if (!["day", "sunset", "rain"].includes(p.id)) throw Error("Unknown preset");
  const base = PRESETS[p.id];
  for (const [key, value] of Object.entries(base))
    if (
      typeof value === "number" &&
      !Number.isFinite(p[key as keyof EnvironmentPreset])
    )
      throw Error("Invalid " + key);
  return { ...base, ...p };
}

/** A single visibility gate for sky disc/halo, city sunlight and water glints.
 * Input is the atmosphere's already-smoothed optical rain amount, not a preset
 * switch: the light-rain preset reaches ~0.213 and fully hides direct sun.
 */
export function directSunVisibility(rain: number) {
  return 1 - MathUtils.smoothstep(rain, 0.02, 0.18);
}
