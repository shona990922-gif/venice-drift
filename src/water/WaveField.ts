// Small analytic waves, not an ocean displacement spectrum.
// The same long waves are sampled by the hull and evaluated by the shader.
export const LONG_WAVES = [
  { a: 0.012, kx: 0.48, kz: 0.31, speed: 0.72 },
  { a: 0.007, kx: -0.74, kz: 0.56, speed: 1.04 },
  { a: 0.004, kx: 1.23, kz: 0.88, speed: 1.37 },
];
export function waveHeight(x: number, z: number, t: number) {
  return LONG_WAVES.reduce((h, w) => h + w.a * Math.sin(x * w.kx + z * w.kz - t * w.speed), 0);
}
export function sampleHull(x: number, z: number, yaw: number, t: number) {
  const sx = Math.sin(yaw), cz = Math.cos(yaw);
  const front = waveHeight(x - sx * 3, z - cz * 3, t);
  const back = waveHeight(x + sx * 3, z + cz * 3, t);
  const right = waveHeight(x + cz * 0.65, z - sx * 0.65, t);
  const left = waveHeight(x - cz * 0.65, z + sx * 0.65, t);
  return {
    heave: (front + back + right + left) * 0.25,
    pitch: Math.atan2(front - back, 6),
    roll: Math.atan2(right - left, 1.3),
  };
}
export const longWaveGLSL = LONG_WAVES.map(w =>
  `grad += vec2(${w.kx.toFixed(3)},${w.kz.toFixed(3)}) * ${w.a.toFixed(4)} * cos(dot(p,vec2(${w.kx.toFixed(3)},${w.kz.toFixed(3)}))-uTime*${w.speed.toFixed(3)});`
).join('\n');
