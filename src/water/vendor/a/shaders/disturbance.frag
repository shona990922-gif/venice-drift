uniform sampler2D uHeightMap;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uStrength;

varying vec2 vUv;

void main() {
  vec2 data = texture2D(uHeightMap, vUv).rg;
  float dist = distance(vUv, uCenter);
  float stamp = exp(-pow(dist / max(uRadius, 1e-4), 2.0)) * uStrength;
  float height = data.r - stamp;
  // Lab integration: displace both height states to match B's zero-velocity height stamp.
  gl_FragColor = vec4(height, data.g - stamp, 0.0, 1.0);
}
