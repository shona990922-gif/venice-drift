import {DirectionalLight,Fog,MathUtils,PMREMGenerator,Scene,Vector3,WebGLRenderer} from 'three';
import {Sky} from '../water/v2/vendor/waterthreejs/Sky.js';
import type {WaterThreeCanal} from '../water/v2/WaterThreeCanal';
export class EnvironmentController {
 readonly sun=new DirectionalLight('#fff1d9',4.6);readonly sky:Sky;readonly direction=new Vector3();private target:any=null;
 elevation=58;azimuth=148;exposure=1.05;
 constructor(readonly scene:Scene,readonly renderer:WebGLRenderer,readonly water:WaterThreeCanal){
  this.sky=new Sky(new Vector3(0,1,0));this.sky.mesh.material.vertexShader=this.sky.mesh.material.vertexShader.replace('gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);','gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);gl_Position.z=gl_Position.w;');
  this.sky.mesh.layers.enable(1);this.sky.mesh.layers.enable(2);scene.add(this.sky.mesh,this.sun,this.sun.target);this.sun.layers.enable(1);this.sun.layers.enable(2);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:165});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.035;
  scene.fog=new Fog('#aabecb',90,260);this.setSun(58,148);
 }
 setSun(el:number,az:number){this.elevation=el;this.azimuth=az;const e=MathUtils.degToRad(el),a=MathUtils.degToRad(az),h=Math.cos(e);this.direction.set(Math.cos(a)*h,Math.sin(e),Math.sin(a)*h);this.sky.setSun(this.direction);this.water.ocean.setSun(this.direction);this.sky.uniforms.uCloudCover.value=.55;this.water.uniforms.uCloudCover.value=.55;
  const sc=new Scene();const mesh=this.sky.mesh.clone();mesh.position.set(0,0,0);sc.add(mesh);const pmrem=new PMREMGenerator(this.renderer);this.target?.dispose();this.target=pmrem.fromScene(sc,.03,.1,8000);pmrem.dispose();this.scene.environment=this.target.texture;this.scene.environmentIntensity=1.1;this.water.planar.invalidate();
 }
 update(position:Vector3,eye:Vector3,time:number,_progress:number){this.sun.position.copy(position).addScaledVector(this.direction,95);this.sun.target.position.copy(position);this.sun.target.updateMatrixWorld();this.sky.mesh.position.copy(eye);this.sky.uniforms.uTime.value=time;}
 dispose(){this.target?.dispose();this.sky.mesh.geometry.dispose();this.sky.mesh.material.dispose();this.sun.shadow.map?.dispose();}
}
