import { HalfFloatType, Matrix4, PerspectiveCamera, Plane, Quaternion, Scene, UnsignedByteType, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
// Mirror/oblique math adapted from m2-md, MIT © 2026 Mustafa Morbel.
// Full notice: public/licenses/planar-reference-MIT.txt.
export function applyObliqueNearPlane(e: number[], p: readonly number[], bias = 0.002) {
  const qx = (Math.sign(p[0]) + e[8]) / e[0];
  const qy = (Math.sign(p[1]) + e[9]) / e[5];
  const qw = (1 + e[10]) / e[14];
  const scale = 2 / (p[0] * qx + p[1] * qy - p[2] + p[3] * qw);
  e[2] = p[0] * scale; e[6] = p[1] * scale;
  e[10] = p[2] * scale + 1 - bias; e[14] = p[3] * scale;
}
const BIAS = new Matrix4().set(.5,0,0,.5, 0,.5,0,.5, 0,0,.5,.5, 0,0,0,1);
export class PlanarReflection {
  readonly camera = new PerspectiveCamera();
  readonly matrix = new Matrix4();
  readonly target: WebGLRenderTarget;
  interval = 1;
  updates = 0;
  private frame = 0;
  private force = true;
  private p = new Vector3(); private d = new Vector3(); private t = new Vector3();
  private up = new Vector3(); private q = new Quaternion(); private plane = new Plane();
  constructor(private renderer: WebGLRenderer, resolution = 1024) {
    this.target = new WebGLRenderTarget(resolution, resolution, {
      type: renderer.extensions.has('EXT_color_buffer_float') ? HalfFloatType : UnsignedByteType,
      depthBuffer: true, stencilBuffer: false, generateMipmaps: false,
    });
    this.target.texture.name = 'Canal planar reflection';
    this.camera.layers.set(1);
  }
  sync(source: PerspectiveCamera, planeY = 0) {
    source.updateWorldMatrix(true, false);
    source.getWorldPosition(this.p); source.getWorldDirection(this.d);
    this.t.copy(this.p).add(this.d);
    this.up.set(0,1,0).applyQuaternion(source.getWorldQuaternion(this.q));
    this.camera.position.set(this.p.x, 2*planeY-this.p.y, this.p.z);
    this.camera.up.set(this.up.x,-this.up.y,this.up.z);
    this.camera.lookAt(this.t.x,2*planeY-this.t.y,this.t.z);
    this.camera.near = source.near; this.camera.far = source.far;
    this.camera.fov = source.fov; this.camera.aspect = source.aspect;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
    this.plane.set(new Vector3(0,1,0),-planeY).applyMatrix4(this.camera.matrixWorldInverse);
    const n = this.plane.normal;
    applyObliqueNearPlane(this.camera.projectionMatrix.elements,[n.x,n.y,n.z,this.plane.constant]);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.matrix.copy(BIAS).multiply(this.camera.projectionMatrix).multiply(this.camera.matrixWorldInverse);
  }
  render(scene: Scene, source: PerspectiveCamera) {
    if (!this.force && this.frame++ % this.interval !== 0) return;
    this.force = false;
    this.sync(source);
    const previous = this.renderer.getRenderTarget();
    const shadows = this.renderer.shadowMap.autoUpdate;
    const xr = this.renderer.xr.enabled;
    this.renderer.xr.enabled = false;
    this.renderer.shadowMap.autoUpdate = false;
    try {
      this.renderer.setRenderTarget(this.target);
      this.renderer.clear();
      this.renderer.render(scene,this.camera);
      this.updates++;
    } finally {
      this.renderer.setRenderTarget(previous);
      this.renderer.shadowMap.autoUpdate = shadows;
      this.renderer.xr.enabled = xr;
    }
  }
  configure(resolution: number, interval: number) {
    if (this.target.width !== resolution) this.target.setSize(resolution,resolution);
    this.interval = interval; this.invalidate();
  }
  invalidate() { this.force = true; }
  dispose() { this.target.dispose(); }
}
