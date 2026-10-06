/** User-visible QA run driven by the same real-time animation loop as the ride. */
export class JourneyAudit {
  active = false;
  private started = 0;
  private initialLoop = 0;
  private bucket = -1;
  private samples: unknown[] = [];
  private frames: number[] = [];
  private captures = new Set<number>();
  private initial: unknown;
  private hidden = 0;
  constructor(
    private snapshot: () => Record<string, unknown>,
    private save: (blob: Blob, name: string) => void,
    private shot: () => void,
    private status: (text: string) => void,
  ) {}
  start(loop: number) {
    this.active = true;
    this.started = performance.now();
    this.initialLoop = loop;
    this.bucket = -1;
    this.samples = [];
    this.frames = [];
    this.captures.clear();
    this.hidden = 0;
    this.initial = this.snapshot();
    this.status("完整两趟验收进行中：实际速度航行，约 11 分钟。");
  }
  visibility() {
    if (this.active) this.hidden++;
  }
  frame(dt: number, distance: number, loop: number) {
    if (!this.active) return;
    this.frames.push(dt * 1000);
    const lap = loop - this.initialLoop,
      key = lap * 100 + Math.floor(distance / 10);
    if (key !== this.bucket) {
      this.bucket = key;
      this.samples.push({ lap, ...this.snapshot() });
      this.status(
        `完整验收：第 ${Math.min(2, lap + 1)} 趟 · ${distance.toFixed(0)} m`,
      );
    }
    if (lap === 0)
      for (const d of [8, 44, 152, 252, 323, 381, 408, 434, 483])
        if (distance >= d && !this.captures.has(d)) {
          this.captures.add(d);
          this.shot();
        }
    if (lap >= 2 && distance >= 12) {
      this.active = false;
      const sorted = [...this.frames].sort((a, b) => a - b),
        mean = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
      const report = {
        test: "Two complete real-time journeys, unaccelerated; desktop browser",
        wallSeconds: (performance.now() - this.started) / 1000,
        visibilityInterruptions: this.hidden,
        frames: this.frames.length,
        meanFrameMs: mean,
        fps: 1000 / mean,
        p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
        p99FrameMs: sorted[Math.floor(sorted.length * 0.99)],
        framesOver50ms: this.frames.filter((t) => t > 50).length,
        initial: this.initial,
        samples: this.samples,
        final: this.snapshot(),
      };
      this.save(
        new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        }),
        "full-journey-audit-" + Date.now() + ".json",
      );
      this.status("两趟实际航行验收已完成并保存。");
    }
  }
}
