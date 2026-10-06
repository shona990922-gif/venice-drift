import { describe, expect, it } from 'vitest';
import { Group, MathUtils, PerspectiveCamera, Raycaster, Vector3, Texture, WebGLRenderer } from 'three';
import { RouteController, ROUTE } from '../src/journey/RouteController';
import { LookState } from '../src/interaction/PointerLook';
import { sampleHull, waveHeight } from '../src/water/WaveField';
import { BoatFloatController } from '../src/journey/BoatFloatController';
import { JourneyScenery } from '../src/city/JourneyScenery';
import { bakeKit, buildChunk } from '../src/city/JourneyLayout';
import type { PBRSet } from '../src/city/Materials';
import { PASSENGER_EYE_HEIGHT } from '../src/journey/PassengerCamera';
const set=Object.fromEntries(['plaster','stone','brick','roof','wood'].map(k=>[k,{color:new Texture(),normal:new Texture(),arm:new Texture()}])) as PBRSet;
const routeFixture=new RouteController(),kit=bakeKit(),hero=new JourneyScenery(routeFixture,kit);hero.root.updateMatrixWorld(true);
import { applyObliqueNearPlane } from '../src/water/PlanarReflection';

describe('continuous passenger journey',()=>{
  it('completes the 500 m trip in 4–6 minutes without position or speed jumps',()=>{
    const route=new RouteController();let worst=0,travelled=0,seconds=0;
    while(route.distance<route.length && seconds<400){
      const old=route.position.clone(),before=route.distance;route.update(1/60);
      const displacement=old.distanceTo(route.position);worst=Math.max(worst,Math.abs(displacement-(route.distance-before)));
      travelled+=displacement;seconds+=1/60;expect(route.speed).toBeGreaterThan(1.2);expect(route.speed).toBeLessThanOrEqual(1.55);
    }
    expect(route.length).toBeGreaterThan(400);expect(route.length).toBeLessThan(700);
    expect(seconds).toBeGreaterThan(240);expect(seconds).toBeLessThan(360);
    expect(worst).toBeLessThan(.0003);expect(Math.abs(travelled-route.length)).toBeLessThan(.02);
    const end=route.position.clone();route.update(1);expect(route.position.distanceTo(end)).toBe(0);
    expect(ROUTE.sections).toHaveLength(5);expect(ROUTE.bridges).toHaveLength(3);
    console.info(`Journey ${route.length.toFixed(3)} m / ${seconds.toFixed(2)} s`);
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
  it('all three actual arches clear the passenger and remain solid overhead',()=>{
    const route=routeFixture;hero.root.updateMatrixWorld(true);
    for(const [index,bridge]of ROUTE.bridges.entries()){
      const camera=route.pointAtDistance(bridge.distance).setY(PASSENGER_EYE_HEIGHT);
      const up=new Raycaster(camera,new Vector3(0,1,0),0,10);
      const overhead=up.intersectObject(hero.bridges[index],true);
      expect(overhead.length,bridge.name).toBeGreaterThan(0);expect(overhead[0].distance).toBeGreaterThan(1.7);
      for(let s=bridge.distance-8;s<bridge.distance+8;s+=.4){
        const p=route.pointAtDistance(s).setY(1.8),t=route.tangentAtDistance(s);
        expect(new Raycaster(p,t,0,.6).intersectObjects(hero.collision,false)).toHaveLength(0);
      }
    }
  });
  it('the full canal clears a 10 m gondola swept through its authored facades',()=>{
    const route=routeFixture;
    for(let chunk=0;chunk<12;chunk++){
      const root=buildChunk(chunk,route,kit);root.updateMatrixWorld(true);
      for(let s=chunk*42;s<Math.min(route.length,(chunk+1)*42);s+=1){
        const p=route.pointAtDistance(s),t=route.tangentAtDistance(s),cross=new Vector3(-t.z,0,t.x);
        for(const side of [-.9,0,.9]){
          const point=p.clone().addScaledVector(cross,side).addScaledVector(t,-5).setY(1.6);
          expect(new Raycaster(point,t,0,10).intersectObject(root,true).length,`fairway ${s}m`).toBe(0);
        }
      }
      root.traverse(o=>{if('geometry' in o)(o.geometry as import('three').BufferGeometry).dispose();});
    }
  },20000);
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
