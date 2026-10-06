import { ClampToEdgeWrapping, DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, Vector2, Vector3 } from 'three';
export const WAKE_SETTINGS={resolution:256,span:36,life:10,spacing:.24,spread:.28,sternOffset:4.85,updateHz:30,maxSlope:.20} as const;
export interface WakeSample{x:number;z:number;dx:number;dz:number;born:number;gain:number;distance:number;}
/**
 * World-space wake history, rasterized into one small gradient/roughness mask.
 * Inspired by Open Water's fixed emission points + ageing transverse wavelets;
 * the canal version has millimetre-scale crests and no foam/displacement pass.
 * R/G: signed world X/Z slope, B: reflection roughness mask, A: source coverage.
 */
export class BoatWaterInteraction{
 readonly settings=WAKE_SETTINGS;
 readonly samples:WakeSample[]=[];
 readonly texture:DataTexture;
 readonly origin=new Vector2();
 enabled=true;updates=0;peakSlope=0;updateMs=0;
 private pixels=new Uint8Array(WAKE_SETTINGS.resolution**2*4);
 private gx=new Float32Array(WAKE_SETTINGS.resolution**2);
 private gz=new Float32Array(WAKE_SETTINGS.resolution**2);
 private mask=new Float32Array(WAKE_SETTINGS.resolution**2);
 private lastEmission:Vector3|null=null;
 private lastBoat:Vector3|null=null;
 private lastTime=-1;private lastRaster=-1;private travelled=0;
 constructor(){
  this.texture=new DataTexture(this.pixels,WAKE_SETTINGS.resolution,WAKE_SETTINGS.resolution,RGBAFormat,UnsignedByteType);
  this.texture.name='Gondola wake / world-space gradients';this.texture.minFilter=this.texture.magFilter=LinearFilter;
  this.texture.wrapS=this.texture.wrapT=ClampToEdgeWrapping;this.texture.generateMipmaps=false;this.clearPixels();
 }
 private clearPixels(){for(let i=0;i<this.pixels.length;i+=4){this.pixels[i]=128;this.pixels[i+1]=128;this.pixels[i+2]=0;this.pixels[i+3]=255;}this.texture.needsUpdate=true;}
 reset(){this.samples.length=0;this.lastEmission=null;this.lastBoat=null;this.lastTime=-1;this.lastRaster=-1;this.travelled=0;this.peakSlope=0;this.clearPixels();}
 update(time:number,boat:Vector3,forward:Vector3,speed:number){
  if((this.lastBoat&&this.lastBoat.distanceTo(boat)>3)||time<this.lastTime)this.reset();
  this.lastTime=time;this.lastBoat??=boat.clone();this.lastBoat.copy(boat);
  const dx=forward.x,dz=forward.z,stern=new Vector3(boat.x-dx*WAKE_SETTINGS.sternOffset,0,boat.z-dz*WAKE_SETTINGS.sternOffset);
  if(speed>.08){
   if(!this.lastEmission)this.emit(stern,dx,dz,time,speed);
   else{
    const distance=this.lastEmission.distanceTo(stern);
    if(distance>=WAKE_SETTINGS.spacing){
     const from=this.lastEmission.clone(),count=Math.min(12,Math.floor(distance/WAKE_SETTINGS.spacing));
     for(let i=1;i<=count;i++){
      const p=from.clone().lerp(stern,i*WAKE_SETTINGS.spacing/distance);
      this.emit(p,dx,dz,time-(distance-i*WAKE_SETTINGS.spacing)/Math.max(speed,.1),speed);
     }
    }
   }
  }
  while(this.samples.length&&time-this.samples[0].born>=WAKE_SETTINGS.life)this.samples.shift();
  if(time-this.lastRaster<1/WAKE_SETTINGS.updateHz-.0001)return;
  const start=performance.now();this.lastRaster=time;
  const cell=WAKE_SETTINGS.span/WAKE_SETTINGS.resolution;
  this.origin.set(Math.floor((boat.x-dx*5-WAKE_SETTINGS.span/2)/cell)*cell,Math.floor((boat.z-dz*5-WAKE_SETTINGS.span/2)/cell)*cell);
  this.gx.fill(0);this.gz.fill(0);this.mask.fill(0);
  for(const sample of this.samples)this.rasterize(sample,time);
  let peak=0;
  for(let i=0;i<this.gx.length;i++){
   const x=this.gx[i],z=this.gz[i],length=(x||z)?Math.hypot(x,z):0,scale=length>WAKE_SETTINGS.maxSlope?WAKE_SETTINGS.maxSlope/length:1;
   peak=Math.max(peak,length*scale);
   this.pixels[i*4]=Math.round(128+x*scale/WAKE_SETTINGS.maxSlope*127);
   this.pixels[i*4+1]=Math.round(128+z*scale/WAKE_SETTINGS.maxSlope*127);
   this.pixels[i*4+2]=Math.round(Math.min(1,this.mask[i])*255);
  }
  this.peakSlope=peak;this.texture.needsUpdate=true;this.updates++;this.updateMs=performance.now()-start;
 }
 private emit(p:Vector3,dx:number,dz:number,time:number,speed:number){
  this.travelled+=this.lastEmission?this.lastEmission.distanceTo(p):0;
  this.samples.push({x:p.x,z:p.z,dx,dz,born:time,gain:Math.min(1.12,speed/1.55),distance:this.travelled});
  this.lastEmission=p.clone();if(this.samples.length>80)this.samples.shift();
 }
 private rasterize(s:WakeSample,time:number){
  const age=Math.max(0,time-s.born),life=WAKE_SETTINGS.life;
  const fade=(1-Math.exp(-age*7))*Math.exp(-age*.19)*Math.min(1,(life-age)/1.6);
  if(fade<=0)return;
  const spread=.18+age*WAKE_SETTINGS.spread,sigma=.20+age*.017,alongSigma=.53+age*.035;
  const inv=WAKE_SETTINGS.resolution/WAKE_SETTINGS.span,n=WAKE_SETTINGS.resolution,sx=-s.dz,sz=s.dx;
  // Tight bounds of the rotated pair avoid evaluating a mostly empty square.
  const extentX=Math.abs(s.dx)*alongSigma*2.8+Math.abs(sx)*(spread+sigma*3);
  const extentZ=Math.abs(s.dz)*alongSigma*2.8+Math.abs(sz)*(spread+sigma*3);
  const minX=Math.max(0,Math.floor((s.x-extentX-this.origin.x)*inv)),maxX=Math.min(n-1,Math.ceil((s.x+extentX-this.origin.x)*inv));
  const minZ=Math.max(0,Math.floor((s.z-extentZ-this.origin.y)*inv)),maxZ=Math.min(n-1,Math.ceil((s.z+extentZ-this.origin.y)*inv));
  // The normalization keeps a continuous ribbon as emission density changes.
  const weight=WAKE_SETTINGS.spacing/(Math.sqrt(Math.PI)*alongSigma)*fade*s.gain;
  for(let j=minZ;j<=maxZ;j++)for(let i=minX;i<=maxX;i++){
   const rx=this.origin.x+(i+.5)/inv-s.x,rz=this.origin.y+(j+.5)/inv-s.z;
   const along=rx*s.dx+rz*s.dz;if(Math.abs(along)>alongSigma*2.8)continue;
   const across=rx*sx+rz*sz,q=Math.abs(across)-spread;
   if(Math.abs(q)>sigma*3)continue;
   const envelope=Math.exp(-((along/alongSigma)**2)-(q/sigma)**2);
   // Small paired ridge/trough wavelets move outward; old points never follow
   // the current heading, so a turn leaves a curved wake at the original place.
   const phase=q*12.5+Math.sin(s.distance*.82)*.32;
   const amplitude=.016*weight,shape=Math.cos(phase),derivative=-12.5*Math.sin(phase)-2*q/(sigma*sigma)*shape;
   const sideSlope=amplitude*envelope*derivative*Math.sign(across);
   const alongSlope=amplitude*envelope*shape*(-2*along/(alongSigma*alongSigma));
   const k=j*n+i;this.gx[k]+=s.dx*alongSlope+sx*sideSlope;this.gz[k]+=s.dz*alongSlope+sz*sideSlope;
   this.mask[k]+=envelope*weight*.78;
  }
 }
 /** Read-only diagnostics in world coordinates, useful for decay/turn regression tests. */
 sampleAt(x:number,z:number){const n=WAKE_SETTINGS.resolution,i=Math.floor((x-this.origin.x)/WAKE_SETTINGS.span*n),j=Math.floor((z-this.origin.y)/WAKE_SETTINGS.span*n);if(i<0||j<0||i>=n||j>=n)return {x:0,z:0,mask:0};const k=(j*n+i)*4;return{x:(this.pixels[k]-128)/127*WAKE_SETTINGS.maxSlope,z:(this.pixels[k+1]-128)/127*WAKE_SETTINGS.maxSlope,mask:this.pixels[k+2]/255};}
 dispose(){this.texture.dispose();}
}
