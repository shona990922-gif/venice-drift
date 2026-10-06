import './style.css';
import { ArrowHelper, Scene, Vector3 } from 'three';
import { createRenderer } from './core/renderer';
import { QualityController, type QualityMode } from './core/quality';
import { RouteController, ROUTE, shortestDistance } from './journey/RouteController';
import { BoatController } from './journey/BoatController';
import { BoatFloatController } from './journey/BoatFloatController';
import { PassengerCamera } from './journey/PassengerCamera';
import { PlanarReflection } from './water/PlanarReflection';
import { CanalWater } from './water/CanalWater';
import { SkySystem } from './environment/SkySystem';
import { WhiteboxScene } from './city/WhiteboxScene';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const params=new URLSearchParams(location.search);
const mobile=matchMedia('(pointer: coarse)').matches;
async function main(){
  const canvas=$<HTMLCanvasElement>('scene'),renderer=createRenderer(canvas),scene=new Scene();
  const route=new RouteController(),boat=new BoatController(),float=new BoatFloatController();
  boat.update(route);scene.add(boat.root);
  const passenger=new PassengerCamera(boat.root,canvas);
  const environment=new SkySystem(scene,renderer);
  const reflection=new PlanarReflection(renderer,mobile?512:1024);
  const water=new CanalWater(route,reflection,environment.direction);scene.add(water.mesh);
  const city=new WhiteboxScene(route);scene.add(city.root);
  const quality=new QualityController(renderer,reflection,environment.sun,mobile);
  const requested=params.get('quality') as QualityMode;
  if(['auto','high','medium','low'].includes(requested))quality.setMode(requested);
  const tangentArrow=new ArrowHelper(route.tangent,route.position.clone().setY(.4),4,'#f1c271');scene.add(tangentArrow);tangentArrow.visible=false;
  const eye=new Vector3();let started=false,paused=false,debug=params.has('debug'),time=0,last=performance.now();
  let statElapsed=0,statFrames=0,fps=0,frameMs=0,calls=0,triangles=0,drawSum=0,triSum=0;
  let disposed=false;
  const resize=()=>{passenger.resize(innerWidth,innerHeight);quality.apply();reflection.invalidate();};
  window.addEventListener('resize',resize);resize();
  const toast=(message:string)=>{$('toast').textContent=message;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),2500);};
  if(mobile){$('entry-hint').textContent='单指拖动，自由环视';$('ride-hint').textContent='Swipe to look around';}
  const start=()=>{
    if(started)return;started=true;passenger.input.enabled=true;document.body.classList.add('started');
    $('journey-hint').classList.add('visible');setTimeout(()=>$('journey-hint').classList.remove('visible'),3300);
    canvas.focus({preventScroll:true});last=performance.now();if(debug)$('debug').hidden=false;
  };
  const setDebug=(on:boolean)=>{debug=on;$('debug').hidden=!on||!started;if(!on){city.routeLine.visible=false;tangentArrow.visible=false;$<HTMLInputElement>('route-toggle').checked=false;}};
  $('start-journey').addEventListener('click',start);
  $('open-debug').addEventListener('click',()=>{setDebug(true);start();});
  $('close-debug').addEventListener('click',()=>setDebug(false));
  window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='d'&&!e.metaKey&&!e.ctrlKey)setDebug(!debug);if(e.key==='Escape')$('quality-menu').hidden=true;});
  $('route-toggle').addEventListener('change',()=>{city.routeLine.visible=$<HTMLInputElement>('route-toggle').checked;tangentArrow.visible=city.routeLine.visible;});
  const seek=(distance:number)=>{route.seek(distance);boat.update(route);passenger.resetHeading(route.yaw);passenger.update(.016,route.yaw);reflection.invalidate();};
  $('jump-bridge').addEventListener('click',()=>{start();seek(ROUTE.bridgeDistance-9);toast('已定位桥前 · 将自动连续穿过');});
  $('restart').addEventListener('click',()=>{seek(0);toast('已返回航线起点');});
  $('quality-toggle').addEventListener('click',()=>{const menu=$('quality-menu');menu.hidden=!menu.hidden;$('quality-toggle').setAttribute('aria-expanded',String(!menu.hidden));});
  document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(button=>button.addEventListener('click',()=>{quality.setMode(button.dataset.quality as QualityMode);$('quality-menu').hidden=true;$('quality-toggle').setAttribute('aria-expanded','false');syncQuality();}));
  document.addEventListener('pointerdown',e=>{if(!(e.target as HTMLElement).closest('.quality-control')){$('quality-menu').hidden=true;$('quality-toggle').setAttribute('aria-expanded','false');}});
  const syncQuality=()=>{$('quality-label').textContent={auto:'Auto',high:'High',medium:'Medium',low:'Low'}[quality.mode];document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(b=>b.classList.toggle('active',b.dataset.quality===quality.mode));};syncQuality();
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('此浏览器不支持页面全屏');}catch{toast('此浏览器暂时无法进入全屏');}});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');resize();});
  const snapshot=()=>{
    passenger.camera.getWorldPosition(eye);
    return {started,paused,webgl2:renderer.capabilities.isWebGL2,elapsed:time,distance:route.distance,totalDistance:route.totalDistance,routeLength:route.length,speed:route.speed,
      boatPosition:boat.root.position.toArray(),boatYaw:route.yaw,cameraPosition:eye.toArray(),cameraWorldQuaternion:passenger.camera.getWorldQuaternion(boat.root.quaternion.clone()).toArray(),
      lookYaw:passenger.input.yaw,lookPitch:passenger.input.pitch,targetYaw:passenger.input.targetYaw,targetPitch:passenger.input.targetPitch,lastPointerType:passenger.input.lastPointerType,
      heave:float.heave,roll:float.roll,pitch:float.pitch,bridgeDistance:shortestDistance(route.distance,ROUTE.bridgeDistance,route.length),
      fps,frameMs,drawCalls:calls,triangles,textureCount:renderer.info.memory.textures,geometryCount:renderer.info.memory.geometries,reflectionResolution:reflection.target.width,reflectionUpdates:reflection.updates,reflectionInterval:reflection.interval,
      quality:quality.mode,qualityTier:quality.tier,pixelRatio:renderer.getPixelRatio(),currentChunk:'Canal_'+('ABCD'[Math.min(3,Math.floor(route.distance/route.length*4))]),loadedChunks:city.chunks.map(c=>c.name),
    };
  };
  if(params.has('debug')||import.meta.env.DEV){
    Object.assign(window,{__VENICE_DEBUG__:{snapshot,start,seek,pause:(value:boolean)=>{paused=value;},look:(yaw:number,pitch:number)=>{passenger.input.targetYaw=yaw;passenger.input.targetPitch=Math.max(-1.22,Math.min(1.32,pitch));},scene,route,boat,passenger,water,reflection,city,renderer,quality}});
  }
  const updateDebug=()=>{
    const s=snapshot();$('stat-fps').textContent=fps.toFixed(0);$('stat-calls').textContent=calls.toFixed(0);$('stat-triangles').textContent=(triangles/1000).toFixed(1)+'k';
    const v=(a:number[])=>a.map(n=>n.toFixed(1)).join(', ');
    const rows=[['航速',s.speed.toFixed(2)+' m/s'],['航程',s.distance.toFixed(1)+' / '+s.routeLength.toFixed(1)+' m'],['反射',s.reflectionResolution+'² · 每 '+s.reflectionInterval+' 帧'],['画质 / 像素比',s.quality+' / '+s.pixelRatio.toFixed(2)],['帧耗时',frameMs.toFixed(2)+' ms'],['纹理数 / 反射缓冲估算',s.textureCount+' / '+(s.reflectionResolution**2*12/1048576).toFixed(1)+' MiB'],['当前 / 已驻留 Chunk',s.currentChunk+' / 4'],['相机 XYZ',v(s.cameraPosition)],['船体 XYZ',v(s.boatPosition)],['浮动 / 侧倾', (float.heave*100).toFixed(1)+' cm / '+(float.roll*180/Math.PI).toFixed(2)+'°'],['输入',s.lastPointerType==='none'?'等待拖动':s.lastPointerType]];
    $('debug-details').innerHTML=rows.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  };
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('error-message').textContent='图形上下文已中断。请重新加载以恢复漫游。';$('error').hidden=false;});
  document.addEventListener('visibilitychange',()=>{last=performance.now();statElapsed=0;statFrames=0;drawSum=0;triSum=0;});
  environment.update(route.position,0);passenger.update(.016,route.yaw);water.update(0,route.position,route.tangent);
  scene.updateMatrixWorld(true);
  await renderer.compileAsync(scene,passenger.camera);
  renderer.render(scene,passenger.camera);reflection.render(scene,passenger.camera);
  $<HTMLButtonElement>('start-journey').disabled=false;$('loading').classList.add('done');setTimeout(()=>$('loading').remove(),1100);setDebug(debug);
  if(params.has('autostart'))start();
  function frame(now:number){
    if(disposed)return;
    requestAnimationFrame(frame);
    const raw=(now-last)/1000;last=now;if(document.hidden)return;
    const dt=Math.min(Math.max(raw,0),.05);time+=dt;
    if(started&&!paused)route.update(dt);
    boat.update(route);float.update(dt,time,boat.root,boat.visual,passenger.passenger);passenger.update(dt,route.yaw);
    environment.update(route.position,time);water.update(time,route.position,route.tangent);
    tangentArrow.position.copy(route.position).setY(.4);tangentArrow.setDirection(route.tangent);
    scene.updateMatrixWorld(true);
    renderer.info.reset();reflection.render(scene,passenger.camera);renderer.render(scene,passenger.camera);
    drawSum+=renderer.info.render.calls;triSum+=renderer.info.render.triangles;statElapsed+=raw;statFrames++;
    if(statElapsed>=.5){fps=statFrames/statElapsed;frameMs=statElapsed*1000/statFrames;calls=Math.round(drawSum/statFrames);triangles=Math.round(triSum/statFrames);statElapsed=0;statFrames=0;drawSum=0;triSum=0;if(debug)updateDebug();}
    if(started&&time>4)quality.observe(raw*1000,now);
  }
  last=performance.now();requestAnimationFrame(frame);
  window.addEventListener('pagehide',()=>{disposed=true;passenger.input.dispose();reflection.dispose();environment.environment.dispose();scene.traverse(o=>{if('geometry'in o)(o.geometry as {dispose:()=>void}).dispose();});renderer.dispose();},{once:true});
}
main().catch(error=>{console.error(error);$('error-message').textContent=error instanceof Error?error.message:String(error);$('error').hidden=false;});
