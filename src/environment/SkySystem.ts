import { Color, DirectionalLight, EquirectangularReflectionMapping, Fog, PMREMGenerator, Scene, Vector3, WebGLRenderer } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
/** One photographic clear-afternoon atmosphere. No weather/time-of-day system. */
export class SkySystem {
 readonly sun=new DirectionalLight('#fff1d9',4.6);
 readonly direction=new Vector3(-.72,1.65,.45).normalize();
 readonly environment={dispose:()=>{}};
 readonly ready:Promise<void>;
 constructor(scene:Scene,renderer:WebGLRenderer){
  scene.background=new Color('#a9cbdc');scene.fog=new Fog('#c1d5db',110,240);
  this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
  Object.assign(this.sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:165});
  this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.035;
  this.sun.layers.enable(1);this.sun.target.layers.enable(1);scene.add(this.sun,this.sun.target);
  this.ready=new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}assets/textures/afternoon-sky.hdr`).then(texture=>{
   texture.mapping=EquirectangularReflectionMapping;
   scene.background=texture;scene.backgroundIntensity=1.0;scene.backgroundRotation.y=1.8;
   const pmrem=new PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(texture);pmrem.dispose();
   scene.environment=environment.texture;scene.environmentIntensity=1.48;scene.environmentRotation.y=1.8;
   this.environment.dispose=()=>{environment.dispose();texture.dispose();};
  });
 }
 update(position:Vector3,_time:number){this.sun.position.copy(position).addScaledVector(this.direction,95);this.sun.target.position.copy(position);this.sun.target.updateMatrixWorld();}
}
