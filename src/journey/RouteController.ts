import {CatmullRomCurve3,MathUtils,Vector3} from 'three';
import data from '../../routes/journey-v3.json';
export const ROUTE=data;
export const wrap=(n:number,length:number)=>((n%length)+length)%length;
export const shortestDistance=(a:number,b:number,_length:number)=>Math.abs(a-b);
export class RouteController {
 readonly curve=new CatmullRomCurve3(data.points.map(p=>new Vector3(...p as [number,number,number])),false,'centripetal');
 readonly length:number;distance=0;totalDistance=0;speed=data.cruiseSpeed;curvature=0;yaw=0;
 readonly position=new Vector3();readonly tangent=new Vector3();private ahead=new Vector3();
 constructor(){this.curve.arcLengthDivisions=65536;this.curve.updateArcLengths();this.length=this.curve.getLength();this.sample();}
 pointAtDistance(d:number,target=new Vector3()){
  if(d<0)return this.curve.getPointAt(0,target).addScaledVector(this.curve.getTangentAt(0),d);
  if(d>this.length)return this.curve.getPointAt(1,target).addScaledVector(this.curve.getTangentAt(1),d-this.length);
  return this.curve.getPointAt(d/this.length,target);
 }
 tangentAtDistance(d:number,target=new Vector3()){return this.curve.getTangentAt(MathUtils.clamp(d/this.length,0,1),target);}
 widthAt(d:number){let w=data.sections[0].width;for(let i=1;i<data.sections.length;i++){const s=data.sections[i];w=MathUtils.lerp(w,s.width,MathUtils.smoothstep(d,s.start-16,s.start+16));}return w;}
 sectionAt(d=this.distance){return data.sections.findIndex(s=>d<s.end);}
 sample(){this.pointAtDistance(this.distance,this.position);this.tangentAtDistance(this.distance,this.tangent);this.yaw=Math.atan2(-this.tangent.x,-this.tangent.z);}
 update(dt:number){this.tangentAtDistance(this.distance+6,this.ahead);this.curvature=Math.acos(MathUtils.clamp(this.tangent.dot(this.ahead),-1,1))/6;
  const bridgeDistance=Math.min(...data.bridges.map(b=>Math.abs(this.distance-b.distance)));
  const target=data.cruiseSpeed*Math.min(1-.16*(1-MathUtils.smoothstep(bridgeDistance,3,15)),1-MathUtils.clamp(this.curvature*2.5,0,.18));
  this.speed=MathUtils.damp(this.speed,target,1.4,dt);const travel=Math.min(this.length-this.distance,this.speed*dt);this.distance+=travel;this.totalDistance+=travel;this.sample();
 }
 seek(d:number){this.distance=MathUtils.clamp(d,0,this.length);this.sample();}
}
