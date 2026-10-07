import {
  BackSide,
  DataTexture,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
export const REFERENCES = {
  venice_sunrise: {
    label: "Venice Sunrise",
    role: "Golden Hour · 金色侧光 / 冷蓝天空",
    exposure: 1,
  },
  venice_sunset: {
    label: "Venice Sunset",
    role: "Sunset · 金色地平线 / 克制晚霞",
    exposure: 1,
  },
  twilight_sunset: {
    label: "Twilight Sunset",
    role: "暮色 · 冷紫上空 / 暖地平线",
    exposure: 1,
  },
};
export type ReferenceId = keyof typeof REFERENCES;
export class ReferenceSky {
  readonly scene = new Scene();
  readonly material = new ShaderMaterial({
    uniforms: { uHDR: { value: null }, uYaw: { value: 0 } },
    vertexShader:
      "varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}",
    fragmentShader:
      "uniform sampler2D uHDR;uniform float uYaw;varying vec3 dir;void main(){vec3 d=normalize(dir);vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5+uYaw,asin(clamp(d.y,-1.,1.))/3.14159265+.5);gl_FragColor=vec4(texture2D(uHDR,vec2(fract(uv.x),uv.y)).rgb,1.);}",
    side: BackSide,
    depthWrite: false,
    toneMapped: false,
  });
  readonly mesh = new Mesh(new SphereGeometry(1000, 24, 16), this.material);
  readonly cache = new Map<ReferenceId, DataTexture>();
  private request = 0;
  constructor() {
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  async load(id: ReferenceId) {
    const ticket = ++this.request;
    let texture = this.cache.get(id);
    if (!texture) {
      texture = await new RGBELoader().loadAsync(
        "../assets/atmosphere-references/" + id + "_1k.hdr",
      );
      this.cache.set(id, texture);
    }
    if (ticket === this.request) this.material.uniforms.uHDR.value = texture;
    return ticket === this.request;
  }
  dispose() {
    for (const t of this.cache.values()) t.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
