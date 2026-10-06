import {Vector3} from 'three';
import type {HeightfieldAdapter} from './HeightfieldAdapter';
export class BoatWaterEmitters{
 positions={bow:new Vector3(),left:new Vector3(),right:new Vector3(),stern:new Vector3()};private last:Vector3|null=null;
 reset(){this.last=null}
 update(boat:Vector3,forward:Vector3,speed:number,sim:HeightfieldAdapter){const side=new Vector3(-forward.z,0,forward.x);this.positions.bow.copy(boat).addScaledVector(forward,4.95);this.positions.stern.copy(boat).addScaledVector(forward,-4.85);this.positions.left.copy(boat).addScaledVector(side,-.93);this.positions.right.copy(boat).addScaledVector(side,.93);
  if(speed<.05){this.last=null;return}if(this.last&&this.last.distanceTo(boat)<.18)return;this.last=boat.clone();const gain=Math.min(1.3,speed/1.55);
  for(const[name,amp,r]of[['bow',.008,.38],['left',.0025,.24],['right',.0025,.24],['stern',.009,.42]]as const){const p=this.positions[name];sim.createRipple(p,amp*gain,r);sim.createRipple(p.clone().addScaledVector(forward,-.24),-amp*gain,r);}
 }
}
