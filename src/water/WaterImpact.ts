import { Vector3 } from "three";
export type ImpactSource =
  "BOAT_BOW" | "BOAT_HULL" | "BOAT_STERN" | "RAIN" | "OTHER_BOAT" | "DEBUG";
export interface WaterImpact {
  worldPosition: Vector3;
  radius: number;
  strength: number;
  source: ImpactSource;
}
export class RainImpactQueue {
  private events: WaterImpact[] = [];
  dropped = 0;
  constructor(readonly capacity = 96) {}
  get length() {
    return this.events.length;
  }
  push(event: WaterImpact) {
    if (this.events.length >= this.capacity) {
      this.dropped++;
      return;
    }
    this.events.push({ ...event, worldPosition: event.worldPosition.clone() });
  }
  consume(max: number) {
    return this.events.splice(0, max);
  }
  clear() {
    this.events.length = 0;
  }
}
