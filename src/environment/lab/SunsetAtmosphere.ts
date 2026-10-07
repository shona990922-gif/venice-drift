/** Photographic sunset calibration of the existing atmosphere model.
 * Preserve the upstream noise, cloud genera, lighting and animation. Changes
 * act in the sky's authored display space, before its scene-linear conversion;
 * the same cubemap lights the city and is reflected by the water.
 */
export function sunsetAtmosphere(source: string) {
  const replace = (from: string, to: string) => {
    if (!source.includes(from))
      throw Error("Sunset atmosphere seam changed: " + from);
    source = source.replace(from, to);
  };
  replace(
    "vec3 warm = vec3(1.0, 0.47, 0.22);",
    "vec3 warm = vec3(1.28, 0.52, 0.18);",
  );
  replace(
    "vec3 mauve = vec3(0.45, 0.28, 0.45);",
    "vec3 mauve = vec3(0.46, 0.36, 0.65);",
  );
  replace(
    "smoothstep(0.55, 0.0, h) * 0.55 * sunSide",
    "smoothstep(0.40, 0.0, h) * 0.84 * sunSide",
  );
  replace(
    "smoothstep(0.10, 0.50, h) * 0.35",
    "smoothstep(0.06, 0.40, h) * 0.44",
  );
  replace(
    "sky = mix(sky, vec3(SUN_LUM), core * sunVis);",
    "sky = mix(sky, SUN_LUM * mix(vec3(1.0), vec3(1.0, 0.27, 0.045), sunsetF), core * sunVis);",
  );
  replace(
    "sky += sunCol * halo * 0.22 * sunVis * HALO_LUM;",
    "sky += sunCol * halo * (0.22 + 0.10 * sunsetF) * sunVis * HALO_LUM;",
  );
  replace(
    "vec3 cloudSun = mix(vec3(1.05, 1.0, 0.95), vec3(1.1, 0.55, 0.3), sunsetF);",
    `vec3 eveningCloudSun = mix(vec3(1.20, 0.43, 0.36), vec3(1.42, 0.68, 0.23),
      exp(-h * 5.0) * sunSide);
    vec3 cloudSun = mix(vec3(1.05, 1.0, 0.95), eveningCloudSun, sunsetF);`,
  );
  replace(
    "c += flash * vec3(0.75, 0.8, 1.0) * (0.35 + den * 0.65);",
    `// Cool undersides and sunlit peach edges retain cloud volume at dusk.
    float evening = sunsetF * (1.0 - diffuse) * (1.0 - gloom);
    vec3 duskShade = vec3(0.39, 0.36, 0.53);
    float facing = clamp(0.60 + litE * 0.60 + rim * 0.18 - thick * 0.16, 0.0, 1.0);
    vec3 duskCloud = mix(duskShade, cloudSun, facing);
    c = mix(c, duskCloud, evening);
    c += flash * vec3(0.75, 0.8, 1.0) * (0.35 + den * 0.65);`,
  );
  replace(
    "ALT_MID * 2.2, u_windOff * 0.6",
    "ALT_MID * mix(2.2, 4.6, sunsetF), u_windOff * 0.6",
  );
  replace(
    "0.80, 0.85, 0.35, ldir",
    "mix(0.80,0.65,sunsetF), mix(0.85,0.58,sunsetF), 0.35, ldir",
  );
  return source;
}
