import { describe, expect, it } from 'vitest';
import { Group, MathUtils, PerspectiveCamera, Raycaster, Vector3, Texture, WebGLRenderer } from 'three';
import { RouteController, ROUTE } from '../src/journey/RouteController';
import { LookState } from '../src/interaction/PointerLook';
import { sampleHull, waveHeight } from '../src/water/WaveField';
import { BoatFloatController } from '../src/journey/BoatFloatController';
import { VeniceScene, HERO_LENGTH, FACADES } from '../src/city/VeniceScene';
import type { PBRSet } from '../src/city/Materials';
import { PASSENGER_EYE_HEIGHT } from '../src/journey/PassengerCamera';
const set=Object.fromEntries(['plaster','stone','brick','roof','wood'].map(k=>[k,{color:new Texture(),normal:new Texture(),arm:new Texture()}])) as PBRSet;
const hero=new VeniceScene(new RouteController(),set);hero.root.updateMatrixWorld(true);
import { applyObliqueNearPlane } from '../src/water/PlanarReflection';

describe('continuous passenger journey',()=>{
  it('moves in metres per second and joins the loop without a jump',()=>{
    const route=new RouteController();let worst=0;let travelled=0;
    const dt=1/60;
    for(let i=0;i<12000;i++){
      const old=route.position.clone();route.update(dt);
      const displacement=old.distanceTo(route.position);worst=Math.max(worst,Math.abs(displacement-route.speed*dt));
      travelled+=displacement;expect(route.speed).toBeGreaterThan(1.2);expect(route.speed).toBeLessThanOrEqual(1.55);
    }
    expect(worst).toBeLessThan(.0001);
    expect(Math.abs(travelled-route.totalDistance)).toBeLessThan(.005);
    expect(route.totalDistance).toBeGreaterThan(route.length);
    const p1=route.pointAtDistance(route.length-.001),p2=route.pointAtDistance(.001);
    expect(p1.distanceTo(p2)).toBeLessThan(.0021);
    expect(route.tangentAtDistance(route.length-.001).dot(route.tangentAtDistance(.001))).toBeGreaterThan(.99999);
  });
  it('turns and bridge approaches have continuous bounded acceleration',()=>{
    const r=new RouteController();r.seek(ROUTE.bridgeDistance-18);let maxAcceleration=0,minSpeed=2;
    for(let i=0;i<1800;i++){const old=r.speed;r.update(1/60);maxAcceleration=Math.max(maxAcceleration,Math.abs(r.speed-old)*60);minSpeed=Math.min(minSpeed,r.speed);}
    expect(minSpeed).toBeLessThan(1.4);expect(maxAcceleration).toBeLessThan(.2);
  });
  it('drag is damped, pitch limited, yaw unbounded, and release never recentres',()=>{
    const look=new LookState();look.drag(1300,-2000,.004);const target=look.targetYaw;
    expect(target).toBeLessThan(-Math.PI);expect(look.yaw).toBe(0);expect(look.targetPitch).toBe(1.32);
    for(let i=0;i<300;i++)look.update(1/60);
    expect(look.yaw).toBeCloseTo(target,6);expect(look.pitch).toBeCloseTo(1.32,6);
    for(let i=0;i<600;i++)look.update(1/60);
    expect(look.targetYaw).toBe(target);expect(look.yaw).toBeCloseTo(target,6);
  });
  it('float stays centimetre scale and never modifies the route root',()=>{
    const root=new Group(),visual=new Group(),passenger=new Group(),float=new BoatFloatController();root.position.set(-16,0,7);
    for(let i=0;i<2000;i++){
      const t=i/30;float.update(1/30,t,root,visual,passenger);
      expect(Math.abs(waveHeight(-16,7,t))).toBeLessThanOrEqual(.0231);
      expect(Math.abs(float.heave)).toBeLessThan(.024);
      expect(Math.abs(float.roll)).toBeLessThanOrEqual(.018);
      expect(Math.abs(float.pitch)).toBeLessThanOrEqual(.012);
    }
    expect(root.position.toArray()).toEqual([-16,0,7]);expect(passenger.position.y).toBeGreaterThan(PASSENGER_EYE_HEIGHT-.02);expect(passenger.position.y).toBeLessThan(PASSENGER_EYE_HEIGHT+.02);
  });
  it('actual bridge geometry is open at boat height and solid overhead',()=>{
    const route=new RouteController(),city=hero;city.root.updateMatrixWorld(true);
    const camera=route.pointAtDistance(ROUTE.bridgeDistance).setY(PASSENGER_EYE_HEIGHT);
    const up=new Raycaster(camera,new Vector3(0,1,0),0,10);
    const overhead=up.intersectObject(city.bridge,true);
    expect(overhead.length).toBeGreaterThan(0);expect(overhead[0].distance).toBeGreaterThan(1.87);expect(overhead[0].distance).toBeLessThan(1.99);
    for(let s=ROUTE.bridgeDistance-7;s<ROUTE.bridgeDistance+7;s+=.2){
      const p=route.pointAtDistance(s).setY(1.8),t=route.tangentAtDistance(s);
      const ray=new Raycaster(p,t,0,.5);expect(ray.intersectObjects(city.collisionMeshes,false).length).toBe(0);
    }
  });
  it('the entire 125 m hero fairway and passenger offset clear actual architecture',()=>{
    const route=new RouteController();expect(FACADES.length).toBe(12);expect(HERO_LENGTH).toBeGreaterThanOrEqual(100);expect(HERO_LENGTH).toBeLessThanOrEqual(150);
    for(let s=0;s<=HERO_LENGTH;s+=.4){
      const p=route.pointAtDistance(s),t=route.tangentAtDistance(s),cross=new Vector3(-t.z,0,t.x);
      for(const side of [-.85,0,.85]){
        const point=p.clone().addScaledVector(cross,side).setY(1.52);
        const ray=new Raycaster(point,t,0,2.8);
        expect(ray.intersectObjects(hero.collisionMeshes,false).length,`fairway at ${s.toFixed(1)} m`).toBe(0);
      }
    }
  });
  it('oblique clipping projects water plane onto near clip plane',()=>{
    const c=new PerspectiveCamera(69,1.6,.07,450);
    // A simple view-space plane z=-2: the new near boundary must map to NDC z=-1.
    applyObliqueNearPlane(c.projectionMatrix.elements,[0,0,-1,-2],0);
    const on=new Vector3(0,0,-2).applyMatrix4(c.projectionMatrix);
    expect(on.z).toBeCloseTo(-1,7);
    expect(new Vector3(0,0,-3).applyMatrix4(c.projectionMatrix).z).toBeGreaterThan(-1);
    expect(new Vector3(0,0,-1).applyMatrix4(c.projectionMatrix).z).toBeLessThan(-1);
  });
});
