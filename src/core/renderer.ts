import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
export function createRenderer(canvas:HTMLCanvasElement){
  const context=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});
  if(!context)throw new Error('此设备未能启用 WebGL2。请使用支持 WebGL2 的 Chrome、Edge 或 Safari，并开启硬件加速。');
  const renderer=new WebGLRenderer({canvas,context,antialias:true,alpha:false});
  renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;
  renderer.toneMappingExposure=.78;renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFSoftShadowMap;
  renderer.info.autoReset=false;
  return renderer;
}
