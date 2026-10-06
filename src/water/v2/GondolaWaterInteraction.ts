import {Vector3} from 'three';
import type {HeightfieldAdapter} from '../simulation/HeightfieldAdapter';
import type {CanalSettings} from './Presets';

/** WaterThreeJS body-position/velocity inputs, adapted to four hull contact points.
 * Its upstream shader only paints foam. These inputs instead displace the
 * verified height/velocity solver; no white overlay and no fixed V texture.
 */
export class GondolaWaterInteraction {
  readonly positions={bow:new Vector3(),left:new Vector3(),right:new Vector3(),stern:new Vector3()};
  readonly velocity=new Vector3();
  private lastEmission:Vector3|null=null;
  count=0;
  reset(){this.lastEmission=null;this.velocity.set(0,0,0);}
  update(position:Vector3,forward:Vector3,speed:number,sim:HeightfieldAdapter,settings:CanalSettings) {
    this.velocity.copy(forward).multiplyScalar(speed);
    const side=new Vector3(-forward.z,0,forward.x);
    this.positions.bow.copy(position).addScaledVector(forward,4.95);
    this.positions.stern.copy(position).addScaledVector(forward,-4.85);
    this.positions.left.copy(position).addScaledVector(side,-.93);
    this.positions.right.copy(position).addScaledVector(side,.93);
    if(speed<.05){this.lastEmission=null;return;}
    if(this.lastEmission&&this.lastEmission.distanceTo(position)<.18)return;
    this.lastEmission=position.clone();
    const gain=Math.min(1.3,speed/1.55)*settings.interaction;
    for(const[name,amplitude,radius,strength]of [
      ['bow',.012,.38,settings.bow],['left',.003,.24,settings.side],
      ['right',.003,.24,settings.side],['stern',.014,.42,settings.stern],
    ]as const){
      const p=this.positions[name];sim.createRipple(p,amplitude*gain*strength,radius);
      // Paired displacement: conserve local volume instead of continually
      // depressing the whole simulation surface under a moving boat.
      sim.createRipple(p.clone().addScaledVector(forward,-.24),-amplitude*gain*strength,radius);
      this.count++;
    }
  }
}
