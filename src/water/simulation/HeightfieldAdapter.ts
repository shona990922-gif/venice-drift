import {Color,FloatType,Mesh,NearestFilter,OrthographicCamera,PlaneGeometry,Scene,ShaderMaterial,Vector2,Vector3,WebGLRenderer,WebGLRenderTarget} from 'three';
import {RippleSimulation} from '../vendor/a/simulation/RippleSimulation';
import {Water} from '../vendor/b/Water';
const VERT=`varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}`;
/** Integration shell around the vendored solvers, not another wave solver.
 * Domain movement copies BOTH state channels in whole texels. No camera-relative
 * rotation and no resampling interpolation: old waves stay in world space.
 */
export class HeightfieldAdapter{
 readonly origin=new Vector2();readonly span=30;readonly output:WebGLRenderTarget;
 readonly a?:RippleSimulation;readonly b?:Water;readonly scene=new Scene();readonly camera=new OrthographicCamera(-1,1,1,-1,0,1);
 private quad:Mesh<PlaneGeometry,ShaderMaterial>;private scroll:ShaderMaterial;private normal:ShaderMaterial;private boundary:ShaderMaterial;private clock=0;private started=false;private pending:{point:Vector3;strength:number;radius:number}[]=[];
 steps=0;scrolls=0;emissions=0;waveSpeed=1.2;dampingRate=.70;lastStep=0;
 constructor(readonly renderer:WebGLRenderer,readonly kind:'a'|'b',readonly resolution=256,readonly hz=30){
  if(kind==='a'){this.a=new RippleSimulation({width:this.span,height:this.span,resolution,damping:.995,speed:.1});this.a.initialize();this.a.clear(renderer);}
  else this.b=new Water(renderer,resolution);
  this.output=new WebGLRenderTarget(resolution,resolution,{type:FloatType,minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:false,stencilBuffer:false});
  this.scroll=new ShaderMaterial({vertexShader:VERT,fragmentShader:`uniform sampler2D field;uniform vec2 shift;varying vec2 uv0;void main(){vec2 uv=uv0+shift;float valid=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);gl_FragColor=texture2D(field,uv)*valid;}`,uniforms:{field:{value:null},shift:{value:new Vector2()}},depthTest:false,depthWrite:false,toneMapped:false});
  this.boundary=new ShaderMaterial({vertexShader:VERT,fragmentShader:`uniform sampler2D field;varying vec2 uv0;void main(){vec4 v=texture2D(field,uv0);float edge=smoothstep(0.,.045,min(min(uv0.x,uv0.y),min(1.-uv0.x,1.-uv0.y)));v.rg*=edge;gl_FragColor=v;}`,uniforms:{field:{value:null}},depthTest:false,depthWrite:false,toneMapped:false});
  this.normal=new ShaderMaterial({vertexShader:VERT,fragmentShader:`uniform sampler2D field;uniform float cell,resolution,kind;varying vec2 uv0;void main(){vec4 v=texture2D(field,uv0);vec2 d=vec2(1./resolution,0.);vec2 g;if(kind<.5){g=vec2(texture2D(field,uv0+d).r-texture2D(field,uv0-d).r,texture2D(field,uv0+d.yx).r-texture2D(field,uv0-d.yx).r)/(2.*cell);}else{float y=sqrt(max(.001,1.-dot(v.ba,v.ba)));g=-v.ba/y;}float m=clamp(length(g)*14.,0.,1.);gl_FragColor=vec4(g,m,v.r);}`,uniforms:{field:{value:null},cell:{value:this.span/resolution},resolution:{value:resolution},kind:{value:kind==='a'?0:1}},depthTest:false,depthWrite:false,toneMapped:false});
  this.quad=new Mesh(new PlaneGeometry(2,2),this.scroll);this.quad.frustumCulled=false;this.scene.add(this.quad);this.clear();
 }
 get read(){return this.a?this.a.heightField.read!:this.b!.textureA}
 get write(){return this.a?this.a.heightField.write!:this.b!.textureB}
 swap(){this.a?this.a.heightField.swap():this.b!.swapTextures()}
 private pass(material:ShaderMaterial,target:WebGLRenderTarget){const prev=this.renderer.getRenderTarget();this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(prev)}
 centerOn(p:Vector3){const cell=this.span/this.resolution;const next=new Vector2(Math.floor((p.x-this.span/2)/cell)*cell,Math.floor((p.z-this.span/2)/cell)*cell);if(!this.started){this.origin.copy(next);this.started=true;return;}if(next.equals(this.origin))return;
  this.scroll.uniforms.field.value=this.read.texture;this.scroll.uniforms.shift.value.copy(next).sub(this.origin).divideScalar(this.span);this.pass(this.scroll,this.write);this.swap();this.origin.copy(next);this.scrolls++;
 }
 createRipple(p:Vector3,strength=.008,radius=.4){this.pending.push({point:p.clone(),strength,radius});this.emissions++;}
 private flush(){for(const {point,strength,radius} of this.pending){const local=point.clone();local.x-=this.origin.x+this.span/2;local.z-=this.origin.y+this.span/2;if(Math.abs(local.x)>this.span/2||Math.abs(local.z)>this.span/2)continue;
  if(this.a){local.z=-local.z;this.a.addDisturbance({position:local,strength,radius});}
  else this.b!.addDrop(local.x/(this.span/2),local.z/(this.span/2),radius/this.span,-strength,this.span/2,this.span/2);
 }this.pending.length=0;}
 update(dt:number,boat:Vector3){this.centerOn(boat);this.clock+=Math.min(.1,dt);const tick=1/this.hz;let count=0;while(this.clock>=tick&&count++<4){const steps=this.kind==='a'?3:2,subdt=tick/steps,cell=this.span/this.resolution,coefficient=Math.min(.45,(this.waveSpeed*subdt/cell)**2),damping=Math.exp(-this.dampingRate*subdt);const prev=this.renderer.getRenderTarget();
   this.flush();
   if(this.a){this.a.configure(4*coefficient,damping);this.a.step(this.renderer,tick,steps);}else{this.b!.configure(coefficient,damping);for(let i=0;i<steps;i++)this.b!.stepSimulation(this.span/2,this.span/2);this.boundary.uniforms.field.value=this.read.texture;this.pass(this.boundary,this.write);this.swap();this.b!.updateNormals(this.span/2,this.span/2);}this.renderer.setRenderTarget(prev);this.clock-=tick;this.steps++;
  }
  this.normal.uniforms.field.value=this.read.texture;this.pass(this.normal,this.output);
 }
 clear(){this.pending.length=0;this.a?.clear(this.renderer);this.b?.clearTextures();const prev=this.renderer.getRenderTarget(),color=new Color();this.renderer.getClearColor(color);const alpha=this.renderer.getClearAlpha();this.renderer.setClearColor(0,0);this.renderer.setRenderTarget(this.output);this.renderer.clear();this.renderer.setRenderTarget(prev);this.renderer.setClearColor(color,alpha);this.clock=0;this.started=false;}
 sample(){const values=new Float32Array(this.resolution**2*4);this.renderer.readRenderTargetPixels(this.read,0,0,this.resolution,this.resolution,values);return values}
 dispose(){this.a?.dispose();this.b?.dispose();this.output.dispose();this.scroll.dispose();this.boundary.dispose();this.normal.dispose();this.quad.geometry.dispose()}
}
