/** Triple-buffered cubemap publication. A partially rendered cube is never
 * sampled, and the previous cube is not recycled until its fade is complete. */
export class SkyFrameBlend {
  previous = 0;
  current = 0;
  writing = 1;
  face = 0;
  blend = 1;
  duration = 0.16;
  private start = 0;
  private last = 0;
  private meanStep = 1 / 60;

  reset(time: number) {
    this.previous = this.current = 0;
    this.writing = 1;
    this.face = 0;
    this.blend = 1;
    this.start = this.last = time;
  }
  tick(time: number) {
    const dt = Math.max(0, Math.min(0.1, time - this.last));
    if (dt > 0) this.meanStep += (dt - this.meanStep) * 0.18;
    this.last = time;
    this.blend =
      this.previous === this.current
        ? 1
        : Math.min(1, Math.max(0, (time - this.start) / this.duration));
    // Publish only at the endpoint of the old fade: both sides of the swap
    // evaluate the same completed cube, so there is no boundary jump.
    if (this.face === 6 && this.blend === 1) {
      this.previous = this.current;
      this.current = this.writing;
      this.writing = [0, 1, 2].find(
        (i) => i !== this.current && i !== this.previous,
      )!;
      this.face = 0;
      this.blend = 0;
      this.start = time;
      // Eight frame intervals leave two frames of headroom for six faces.
      this.duration = Math.max(0.16, this.meanStep * 8);
      return true;
    }
    return false;
  }
  get pendingFace() {
    return this.face < 6 ? this.face : null;
  }
  completeFace() {
    this.face++;
  }
}
