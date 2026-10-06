import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, Vector2 } from 'three';
export type Surface = 'plaster'|'stone'|'brick'|'roof'|'wood';
export type PBRSet = Record<Surface,{color:Texture;normal:Texture;arm:Texture}>;
export async function loadMaterials():Promise<PBRSet>{
 const loader=new TextureLoader();const entries=await Promise.all((['plaster','stone','brick','roof','wood'] as Surface[]).map(async name=>{
  const maps=await Promise.all(['color','normal','arm'].map(async type=>{const t=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/textures/${name}-${type}.jpg`);t.wrapS=t.wrapT=RepeatWrapping;t.anisotropy=8;if(type==='color')t.colorSpace=SRGBColorSpace;return t;}));
  return [name,{color:maps[0],normal:maps[1],arm:maps[2]}] as const;
 }));return Object.fromEntries(entries) as PBRSet;
}
const weatherNoise=`
 varying vec3 vWeatherPosition;
 varying float vWeatherNormalY;
 float weatherHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float weatherNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(weatherHash(i),weatherHash(i+vec2(1,0)),f.x),mix(weatherHash(i+vec2(0,1)),weatherHash(i+1.),f.x),f.y);}
 float weatherFbm(vec2 p){return weatherNoise(p)*.57+weatherNoise(p*2.07)*.28+weatherNoise(p*4.13)*.15;}
`;
/** Shared PBR maps; geometry UVs are in real metres. No per-window textures. */
export function pbr(set:PBRSet,surface:Surface,color:string,aged=false){
 const maps=set[surface];const m=new MeshStandardMaterial({color,map:maps.color,normalMap:maps.normal,normalScale:new Vector2(surface==='plaster'?.36:surface==='stone'?.18:.45,surface==='plaster'?.36:surface==='stone'?.18:.45),roughnessMap:maps.arm,roughness:.93,aoMap:maps.arm,aoMapIntensity:.65,metalness:0});
 m.name=`${surface} / ${color}`;
 if(aged){
  m.onBeforeCompile=s=>{
   s.uniforms.uBrick={value:set.brick.color};
   s.vertexShader='varying vec3 vWeatherPosition; varying float vWeatherNormalY;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWeatherPosition=(modelMatrix*vec4(position,1.)).xyz;vWeatherNormalY=normal.y;');
   s.fragmentShader='uniform sampler2D uBrick;\n'+weatherNoise+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec2 weatherUV=vec2(vWeatherPosition.x+vWeatherPosition.z,vWeatherPosition.y);
    float stain=weatherFbm(weatherUV*1.2);
    float wet=1.-smoothstep(.08,.70+stain*.65,vWeatherPosition.y);
    float damp=1.-smoothstep(.7,2.5+stain,vWeatherPosition.y);
    diffuseColor.rgb*=mix(.86,1.13,stain);
    float streaks=weatherFbm(weatherUV*vec2(8.,.38));
    diffuseColor.rgb*=mix(.88,1.02,streaks);
    ${surface==='stone'?`diffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.299,.587,.114))),diffuseColor.rgb,.5)*1.14;diffuseColor.rgb*=mix(.57,1.,smoothstep(-.9,-.2,vWeatherNormalY));`:''}
    ${surface==='plaster'?`float broken=weatherFbm(weatherUV*2.2+13.4);
    float damage=smoothstep(.71,.78,broken+damp*.18);
    vec3 oldBrick=texture2D(uBrick,weatherUV/2.4).rgb;
    diffuseColor.rgb=mix(diffuseColor.rgb,oldBrick*.78,damage);`:''}
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.24,.34,.23),wet*.91);
    diffuseColor.rgb*=1.-damp*.13;
   `);
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.43,wet*.65);');
  };
  m.customProgramCacheKey=()=>`venice-weather-v2-${surface}`;
 }
 return m;
}
