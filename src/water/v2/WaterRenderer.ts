import {
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  UnsignedIntType,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { Post } from "./vendor/waterthreejs/Post.js";
import { WATER_QUALITY, type WaterQuality } from "./Presets";
import type { WaterThreeCanal } from "./WaterThreeCanal";
import type { PlanarReflection } from "../PlanarReflection";
const target = (depthTexture = false) => {
  const t = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
  });
  if (depthTexture) t.depthTexture = new DepthTexture(1, 1, UnsignedIntType);
  return t;
};
export class WaterRenderer {
  readonly capture = target(true);
  readonly hdr = target();
  readonly post: Post;
  exposure = 1.05;
  fadeAmount = 0;
  constructor(
    readonly renderer: WebGLRenderer,
    readonly scene: Scene,
    readonly water: WaterThreeCanal,
    readonly planar: PlanarReflection,
    readonly quality: WaterQuality,
  ) {
    renderer.toneMapping = NoToneMapping;
    this.hdr.samples = quality === "low" ? 0 : 2;
    this.post = new Post(
      renderer,
      1,
      1,
      water.uniforms.uSunDir.value,
      water.uniforms.uDeepColor.value,
    );
    this.post.compositeMat.uniforms.uJourneyFade = { value: 0 };
    this.post.compositeMat.fragmentShader =
      "uniform float uJourneyFade;\n" + this.post.compositeMat.fragmentShader;
    this.post.compositeMat.fragmentShader =
      this.post.compositeMat.fragmentShader.replace(
        "gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);",
        "gl_FragColor=vec4(mix(toSRGB(clamp(c,0.,1.)),vec3(.082353,.156863,.192157),uJourneyFade),1.);",
      );
    this.post.compositeMat.fragmentShader =
      this.post.compositeMat.fragmentShader
        .replace(
          "c += texture2D(tBloom, vUv).rgb * uBloom;",
          "if(uBloom>0.) c += texture2D(tBloom,vUv).rgb*uBloom;",
        )
        .replace(
          "c *= uExposure;",
          "c=vec3(c.r>=0.?min(c.r,64.):0.,c.g>=0.?min(c.g,64.):0.,c.b>=0.?min(c.b,64.):0.);c *= uExposure;",
        );
    water.uniforms.uRefractionTex.value = this.capture.texture;
    water.uniforms.uDepthTex.value = this.capture.depthTexture;
  }
  resize(w: number, h: number) {
    const s = WATER_QUALITY[this.quality].captureScale;
    this.capture.setSize(Math.round(w * s), Math.round(h * s));
    this.hdr.setSize(w, h);
    this.water.ocean.setResolution(w, h);
  }
  render(camera: PerspectiveCamera, time: number) {
    const r = this.renderer,
      u = this.water.uniforms;
    camera.updateWorldMatrix(true, false);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uProjMatrix.value.copy(camera.projectionMatrix);
    this.planar.render(this.scene, camera);
    this.water.mesh.visible = false;
    const mask = camera.layers.mask,
      shadow = r.shadowMap.autoUpdate;
    try {
      camera.layers.set(2);
      r.shadowMap.autoUpdate = false;
      r.setRenderTarget(this.capture);
      r.render(this.scene, camera);
    } finally {
      r.shadowMap.autoUpdate = shadow;
      camera.layers.mask = mask;
      this.water.mesh.visible = true;
      r.setRenderTarget(null);
    }
    r.setRenderTarget(this.hdr);
    r.render(this.scene, camera);
    const p = this.post.compositeMat.uniforms;
    p.uJourneyFade.value = this.fadeAmount;
    p.tScene.value = this.hdr.texture;
    p.tBloom.value = this.hdr.texture;
    p.uTime.value = time;
    p.uUnderwater.value = 0;
    p.uExposure.value = this.exposure;
    p.uBloom.value = 0;
    p.uSaturation.value = 1;
    p.uContrast.value = 1;
    p.uGrain.value = 0;
    p.uCA.value = 0;
    p.uVignetteAir.value = 0;
    this.post._draw(this.post.compositeMat, null);
  }
  dispose() {
    this.capture.dispose();
    this.hdr.dispose();
    for (const t of [
      this.post.sceneRT,
      this.post.sceneRT2,
      this.post.brightRT,
      this.post.blurA,
      this.post.blurB,
    ])
      t.dispose();
    for (const m of [
      this.post.underwaterMat,
      this.post.brightMat,
      this.post.blurMat,
      this.post.compositeMat,
      this.post.cloudCompositeMat,
    ])
      m.dispose();
    this.post.quad.dispose();
  }
}
