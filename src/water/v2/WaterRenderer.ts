import {DepthTexture,HalfFloatType,LinearFilter,NoToneMapping,PerspectiveCamera,Scene,UnsignedIntType,WebGLRenderer,WebGLRenderTarget} from 'three';
import {Post} from './vendor/waterthreejs/Post.js';
import {WATER_QUALITY,type WaterQuality} from './Presets';
import type {WaterThreeCanal} from './WaterThreeCanal';
import type {PlanarReflection} from '../PlanarReflection';
const target=()=>{const t=new WebGLRenderTarget(1,1,{type:HalfFloatType,minFilter:LinearFilter,magFilter:LinearFilter,depthBuffer:true});t.depthTexture=new DepthTexture(1,1,UnsignedIntType);return t;};
export class WaterRenderer {
 readonly capture=target();readonly hdr=target();readonly post:Post;exposure=1.05;
 constructor(readonly renderer:WebGLRenderer,readonly scene:Scene,readonly water:WaterThreeCanal,readonly planar:PlanarReflection,readonly quality:WaterQuality){renderer.toneMapping=NoToneMapping;this.post=new Post(renderer,1,1,water.uniforms.uSunDir.value,water.uniforms.uDeepColor.value);water.uniforms.uRefractionTex.value=this.capture.texture;water.uniforms.uDepthTex.value=this.capture.depthTexture;}
 resize(w:number,h:number){const s=WATER_QUALITY[this.quality].captureScale;this.capture.setSize(Math.round(w*s),Math.round(h*s));this.hdr.setSize(w,h);this.water.ocean.setResolution(w,h);}
 render(camera:PerspectiveCamera,time:number){const r=this.renderer,u=this.water.uniforms;camera.updateWorldMatrix(true,false);u.uNear.value=camera.near;u.uFar.value=camera.far;u.uProjMatrix.value.copy(camera.projectionMatrix);
  this.planar.render(this.scene,camera);this.water.mesh.visible=false;const mask=camera.layers.mask,shadow=r.shadowMap.autoUpdate;camera.layers.set(2);r.shadowMap.autoUpdate=false;r.setRenderTarget(this.capture);r.render(this.scene,camera);r.shadowMap.autoUpdate=shadow;camera.layers.mask=mask;this.water.mesh.visible=true;
  r.setRenderTarget(this.hdr);r.render(this.scene,camera);const p=this.post.compositeMat.uniforms;p.tScene.value=this.hdr.texture;p.tBloom.value=this.hdr.texture;p.uTime.value=time;p.uUnderwater.value=0;p.uExposure.value=this.exposure;p.uBloom.value=0;p.uSaturation.value=1;p.uContrast.value=1;p.uGrain.value=0;p.uCA.value=0;p.uVignetteAir.value=0;this.post._draw(this.post.compositeMat,null);
 }
 dispose(){this.capture.dispose();this.hdr.dispose();for(const t of [this.post.sceneRT,this.post.sceneRT2,this.post.brightRT,this.post.blurA,this.post.blurB])t.dispose();for(const m of [this.post.underwaterMat,this.post.brightMat,this.post.blurMat,this.post.compositeMat,this.post.cloudCompositeMat])m.dispose();this.post.quad.dispose();}
}
