import './style.css';
import {Scene,Vector2,Vector3,WebGLRenderer,SRGBColorSpace,PCFShadowMap,Raycaster,Mesh} from 'three';
import {RouteController,ROUTE} from './journey/RouteController';
import {BoatController} from './journey/BoatController';
import {PassengerCamera,PASSENGER_EYE_HEIGHT} from './journey/PassengerCamera';
import {loadMaterials} from './city/Materials';
import {VenetianKit} from './city/VenetianKit';
import {CityChunkManager} from './city/CityChunkManager';
import {JourneyScenery} from './city/JourneyScenery';
import {PlanarReflection} from './water/PlanarReflection';
import {WaterThreeCanal} from './water/v2/WaterThreeCanal';
import {WaterRenderer} from './water/v2/WaterRenderer';
import {WATER_QUALITY,type WaterQuality} from './water/v2/Presets';
import {EnvironmentController} from './environment/EnvironmentController';
import {GpuTimer} from './diagnostics/GpuTimer';
const $=(id:string)=>document.getElementById(id)!;const query=new URLSearchParams(location.search);const debug=query.has('debug');
async function boot(){const canvas=$('scene') as HTMLCanvasElement;const renderer=new WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;renderer.info.autoReset=false;
 if(!renderer.capabilities.isWebGL2||!renderer.extensions.has('EXT_color_buffer_float'))throw Error('此设备缺少 Water V2 所需的 WebGL2 浮点纹理支持。请换用支持硬件加速的浏览器。');
 const q=(query.get('quality')||'medium') as WaterQuality,quality=q in WATER_QUALITY?q:'medium',profile=WATER_QUALITY[quality];
 const scene=new Scene(),route=new RouteController(),boat=new BoatController();boat.update(route);scene.add(boat.root);const passenger=new PassengerCamera(boat.root,canvas);
 const planar=new PlanarReflection(renderer,profile.reflection);planar.interval=quality==='low'?2:1;
 const water=new WaterThreeCanal(renderer,route,new Vector3(0,1,0),planar,quality);scene.add(water.mesh,water.bed);
 const environment=new EnvironmentController(scene,renderer,water),pipeline=new WaterRenderer(renderer,scene,water,planar,quality),gpu=new GpuTimer(renderer.getContext() as WebGL2RenderingContext);
 const materials=await loadMaterials(),kit=new VenetianKit(materials),city=new CityChunkManager(route,kit),scenery=new JourneyScenery(route,kit);scene.add(city.root,scenery.root);await city.start();
 const size=new Vector2(),eye=new Vector3();let started=false,paused=false,time=0,last=performance.now(),heave=0,frames=0,elapsed=0,fps=0,calls=0,triangles=0,cs=0,ts=0,fade=-1,loop=0,shot=false,disposed=false;
 const resize=()=>{renderer.setPixelRatio(Math.min(devicePixelRatio,profile.pixelRatio));renderer.setSize(innerWidth,innerHeight,false);passenger.resize(innerWidth,innerHeight);renderer.getDrawingBufferSize(size);pipeline.resize(size.x,size.y);planar.invalidate();};window.addEventListener('resize',resize);resize();
 environment.sun.shadow.mapSize.setScalar(quality==='high'?2048:quality==='low'?512:1024);
 const start=()=>{started=true;passenger.input.enabled=true;document.body.classList.add('started');$('hint').classList.add('visible');setTimeout(()=>$('hint').classList.remove('visible'),4200);};
 $('start').onclick=start;const seek=(distance:number)=>{route.seek(distance);boat.update(route);passenger.resetHeading(route.yaw);city.update(route.distance,quality==='low');water.reset(route.position);planar.invalidate();};
 if(debug){$('debug').hidden=false;for(const [id,d]of [['jump-start',0],['jump-bridge',ROUTE.bridgeDistance-12],['jump-hero',ROUTE.heroDistance]]as const)$(id).onclick=()=>{start();seek(d);};$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'继续':'暂停';};$('capture').onclick=()=>shot=true;}
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('notice').textContent='此浏览器暂不支持全屏';}};
 ($('quality')as HTMLSelectElement).value=quality;($('quality')as HTMLSelectElement).onchange=()=>{const u=new URL(location.href);u.searchParams.set('quality',($('quality')as HTMLSelectElement).value);location.href=u.href;};
 const snapshot=()=>({version:'round03a',fps,gpu:gpu.stats('journey'),framebuffer:size.toArray(),drawCalls:calls,triangles,time,distance:route.distance,length:route.length,speed:route.speed,loop,quality,loadedChunks:[...city.loaded.keys()],pendingChunks:[...city.pending.keys()],chunkLoads:city.loads,chunkDisposals:city.unloads,geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,renderTargets:6,reflectionResolution:planar.target.width,simulationResolution:water.simulation.resolution,emissions:water.interaction.count,camera:passenger.camera.getWorldPosition(eye).toArray(),look:[passenger.input.yaw,passenger.input.pitch],pointer:passenger.input.lastPointerType,environment:{elevation:environment.elevation,azimuth:environment.azimuth},errors:city.errors});
 if(debug){$('measure').onclick=()=>{$('measurement').textContent=JSON.stringify(snapshot(),null,2);};Object.assign(window,{__VENICE_DEBUG__:{snapshot,start,seek,route,boat,water,passenger,city,scenery,renderer,environment,pipeline,pause:(p:boolean)=>paused=p}});}
 $('loading').remove();($('start') as HTMLButtonElement).disabled=false;if(query.has('autostart'))start();
 const save=(blob:Blob,name:string)=>{if(import.meta.env.DEV){void fetch('/__evidence?name='+name,{method:'POST',body:blob}).then(r=>{if(!r.ok)throw Error('Cannot save evidence');$('notice').textContent='已保存 '+name;});}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);}};
 document.addEventListener('visibilitychange',()=>{last=performance.now();elapsed=0;frames=0;});
 function frame(now:number){if(disposed)return;requestAnimationFrame(frame);const raw=(now-last)/1000;last=now;if(document.hidden)return;const dt=Math.min(.05,Math.max(0,raw));time+=dt;
  if(started&&!paused&&fade<0)route.update(dt);
  if(route.distance>=route.length&&fade<0)fade=0;if(fade>=0){fade+=dt;$('fade').style.opacity=String(fade<3?fade/3:Math.max(0,1-(fade-3)/4));if(fade>=3&&route.distance>=route.length){seek(0);loop++;}if(fade>7)fade=-1;}
  boat.update(route);const h=water.ocean.heightAt(route.position.x,route.position.z,time);heave+=(h-heave)*(1-Math.exp(-dt*2.8));boat.visual.position.y=heave;boat.visual.rotation.z=Math.sin(time*.52)*.008;boat.visual.rotation.x=Math.sin(time*.41)*.004;passenger.passenger.position.y=PASSENGER_EYE_HEIGHT+heave*.45;passenger.update(dt,route.yaw);passenger.camera.getWorldPosition(eye);
  environment.update(route.position,eye,time,route.distance/route.length);city.update(route.distance,quality==='low');scene.updateMatrixWorld(true);renderer.info.reset();gpu.begin('journey');water.update(dt,time,route.position,route.tangent,started&&!paused&&fade<0?route.speed:0);pipeline.exposure=environment.exposure;pipeline.render(passenger.camera,time);gpu.end();gpu.poll();
  cs+=renderer.info.render.calls;ts+=renderer.info.render.triangles;elapsed+=raw;frames++;if(elapsed>=.7){fps=frames/elapsed;calls=Math.round(cs/frames);triangles=Math.round(ts/frames);frames=0;elapsed=0;cs=0;ts=0;if(debug)$('stats').textContent=`${fps.toFixed(0)} FPS · ${gpu.mean('journey')?.toFixed(1)||'—'} GPU ms · ${calls} draws · ${Math.round(triangles/1000)}k tri · ${route.distance.toFixed(0)}/${route.length.toFixed(0)}m · Chunks ${[...city.loaded.keys()].join(',')}`;}
  if(shot){shot=false;const name='journey-'+Math.round(route.distance)+'-'+Date.now();save(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),name+'.json');canvas.toBlob(b=>{if(b)save(b,name+'.png');});}
 }
 requestAnimationFrame(frame);window.addEventListener('pagehide',()=>{disposed=true;passenger.input.dispose();city.dispose();scenery.dispose();environment.dispose();water.dispose();planar.dispose();pipeline.dispose();gpu.dispose();renderer.dispose();},{once:true});
}
boot().catch(error=>{$('error').hidden=false;$('error').textContent=String(error);console.error(error);});
