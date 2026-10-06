/** Actual disjoint timer queries. Never substitutes CPU time for GPU time. */
export class GpuTimer {
  private ext: any;
  private query: WebGLQuery | null = null;
  private pending: { q: WebGLQuery; label: string }[] = [];
  values: Record<string, number[]> = {};
  constructor(private gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  }
  get supported() {
    return !!this.ext;
  }
  begin(label: string) {
    if (!this.ext || this.pending.length > 24) return;
    this.query = this.gl.createQuery();
    if (this.query) {
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.query);
      this.pending.push({ q: this.query, label });
    }
  }
  end() {
    if (this.query) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.query = null;
    }
  }
  poll() {
    if (!this.ext) return;
    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    this.pending = this.pending.filter((p) => {
      if (!this.gl.getQueryParameter(p.q, this.gl.QUERY_RESULT_AVAILABLE))
        return true;
      if (!disjoint) {
        const ms = this.gl.getQueryParameter(p.q, this.gl.QUERY_RESULT) / 1e6;
        const a = (this.values[p.label] ??= []);
        a.push(ms);
        if (a.length > 180) a.shift();
      }
      this.gl.deleteQuery(p.q);
      return false;
    });
  }
  mean(label: string) {
    const a = this.values[label];
    return a?.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  }
  stats(label: string) {
    const a = [...(this.values[label] ?? [])].sort((x, y) => x - y);
    return {
      samples: a.length,
      meanMs: this.mean(label),
      p95Ms: a.length ? a[Math.floor((a.length - 1) * 0.95)] : null,
    };
  }
  dispose() {
    for (const p of this.pending) this.gl.deleteQuery(p.q);
    this.pending = [];
  }
}
