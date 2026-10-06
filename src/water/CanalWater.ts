import { BufferGeometry, Color, Float32BufferAttribute, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector2, Vector3 } from 'three';
import { RouteController, ROUTE } from '../journey/RouteController';
import { PlanarReflection } from './PlanarReflection';
import { longWaveGLSL } from './WaveField';
import { BoatWaterInteraction, WAKE_SETTINGS } from './BoatWaterInteraction';
export class CanalWater {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  readonly interaction=new BoatWaterInteraction();
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
        uWakeMask:{value:this.interaction.texture},uWakeOrigin:{value:this.interaction.origin},uWakeSpan:{value:WAKE_SETTINGS.span},uWakeSlope:{value:WAKE_SETTINGS.maxSlope},uBoatSpeed:{value:0},uInteractionStrength:{value:1},
        uTime:{value:0},uMirror:{value:reflection.target.texture},uTextureMatrix:{value:reflection.matrix},
        uSun:{value:sunDirection},uDeep:{value:new Color('#173f39')},uShallow:{value:new Color('#3c5747')},
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
        uniform float uTime,uHalfWidth,uRouteLength,uBoatSpeed,uInteractionStrength,uWakeSpan,uWakeSlope;
        uniform sampler2D uWakeMask;
        uniform vec2 uWakeOrigin;
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
        // Differentiable value noise, following the official Sky noise construction.
        // Unlike sine trains, its gradient has no repeating parallel wave crests.
        float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        vec3 noiseD(vec2 p){
          vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
          float a=waterHash(i),b=waterHash(i+vec2(1,0)),c=waterHash(i+vec2(0,1)),d=waterHash(i+1.);
          float k=a-b-c+d;
          return vec3(a+(b-a)*u.x+(c-a)*u.y+k*u.x*u.y,du*vec2(b-a+k*u.y,c-a+k*u.x));
        }
        void main(){
          vec2 tangent=normalize(vFlow),cross=vec2(-tangent.y,tangent.x);
          vec2 advect=vec2(vCanal.x-uTime*.055,vCanal.y);
          vec3 warp=noiseD(advect*.21+vec2(0.,uTime*.009));
          vec3 large=noiseD(advect*vec2(.71,.83)+warp.x*.42);
          mat2 rotation=mat2(.8,-.6,.6,.8);
          vec2 microUV=rotation*advect*3.8+vec2(uTime*.032,-uTime*.023)+warp.yz*.19;
          vec3 micro=noiseD(microUV);
          float aa=1.-smoothstep(.4,1.8,length(fwidth(microUV)));
          vec2 localGrad=large.yz*.066+transpose(rotation)*micro.yz*.044*aa;
          vec2 p=vWorld.xz;
          vec2 grad=localGrad.x*tangent+localGrad.y*cross;
          ${longWaveGLSL}
          vec2 delta=p-uBoat.xz;
          float along=dot(delta,uBoatDirection),side=dot(delta,vec2(-uBoatDirection.y,uBoatDirection.x));
          // Subtle hull ripples. No foam or high-speed spray.
          float edge=abs(side)-.86;
          float ripple=cos(edge*24.-uTime*2.1)*exp(-abs(edge)*2.4)*.008;
          ripple*=1.-smoothstep(2.8,5.,abs(along));
          grad+=vec2(-uBoatDirection.y,uBoatDirection.x)*ripple*sign(side);
          // Boat-water interaction is an additive local field. The original
          // canal normals, water colour and mirror camera are unchanged.
          vec2 boatSide=vec2(-uBoatDirection.y,uBoatDirection.x);
          float speedGain=clamp(uBoatSpeed/1.55,0.,1.12);
          vec2 interactionGrad=vec2(0.);
          float localMask=0.;
          // A small pressure wave just ahead of the stem, plus two soft arcs
          // travelling outward. Nothing is painted white or made transparent.
          vec2 bow=vec2(along-4.95,side);
          float pressure=exp(-dot(bow/vec2(.62,.5),bow/vec2(.62,.5)));
          vec2 bowGrad=-.023*2.*bow/vec2(.3844,.25)*pressure;
          float bowMask=pressure*.45;
          vec2 ellipse=bow*vec2(.80,1.0);float radius=length(ellipse);
          vec2 radial=radius>.001?ellipse/radius*vec2(.80,1.):vec2(0.);
          for(int i=0;i<2;i++){
            float age=fract(uTime*.38+float(i)*.5);
            float ringRadius=.20+age*1.18;
            float gap=radius-ringRadius;
            float envelope=exp(-pow(gap/.14,2.))*smoothstep(0.,.13,age)*(1.-smoothstep(.38,1.,age));
            envelope*=smoothstep(-.75,-.10,bow.x);
            bowGrad+=radial*(-2.*gap/.0196)*.007*envelope;
            bowMask+=envelope*.5;
          }
          interactionGrad+=(uBoatDirection*bowGrad.x+boatSide*bowGrad.y)*speedGain;
          localMask+=bowMask*speedGain;
          // A narrow band follows the tapered hull, just outside its raised rail.
          float hullT=clamp((along+4.85)/10.,0.,1.);
          float hullWidth=.018+.83*pow(max(0.,sin(hullT*3.14159265)),.62);
          float edgeGap=abs(side)-hullWidth-.20;
          float sideMask=exp(-pow(edgeGap/.20,2.))*(1.-smoothstep(3.65,5.,abs(along)));
          vec3 dragged=noiseD(vec2(along*3.1-uTime*.42,side*5.7+uTime*.14));
          float sideSlope=(sin(edgeGap*31.-uTime*2.1-along*.64)*.067+dragged.z*.028)*sideMask*sign(side);
          interactionGrad+=(boatSide*sideSlope+uBoatDirection*dragged.y*.015*sideMask)*speedGain;
          localMask+=sideMask*.58*speedGain;
          // Stern trail: a persistent world-space mask, not a V rigidly glued
          // to BoatRoot. Its two arms age and spread after the boat has passed.
          vec2 wakeUV=(p-uWakeOrigin)/uWakeSpan;
          float inMask=step(0.,wakeUV.x)*step(0.,wakeUV.y)*step(wakeUV.x,1.)*step(wakeUV.y,1.);
          vec3 wake=texture2D(uWakeMask,clamp(wakeUV,0.,1.)).rgb;
          interactionGrad+=(wake.rg*255.-128.)/127.*uWakeSlope*inMask;
          localMask+=wake.b*inMask;
          interactionGrad*=uInteractionStrength;
          float interaction=clamp(localMask*uInteractionStrength,0.,1.);
          grad+=interactionGrad;
          vec3 normal=normalize(vec3(-grad.x,1.,-grad.y));
          vec3 view=normalize(cameraPosition-vWorld);
          vec2 reflectUv=vReflect.xy/vReflect.w;
          vec3 viewNormal=mat3(viewMatrix)*(normal-vec3(0.,1.,0.));
          float distanceToEye=distance(cameraPosition,vWorld);
          vec2 distortion=viewNormal.xy*(.013+.065/(1.+distanceToEye*.2));
          // Explicitly drive mirror UVs as well as lighting normals. This makes
          // a nearby façade reflection shear briefly as the hull passes.
          vec3 localKick=mat3(viewMatrix)*vec3(-interactionGrad.x,0.,-interactionGrad.y);
          distortion+=localKick.xy*(.025+.045/(1.+distanceToEye*.13));
          vec2 reflectedUV=clamp(reflectUv+distortion,.002,.998);
          vec3 reflected=texture2D(uMirror,reflectedUV).rgb;
          if(interaction>.012){
            vec2 soften=vec2(.0008,.00045)*interaction;
            vec3 softPair=(texture2D(uMirror,clamp(reflectedUV+soften,.002,.998)).rgb+texture2D(uMirror,clamp(reflectedUV-soften,.002,.998)).rgb)*.5;
            reflected=mix(reflected,softPair,interaction*.32);
          }
          float facing=clamp(dot(normal,view),0.,1.);
          float fresnel=.0204+.9796*pow(1.-facing,5.);
          // Sub-pixel local facets retain a restrained reflected sheen at steep
          // viewing angles. This is reflected scene colour, never white foam.
          fresnel=min(.97,fresnel+interaction*.055*(1.-facing*.55));
          float bank=smoothstep(uHalfWidth-1.8,uHalfWidth,abs(vCanal.y));
          vec3 body=mix(uDeep,uShallow,bank*.65);
          float shadow=getShadowMask();
          body*=mix(.22,1.,shadow);
          vec3 halfVector=normalize(uSun+view);
          float spec=pow(max(dot(normal,halfVector),0.),mix(240.,155.,interaction*.5))*shadow*.9;
          vec3 color=mix(body,reflected,fresnel)+vec3(1.,.92,.77)*spec;
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    // UniformsUtils clones matrices/textures: explicitly retain the live pair.
    material.uniforms.uWakeMask.value=this.interaction.texture;
    material.uniforms.uWakeOrigin.value=this.interaction.origin;
    material.uniforms.uMirror.value=reflection.target.texture;
    material.uniforms.uTextureMatrix.value=reflection.matrix;
    this.mesh=new Mesh(geometry,material);this.mesh.name='Canal surface';
    this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;
  }
  update(time:number,boat:Vector3,tangent:Vector3,speed=0){
    this.interaction.update(time,boat,tangent,speed);
    this.mesh.material.uniforms.uBoatSpeed.value=speed;
    this.mesh.material.uniforms.uInteractionStrength.value=this.interaction.enabled?1:0;
    this.mesh.material.uniforms.uTime.value=time;
    this.mesh.material.uniforms.uBoat.value.copy(boat);
    this.mesh.material.uniforms.uBoatDirection.value.set(tangent.x,tangent.z);
  }
}
