import { DirectionalLight, WebGLRenderer } from 'three';
import { PlanarReflection } from '../water/PlanarReflection';
export type QualityMode='auto'|'high'|'medium'|'low';
export const PROFILES={high:{ratio:1.5,reflection:1024,shadow:2048,interval:1},medium:{ratio:1.25,reflection:512,shadow:1024,interval:1},low:{ratio:1,reflection:256,shadow:512,interval:2}};
export class QualityController {
  mode:QualityMode='auto';tier:'high'|'medium'|'low';scale=1;
  private samples:number[]=[];private lastChange=0;private lastCheck=0;
  reflectionSize:number;shadowSize:number;
  constructor(private renderer:WebGLRenderer,private reflection:PlanarReflection,private sun:DirectionalLight,readonly mobile:boolean){
    this.tier=mobile?'medium':'high';this.reflectionSize=PROFILES[this.tier].reflection;this.shadowSize=PROFILES[this.tier].shadow;
    this.apply();
  }
  setMode(mode:QualityMode){
    this.mode=mode;this.tier=mode==='auto'?(this.mobile?'medium':'high'):mode;this.scale=1;
    this.reflectionSize=PROFILES[this.tier].reflection;this.shadowSize=PROFILES[this.tier].shadow;this.samples=[];
    this.lastChange=performance.now();this.apply();
  }
  apply(){
    const p=PROFILES[this.tier];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,p.ratio)*this.scale);
    this.renderer.setSize(innerWidth,innerHeight,false);
    this.reflection.configure(this.reflectionSize,this.mobile?2:p.interval);
    if(this.sun.shadow.mapSize.x!==this.shadowSize){this.sun.shadow.mapSize.set(this.shadowSize,this.shadowSize);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
  }
  observe(ms:number,now:number){
    if(this.mode!=='auto'||document.hidden||ms>200||ms<1)return;
    this.samples.push(ms);if(this.samples.length>180)this.samples.shift();
    if(this.samples.length<90||now-this.lastCheck<3000)return;
    this.lastCheck=now;
    const sorted=[...this.samples].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
    const budget=1000/(this.mobile?30:60);
    if(median>budget*1.28&&now-this.lastChange>5000){
      if(this.scale>.71)this.scale=Math.max(.7,this.scale-.1);
      else if(this.reflectionSize>256)this.reflectionSize/=2;
      else if(this.shadowSize>512)this.shadowSize/=2;
      else return;
      this.lastChange=now;this.samples=[];this.apply();
    }else if(median<budget*1.04&&this.scale<1&&now-this.lastChange>25000){
      this.scale=Math.min(1,this.scale+.05);this.lastChange=now;this.samples=[];this.apply();
    }
  }
}
