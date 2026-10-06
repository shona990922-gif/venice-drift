export type ReflectionMode='ssr'|'planar'|'hybrid';
export type WaterQuality='high'|'medium'|'low';
export const WATER_QUALITY={
 high:{segments:.25,simulation:512,simulationHz:60,reflection:1024,captureScale:1,ssrSteps:32,detailOctaves:6,pixelRatio:1.25},
 medium:{segments:.34,simulation:256,simulationHz:30,reflection:512,captureScale:.8,ssrSteps:24,detailOctaves:4,pixelRatio:1},
 low:{segments:.48,simulation:128,simulationHz:30,reflection:256,captureScale:.55,ssrSteps:12,detailOctaves:4,pixelRatio:.85},
} as const;
export const CANAL_DEFAULTS={
 amplitude:.072,choppiness:.10,waveCount:26,speed:.65,directionSpread:.95,swellLength:150,
 rippleDetail:.14,rippleScale:.30,refraction:.028,ssr:.85,glitter:.18,roughness:.08,
 clarity:.65,depthFalloff:.30,absorptionRed:.45,absorptionGreen:.16,absorptionBlue:.10,
 maxOpticalDepth:18,ssrStep:.35,ssrThickness:.55,shadowAmbient:.38,
 bow:1,side:1,stern:1,wakeLifetime:10,interaction:1,
 exposure:1.05,saturation:1.0,sunElevation:58,sunAzimuth:148,
};
export type CanalSettings=typeof CANAL_DEFAULTS;
export const VENICE_PRESETS={
 VENICE_CANAL_DAY:{...CANAL_DEFAULTS},
 VENICE_CANAL_GOLDEN:{...CANAL_DEFAULTS,sunElevation:9,sunAzimuth:80,glitter:.24},
 VENICE_CANAL_SUNSET:{...CANAL_DEFAULTS,sunElevation:3.5,sunAzimuth:80,glitter:.28},
};
export type CanalPreset=keyof typeof VENICE_PRESETS;
