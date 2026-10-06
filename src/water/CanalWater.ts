import { BufferGeometry, Color, Float32BufferAttribute, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector2, Vector3 } from 'three';
import { RouteController, ROUTE } from '../journey/RouteController';
import { PlanarReflection } from './PlanarReflection';
import { longWaveGLSL } from './WaveField';
export class CanalWater {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  constructor(route: RouteController, readonly reflection: PlanarReflection, sunDirection: Vector3) {
    const geometry = new BufferGeometry(), pos:number[]=[], flow:number[]=[], uv:number[]=[], index:number[]=[];
    const n=640, across=14, p=new Vector3(), t=new Vector3();
    for(let i=0;i<=n;i++) {
      const distance=i/n*route.length;route.pointAtDistance(distance,p);route.tangentAtDistance(distance,t);
      for(let j=0;j<=across;j++) {
        const cross=(j/across-.5)*ROUTE.width;
        pos.push(p.x-t.z*cross,0,p.z+t.x*cross);
        flow.push(t.x,t.z);uv.push(distance,cross);
        if(i<n && j<across){const a=i*(across+1)+j,b=a+across+1;index.push(a,a+1,b,a+1,b+1,b);}
      }
    }
    geometry.setAttribute('position',new Float32BufferAttribute(pos,3));
    geometry.setAttribute('flow',new Float32BufferAttribute(flow,2));
    geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();
    const material=new ShaderMaterial({
      name:'CanalWater',lights:true,fog:true,
      uniforms:UniformsUtils.merge([UniformsLib.lights,UniformsLib.fog,{
        uTime:{value:0},uMirror:{value:reflection.target.texture},uTextureMatrix:{value:reflection.matrix},
        uSun:{value:sunDirection},uDeep:{value:new Color('#234b43')},uShallow:{value:new Color('#42685a')},
        uHalfWidth:{value:ROUTE.width/2},uRouteLength:{value:route.length},
        uBoat:{value:new Vector3()},uBoatDirection:{value:new Vector2(0,-1)},
      }]),
      vertexShader:`
        attribute vec2 flow;
        uniform mat4 uTextureMatrix;
        varying vec3 vWorld;
        varying vec2 vFlow;
        varying vec2 vCanal;
        varying vec4 vReflect;
        #include <common>
        #include <fog_pars_vertex>
        #include <shadowmap_pars_vertex>
        void main(){
          vec4 worldPosition=modelMatrix*vec4(position,1.);
          vWorld=worldPosition.xyz;vFlow=flow;vCanal=uv;
          vReflect=uTextureMatrix*worldPosition;
          vec4 mvPosition=modelViewMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*mvPosition;
          #include <beginnormal_vertex>
          #include <defaultnormal_vertex>
          #include <shadowmap_vertex>
          #include <fog_vertex>
        }`,
      fragmentShader:`
        uniform float uTime,uHalfWidth,uRouteLength;
        uniform sampler2D uMirror;
        uniform vec3 uSun,uDeep,uShallow,uBoat;
        uniform vec2 uBoatDirection;
        varying vec3 vWorld;
        varying vec2 vFlow,vCanal;
        varying vec4 vReflect;
        #include <common>
        #include <packing>
        #include <bsdfs>
        #include <fog_pars_fragment>
        #include <lights_pars_begin>
        #include <shadowmap_pars_fragment>
        #include <shadowmask_pars_fragment>
        void wave(inout vec2 grad,vec2 dir,float frequency,float amplitude,float speed,float phase){
          // Integer periods around the loop keep the shader seamless at s=0.
          float k=6.2831853*floor(frequency*uRouteLength/6.2831853)/uRouteLength;
          vec2 kvec=vec2(k,dir.y*frequency);
          float angle=dot(vCanal,kvec)-uTime*speed+phase;
          float aa=1.-smoothstep(1.2,3.0,fwidth(angle));
          grad+=amplitude*kvec*cos(angle)*aa;
        }
        void main(){
          vec2 tangent=normalize(vFlow),cross=vec2(-tangent.y,tangent.x);
          vec2 localGrad=vec2(0.);
          wave(localGrad,vec2(1.,.43),4.8,.009,1.05,0.);
          wave(localGrad,vec2(1.,-1.2),8.1,.005,1.43,2.3);
          wave(localGrad,vec2(1.,.71),13.4,.0026,.92,4.7);
          wave(localGrad,vec2(1.,-1.7),21.7,.0011,1.65,1.4);
          vec2 p=vWorld.xz;
          vec2 grad=localGrad.x*tangent+localGrad.y*cross;
          ${longWaveGLSL}
          vec2 delta=p-uBoat.xz;
          float along=dot(delta,uBoatDirection),side=dot(delta,vec2(-uBoatDirection.y,uBoatDirection.x));
          // Subtle hull ripples. No foam or high-speed spray.
          float edge=abs(side)-.86;
          float ripple=cos(edge*24.-uTime*2.1)*exp(-abs(edge)*2.4)*.017;
          ripple*=1.-smoothstep(2.8,5.,abs(along));
          grad+=vec2(-uBoatDirection.y,uBoatDirection.x)*ripple*sign(side);
          vec3 normal=normalize(vec3(-grad.x,1.,-grad.y));
          vec3 view=normalize(cameraPosition-vWorld);
          vec2 reflectUv=vReflect.xy/vReflect.w;
          vec3 viewNormal=mat3(viewMatrix)*(normal-vec3(0.,1.,0.));
          float distanceToEye=distance(cameraPosition,vWorld);
          vec2 distortion=viewNormal.xy*(.010+.055/(1.+distanceToEye*.2));
          vec3 reflected=texture2D(uMirror,clamp(reflectUv+distortion,.002,.998)).rgb;
          float facing=clamp(dot(normal,view),0.,1.);
          float fresnel=.0204+.9796*pow(1.-facing,5.);
          float bank=smoothstep(uHalfWidth-1.8,uHalfWidth,abs(vCanal.y));
          vec3 body=mix(uDeep,uShallow,bank*.65);
          float shadow=getShadowMask();
          body*=mix(.30,1.,shadow);
          vec3 halfVector=normalize(uSun+view);
          float spec=pow(max(dot(normal,halfVector),0.),240.0)*shadow*.9;
          vec3 color=mix(body,reflected,fresnel)+vec3(1.,.92,.77)*spec;
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    // UniformsUtils clones matrices/textures: explicitly retain the live pair.
    material.uniforms.uMirror.value=reflection.target.texture;
    material.uniforms.uTextureMatrix.value=reflection.matrix;
    this.mesh=new Mesh(geometry,material);this.mesh.name='Canal surface';
    this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;
  }
  update(time:number,boat:Vector3,tangent:Vector3){
    this.mesh.material.uniforms.uTime.value=time;
    this.mesh.material.uniforms.uBoat.value.copy(boat);
    this.mesh.material.uniforms.uBoatDirection.value.set(tangent.x,tangent.z);
  }
}
