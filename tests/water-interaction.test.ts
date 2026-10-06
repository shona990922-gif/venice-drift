import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {BoatWaterInteraction,WAKE_SETTINGS} from '../src/water/BoatWaterInteraction';
function ride(seconds:number,hz=30){const field=new BoatWaterInteraction(),p=new Vector3(),t=new Vector3(0,0,-1);for(let i=0;i<=seconds*hz;i++){p.z=-i/hz*1.55;field.update(i/hz,p,t,1.55);}return{field,p,t};}
describe('slow gondola interaction mask',()=>{
 it('emits at gondola speed, stays narrow and bounds the reflection gradients',()=>{
  const {field}=ride(12);expect(field.samples.length).toBeGreaterThan(55);expect(field.samples.length).toBeLessThan(70);
  expect(field.peakSlope).toBeGreaterThan(.014);expect(field.peakSlope).toBeLessThanOrEqual(WAKE_SETTINGS.maxSlope);
  const s=field.samples.find(s=>12-s.born>3&&12-s.born<4)!;const age=12-s.born;
  const hit=field.sampleAt(s.x-s.dz*(.18+age*WAKE_SETTINGS.spread+.1),s.z+s.dx*(.18+age*WAKE_SETTINGS.spread+.1));
  expect(hit.mask).toBeGreaterThan(.08);expect(field.sampleAt(s.x+7,s.z).mask).toBe(0);
  expect(field.texture.image.width).toBe(256);field.dispose();
 });
 it('keeps old emissions at their world positions when the boat turns',()=>{
  const {field,p}=ride(5);const old=field.samples[8],x=old.x,z=old.z;
  for(let i=1;i<=30;i++){p.x+=1.55/30;field.update(5+i/30,p,new Vector3(1,0,0),1.55);}
  expect(field.samples.includes(old)).toBe(true);expect(old.x).toBe(x);expect(old.z).toBe(z);expect(old.dx).toBe(0);expect(old.dz).toBe(-1);
  expect(field.samples.at(-1)!.dx).toBe(1);field.dispose();
 });
 it('stopping leaves a short-lived trail which returns exactly to calm water',()=>{
  const {field,p,t}=ride(6);const count=field.samples.length;
  field.update(6.2,p,t,0);expect(field.samples.length).toBe(count);expect(field.peakSlope).toBeGreaterThan(0);
  field.update(17,p,t,0);expect(field.samples).toHaveLength(0);expect(field.peakSlope).toBe(0);
  const pixels=field.texture.image.data as Uint8Array;
  for(let i=0;i<pixels.length;i+=4){expect(pixels[i]).toBe(128);expect(pixels[i+1]).toBe(128);expect(pixels[i+2]).toBe(0);}
  field.dispose();
 });
 it('clears on debug seeking or segment reset instead of painting a cross-canal line',()=>{
  const {field,p,t}=ride(5);p.x+=100;field.update(5.1,p,t,0);expect(field.samples.length).toBe(0);expect(field.peakSlope).toBe(0);field.dispose();
 });
 it('uses distance-based emissions rather than frame-count spacing',()=>{
  const a=ride(3,30).field,b=ride(3,60).field;
  expect(Math.abs(a.samples.length-b.samples.length)).toBeLessThanOrEqual(1);
  for(let i=0;i<Math.min(a.samples.length,b.samples.length);i++)expect(Math.abs(a.samples[i].z-b.samples[i].z)).toBeLessThan(.001);
  a.dispose();b.dispose();
 });
});
