import { Color, DirectionalLight, Fog, HemisphereLight, PMREMGenerator, Scene, Vector3, WebGLRenderer } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
export class SkySystem {
  readonly sky = new Sky();
  readonly sun = new DirectionalLight('#fff2de',2.6);
  readonly direction = new Vector3(-0.48,0.72,-0.44).normalize();
  readonly environment;
  constructor(scene:Scene,renderer:WebGLRenderer) {
    this.sky.scale.setScalar(380);
    const u=this.sky.material.uniforms;
    u.turbidity.value=2.3;u.rayleigh.value=1.25;
    u.mieCoefficient.value=.004;u.mieDirectionalG.value=.78;
    u.sunPosition.value.copy(this.direction);
    if(u.cloudCoverage){u.cloudCoverage.value=.23;u.cloudDensity.value=.32;u.cloudElevation.value=.48;}
    this.sky.layers.enable(1);scene.add(this.sky);
    const envScene=new Scene();envScene.add(this.sky.clone());
    const envSky=envScene.children[0] as Sky;
    // PMREM excludes the solar disc; directional light owns the sun energy.
    const hadDisc=u.showSunDisc?.value;
    if(u.showSunDisc)u.showSunDisc.value=0;
    const generator=new PMREMGenerator(renderer);
    this.environment=generator.fromScene(envScene,.025,.1,450);
    if(u.showSunDisc)u.showSunDisc.value=hadDisc;
    scene.environment=this.environment.texture;scene.environmentIntensity=.09;
    envSky.removeFromParent();generator.dispose();
    scene.background=new Color('#cbdce0');scene.fog=new Fog('#cbdce0',110,285);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:180});
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.035;
    this.sun.layers.enable(1);this.sun.target.layers.enable(1);scene.add(this.sun,this.sun.target);
    const hemi=new HemisphereLight('#dae6ec','#748070',.35);hemi.layers.enable(1);scene.add(hemi);
  }
  update(position:Vector3,time:number) {
    this.sun.position.copy(position).addScaledVector(this.direction,95);
    this.sun.target.position.copy(position);this.sun.target.updateMatrixWorld();
    this.sky.position.set(position.x,0,position.z);
    if(this.sky.material.uniforms.time)this.sky.material.uniforms.time.value=time;
  }
}
