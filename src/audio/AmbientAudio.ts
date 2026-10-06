import {MathUtils} from 'three';
import {ROUTE} from '../journey/RouteController';
type Channel={gain:GainNode;pan:StereoPannerNode;filter:BiquadFilterNode;buffer:AudioBuffer;next:number;loop:boolean};
/** CC0 Venice field recordings, soft overlapping loops and a very quiet original
 * bell/wood layer. No music, microphone or external service is used. */
export class AmbientAudio {
 context:AudioContext|null=null;enabled=false;ready=false;error:string|null=null;
 private master?:GainNode;private dry?:GainNode;private reverb?:GainNode;private convolver?:ConvolverNode;private analyser?:AnalyserNode;
 private channels=new Map<string,Channel>();private active=new Set<AudioScheduledSourceNode>();private loading?:Promise<void>;private nextBird=9;private nextCreak=16;private lastBell=-1;private lastUpdate=-1;private disposed=false;
 stream?:MediaStreamAudioDestinationNode;private zone=0;private waterGain=0;private cityGain=0;
 async setEnabled(on:boolean){this.enabled=on;if(!on){if(this.context&&this.master)this.master.gain.setTargetAtTime(0,this.context.currentTime,.2);return;}
  try{if(!this.context){this.context=new AudioContext();this.setup();}await this.context.resume();
   if(!this.loading)this.loading=this.load();await this.loading;if(this.disposed)return;this.master!.gain.setTargetAtTime(this.enabled?.65:0,this.context.currentTime,.8);
  }catch(e){this.error=String(e);this.enabled=false;}
 }
 private setup(){const c=this.context!;this.master=c.createGain();this.master.gain.value=0;this.analyser=c.createAnalyser();this.analyser.fftSize=512;this.master.connect(this.analyser);this.analyser.connect(c.destination);this.stream=c.createMediaStreamDestination();this.master.connect(this.stream);
  this.dry=c.createGain();this.dry.gain.value=.95;this.dry.connect(this.master);this.reverb=c.createGain();this.reverb.gain.value=.03;this.reverb.connect(this.master);this.convolver=c.createConvolver();
  const duration=.85,ir=c.createBuffer(2,Math.floor(c.sampleRate*duration),c.sampleRate);let seed=1731;for(let ch=0;ch<2;ch++){const a=ir.getChannelData(ch);for(let i=0;i<a.length;i++){seed=(1664525*seed+1013904223)>>>0;a[i]=(seed/2147483648-1)*Math.exp(-i/c.sampleRate*7)*.28;}}
  this.convolver.buffer=ir;this.convolver.connect(this.reverb);
 }
 private async load(){const c=this.context!;const files=['canal-water','venice-ambience','birds'];await Promise.all(files.map(async name=>{
   try{const response=await fetch(`${import.meta.env.BASE_URL}assets/audio/${name}.mp3`);if(!response.ok)throw Error(`${name}: HTTP ${response.status}`);const buffer=await c.decodeAudioData(await response.arrayBuffer());if(this.disposed)return;
    const gain=c.createGain(),pan=c.createStereoPanner(),filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=name==='venice-ambience'?1800:6000;gain.gain.value=0;filter.connect(pan);pan.connect(gain);gain.connect(this.dry!);gain.connect(this.convolver!);this.channels.set(name,{gain,pan,filter,buffer,next:c.currentTime+.05,loop:name!=='birds'});
   }catch(e){this.error=String(e);}
  }));this.ready=this.channels.size>0;
 }
 private clip(channel:Channel,at:number,offset=0,length=channel.buffer.duration,level=1){const c=this.context!,source=c.createBufferSource(),envelope=c.createGain();source.buffer=channel.buffer;source.connect(envelope);envelope.connect(channel.filter);const fade=Math.min(2,length*.15);envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(level,at+fade);envelope.gain.setValueAtTime(level,at+length-fade);envelope.gain.linearRampToValueAtTime(0,at+length);source.start(at,offset,length);this.active.add(source);source.onended=()=>{this.active.delete(source);source.disconnect();envelope.disconnect();};}
 private bell(level:number){const c=this.context!;for(const [ratio,amplitude,decay]of [[1,.52,5.3],[2.76,.24,3.7],[4.07,.12,2.6],[5.42,.07,1.3]]){const osc=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner();osc.frequency.value=196*ratio;osc.type='sine';pan.pan.value=.42;gain.gain.setValueAtTime(.00001,c.currentTime);gain.gain.exponentialRampToValueAtTime(amplitude*level,c.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.00001,c.currentTime+decay);osc.connect(gain);gain.connect(pan);pan.connect(this.dry!);pan.connect(this.convolver!);osc.start();osc.stop(c.currentTime+decay+.05);this.active.add(osc);osc.onended=()=>{this.active.delete(osc);osc.disconnect();gain.disconnect();pan.disconnect();};}}
 private creak(){const c=this.context!,osc=c.createOscillator(),gain=c.createGain(),filter=c.createBiquadFilter();osc.type='triangle';osc.frequency.setValueAtTime(94,c.currentTime);osc.frequency.exponentialRampToValueAtTime(53,c.currentTime+.34);filter.type='bandpass';filter.frequency.value=220;filter.Q.value=.7;gain.gain.setValueAtTime(0,c.currentTime);gain.gain.linearRampToValueAtTime(.035,c.currentTime+.04);gain.gain.exponentialRampToValueAtTime(.00001,c.currentTime+.42);osc.connect(filter);filter.connect(gain);gain.connect(this.dry!);osc.start();osc.stop(c.currentTime+.45);this.active.add(osc);osc.onended=()=>{this.active.delete(osc);osc.disconnect();gain.disconnect();filter.disconnect();};}
 update(distance:number,progress:number,speed:number,yaw:number,journeyFade:number){const c=this.context;if(!c||!this.ready||c.state!=='running'||c.currentTime-this.lastUpdate<.1)return;const now=c.currentTime;this.lastUpdate=now;
  for(const channel of this.channels.values())if(channel.loop&&channel.next<now+1){channel.next=Math.max(channel.next,now+.01);this.clip(channel,channel.next);channel.next+=channel.buffer.duration-2;}
  const under=Math.max(...ROUTE.bridges.map(b=>1-MathUtils.smoothstep(Math.abs(distance+2.35-b.distance),1.4,6)));
  const open=MathUtils.smoothstep(distance,190,225)*(1-MathUtils.smoothstep(distance,275,300)),terrace=Math.exp(-(((distance-416)/40)**2));
  this.zone=under;this.waterGain=(.42+.08*open)*(.75+.25*Math.min(1,speed/1.55));this.cityGain=.025+.045*open+.10*terrace;
  const water=this.channels.get('canal-water'),city=this.channels.get('venice-ambience'),birds=this.channels.get('birds');
  if(water){water.gain.gain.setTargetAtTime(this.waterGain,now,1.2);water.filter.frequency.setTargetAtTime(under>0?3600:6200,now,.9);}
  if(city){city.gain.gain.setTargetAtTime(this.cityGain*(1-under*.45),now,2);city.pan.pan.setTargetAtTime(Math.sin(.8-yaw)*.45,now,.6);}
  if(birds){birds.gain.gain.setTargetAtTime(.13*(1-under*.7)*(1-progress*.45),now,2);birds.pan.pan.setTargetAtTime(Math.sin(distance*.012-yaw)*.6,now,.6);if(this.enabled&&now>this.nextBird){const length=Math.min(4,birds.buffer.duration);this.clip(birds,now+.1,(Math.floor(distance)%Math.max(1,Math.floor(birds.buffer.duration-length))),length);this.nextBird=now+28+11*Math.abs(Math.sin(distance));}}
  this.reverb!.gain.setTargetAtTime(.025+under*.14,now,.8);this.master!.gain.setTargetAtTime(this.enabled?.65*(1-journeyFade*.75):0,now,.4);
  if(this.enabled&&speed>.2&&now>this.nextCreak){this.creak();this.nextCreak=now+19+Math.abs(Math.sin(distance))*13;}
  const bellZone=distance>366&&distance<430?Math.floor((distance-366)/22):-1;if(this.enabled&&bellZone>=0&&bellZone!==this.lastBell){this.bell(.035);this.lastBell=bellZone;}if(distance<10)this.lastBell=-1;
 }
 async visible(visible:boolean){if(!this.context)return;try{if(visible&&this.enabled)await this.context.resume();else await this.context.suspend();}catch{/* Audio is optional. */}}
 snapshot(){let rms=0;if(this.analyser){const values=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(values);rms=Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);}return {enabled:this.enabled,ready:this.ready,state:this.context?.state||'not started',activeSources:this.active.size,loadedBuffers:this.channels.size,bridgeEnclosure:this.zone,waterGain:this.waterGain,cityGain:this.cityGain,rms,error:this.error};}
 dispose(){this.disposed=true;for(const s of this.active)try{s.stop();}catch{}this.active.clear();this.channels.clear();void this.context?.close();}
}
