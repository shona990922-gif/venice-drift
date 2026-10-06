import { Group, PerspectiveCamera } from 'three';
import { PointerLook } from '../interaction/PointerLook';
export class PassengerCamera {
  readonly passenger = new Group();
  readonly lookRig = new Group();
  readonly pitchRig = new Group();
  private heading: number | null = null;
  readonly camera = new PerspectiveCamera(69, 1, 0.07, 450);
  readonly input: PointerLook;
  constructor(root: Group, element: HTMLElement) {
    this.passenger.name = 'PassengerRig';
    this.lookRig.name = 'CameraYawRig';
    this.pitchRig.name = 'CameraPitchRig';
    this.passenger.position.set(0, 1.34, 1.45);
    this.lookRig.rotation.order = 'YXZ';
    root.add(this.passenger);
    this.passenger.add(this.lookRig);
    this.lookRig.add(this.pitchRig);
    this.pitchRig.add(this.camera);
    this.input = new PointerLook(element);
  }
  update(dt: number, boatYaw: number) {
    this.input.update(dt);
    if(this.heading===null)this.heading=boatYaw;
    const delta=Math.atan2(Math.sin(boatYaw-this.heading),Math.cos(boatYaw-this.heading));
    this.heading+=delta*(1-Math.exp(-2.2*dt));
    this.passenger.rotation.y=this.heading-boatYaw;
    this.lookRig.rotation.y=this.input.yaw;
    this.pitchRig.rotation.x=this.input.pitch;
  }
  resetHeading(yaw:number){this.heading=yaw;}
  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
}
