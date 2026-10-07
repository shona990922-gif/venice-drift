import { MathUtils } from "three";
/** Independent light-rain state; never clears a simulation on a transition. */
export class WeatherController {
  targetIntensity = 0;
  rainIntensity = 0;
  wetness = 0;
  setRain(intensity: number, immediate = false) {
    this.targetIntensity = MathUtils.clamp(intensity, 0, 0.45);
    if (immediate) {
      this.rainIntensity = this.targetIntensity;
      this.wetness = (this.rainIntensity / 0.45) * 0.7;
    }
  }
  update(dt: number) {
    this.rainIntensity = MathUtils.damp(
      this.rainIntensity,
      this.targetIntensity,
      1 / 3.2,
      dt,
    );
    this.wetness = MathUtils.damp(
      this.wetness,
      (this.rainIntensity / 0.45) * 0.7,
      this.targetIntensity > 0 ? 1 / 4 : 1 / 14,
      dt,
    );
  }
}
