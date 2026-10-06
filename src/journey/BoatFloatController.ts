import { Group, MathUtils } from 'three';
import { PASSENGER_EYE_HEIGHT } from './PassengerCamera';
import { sampleHull } from '../water/WaveField';
export class BoatFloatController {
  heave = 0; pitch = 0; roll = 0;
  update(dt: number, time: number, root: Group, visual: Group, passenger: Group) {
    const water = sampleHull(root.position.x, root.position.z, root.rotation.y, time);
    this.heave = MathUtils.damp(this.heave, water.heave, 2.8, dt);
    this.pitch = MathUtils.damp(this.pitch, MathUtils.clamp(water.pitch, -0.012, 0.012), 2.1, dt);
    this.roll = MathUtils.damp(this.roll, MathUtils.clamp(water.roll, -0.018, 0.018), 2.1, dt);
    visual.position.y = this.heave;
    visual.rotation.set(this.pitch, 0, this.roll);
    // A seated passenger follows translation; body/neck damp angular motion.
    passenger.position.y = PASSENGER_EYE_HEIGHT + this.heave * 0.6;
    passenger.rotation.set(this.pitch * 0.35, 0, this.roll * 0.3);
  }
}
