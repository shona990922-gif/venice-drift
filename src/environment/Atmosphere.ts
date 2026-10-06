/** Canal sunset extension to the vendored shared atmosphere. The upstream
 * daylight function and all optical water equations remain unchanged. */
export function canalAtmosphere(shader: string) {
  return shader
    .replace(
      "col += sunTint * disk * 14.0;",
      "col += sunTint * disk * mix(14.,5.5,evening);",
    )
    .replace(
      "vec3 col = mix(zenith, horizon, h);",
      `float evening=1.-smoothstep(.12,.44,sunElev);
    zenith=mix(zenith,vec3(.075,.13,.32),evening*.75);
    horizon=mix(horizon,mix(vec3(.40,.32,.48),vec3(1.05,.48,.21),pow(sunAmt,.7)),evening*.78);
    vec3 col = mix(zenith, horizon, h);
    float roseBand=exp(-pow((up-.22)/.18,2.))*evening;
    col=mix(col,vec3(.58,.31,.42),roseBand*.32*(1.-pow(sunAmt,16.)));`,
    )
    .replace(
      "vec3 cloudCol  = mix(cloudDark, vec3(1.12, 1.08, 1.02), shade);",
      `cloudDark=mix(cloudDark,vec3(.25,.24,.34),evening);
    vec3 cloudTop=mix(vec3(1.12,1.08,1.02),vec3(1.16,.69,.57),evening);
    vec3 cloudCol=mix(cloudDark,cloudTop,shade);`,
    )
    .replace(
      "vec3 cirCol = mix(vec3(0.98, 1.0, 1.06), vec3(1.15, 0.88, 0.68), (1.0 - sunElev) * 0.75);",
      "vec3 cirCol = mix(vec3(.98,1.,1.06),vec3(1.04,.65,.65),evening*.88);",
    );
}
