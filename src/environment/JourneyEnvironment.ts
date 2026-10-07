import { MathUtils, type Vector3 } from "three";
import { ManualEnvironment } from "./lab/ManualEnvironment";
import { PRESETS, type EnvironmentPreset, type PresetId } from "./lab/presets";

export type JourneyWeather = "journey" | PresetId;
export const JOURNEY_WEATHER: JourneyWeather[] = [
  "journey",
  "day",
  "sunset",
  "rain",
];

/** Same tested atmosphere as the lab, with the journey's continuous time curve. */
export function journeyPreset(progress: number): EnvironmentPreset {
  const t = MathUtils.smoothstep(progress, 0.43, 0.85);
  const p = { ...PRESETS.day };
  for (const key of Object.keys(p) as (keyof EnvironmentPreset)[]) {
    const a = PRESETS.day[key],
      b = PRESETS.sunset[key];
    if (typeof a === "number" && typeof b === "number")
      (p as unknown as Record<string, unknown>)[key] = MathUtils.lerp(a, b, t);
  }
  return p;
}
export class JourneyEnvironment extends ManualEnvironment {
  mode: JourneyWeather = "journey";
  get sun() {
    return this.base.sun;
  }
  get exposure() {
    return this.current.exposure;
  }
  get elevation() {
    return MathUtils.radToDeg(this.animator.current.sunElevation);
  }
  get azimuth() {
    return MathUtils.radToDeg(this.animator.current.sunAzimuth);
  }
  get state() {
    return { lights: this.current.cityLights };
  }
  select(mode: string) {
    if (JOURNEY_WEATHER.includes(mode as JourneyWeather))
      this.mode = mode as JourneyWeather;
  }
  initialize(progress: number) {
    this.apply(
      this.mode === "journey" ? journeyPreset(progress) : PRESETS[this.mode],
      true,
    );
  }
  advance(
    dt: number,
    time: number,
    position: Vector3,
    eye: Vector3,
    progress: number,
  ) {
    this.apply(
      this.mode === "journey" ? journeyPreset(progress) : PRESETS[this.mode],
    );
    super.update(dt, time, position, eye);
  }
}
