/** Slow, ordered degradation. A 30 Hz display cap alone must not trigger it. */
export class AdaptiveQuality {
  pixelScale = 1;
  reflectionScale = 1;
  shadowScale = 1;
  reducedDetails = false;
  private elapsed = 0;
  private pressured = 0;
  changes: string[] = [];
  constructor(readonly mobile: boolean) {}
  update(dt: number, frameMs: number, gpuMs: number | null) {
    this.elapsed += dt;
    const budget = this.mobile ? 30 : 18.5;
    const displayCapped =
      frameMs > 32 && frameMs < 34.7 && (gpuMs ?? 0) < budget;
    const pressure =
      (gpuMs !== null && gpuMs > budget) ||
      (!displayCapped && frameMs > (this.mobile ? 39 : 25));
    this.pressured += pressure ? dt : 0;
    if (this.elapsed < 5) return false;
    const sustained = this.pressured / this.elapsed > 0.8;
    this.elapsed = 0;
    this.pressured = 0;
    if (!sustained) return false;
    let change = "";
    if (this.pixelScale > 0.76) {
      this.pixelScale = Math.max(0.76, this.pixelScale - 0.06);
      change = "pixel ratio";
    } else if (this.reflectionScale > 0.5) {
      this.reflectionScale = 0.5;
      change = "reflection resolution";
    } else if (this.shadowScale > 0.5) {
      this.shadowScale = 0.5;
      change = "shadow resolution";
    } else if (!this.reducedDetails) {
      this.reducedDetails = true;
      change = "far detail";
    }
    if (change) this.changes.push(change);
    return !!change;
  }
}
