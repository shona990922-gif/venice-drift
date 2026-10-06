# WaterThreeJS module map — actual 5194 source

Historical lab inspection, performed before migration. Current release integration is in `src/water/v2/`; unchanged upstream modules are in `src/water/v2/vendor/waterthreejs/`. Lab source and comparison evidence remain in the separate `water-lab/` project.

Source: `research/achrefelouafi--WaterThreeJS`, commit `4f85f4a557da80a1dd24b9243869177f30c604c7` (MIT). The listening Node process on 5194 has this exact working directory. Source files have been copied verbatim to `src/v2/vendor/waterthreejs`; hashes are recorded in `evidence/waterthreejs-source-manifest.json`. Venice has not been modified during this inspection.

| Module / source location | Actual implementation | Migration treatment |
|---|---|---|
| `Ocean.js:452–467` | 6000 m square, 600 × 600 grid; camera-centred, 10 m snapping | Preserve in source-fidelity page; replace geometry only with the existing canal contour in Venice. |
| `shaders/common.js` / `OCEAN_GERSTNER` | Deterministic 26-wave Gerstner spectrum; displacement, analytic normal and horizontal Jacobian | Direct import, retain the spectrum; reduce amplitude/choppiness through an independent canal preset. |
| `Ocean.js:117–145` | Vertex shader applies `sampleOcean(worldPos.xz)` and passes displaced position, normal, height, view Z | Keep shader; add documented bank-boundary and local-interaction hooks. |
| `Ocean.js:294–315`, `WATER_TINT` | Scene depth → water-column thickness; Beer–Lambert `exp(-ABSORB / clarity * thickness)`; absorbed light is replaced by a depth-dependent body colour | Preserve the actual optical model. It still contains an artistic shallow/deep in-scatter palette; it is not a purely physical spectral solver. Dark canal bed, absorption and visibility are the adaptation controls. |
| `Ocean.js:205–243` / `ssr()` | 32 depth-marched screen-space samples, 2.2 m initial step, accelerating step size, 6 m hit tolerance, screen-edge confidence | First test unchanged. Step/tolerance are ocean-scale and must be exposed for the metre-scale canal. Compare SSR, planar, and justified fallback individually. |
| `main.js:130–148, 558–577` | Half-float scene colour + depth before rendering water; full HDR scene afterwards | Directly preserve the render order; do not feed tone-mapped colour into refraction or SSR. |
| `Ocean.js:291` / `fresnelF()` | Schlick Fresnel, water F0 = 0.02 | Direct inheritance, not fixed reflection weights. |
| `Ocean.js:251–265`, `DETAIL_NORMAL` | Three moving normal cascades × six derivative-noise octaves; fine detail fades with distance | Direct inheritance. Calm geometry does not remove these ripples. |
| `Ocean.js:272–280, 328–338` | Glitter perturbs the reflection normal; GGX sun specular uses roughness and Fresnel | Keep both. Local boat normal must reach SSR, refraction and glints before shading. |
| `Sky.js`, `ATMOSPHERE`, `main.js:167–183` | Sky and water use the same analytic HDR atmosphere function and sun direction | Reuse as an optional matched environment in the lab; preserve the Venice sky option for comparison. |
| `Ocean.js:374–436` | Fold/crest/shore energy plus object capsules → layered FBM white foam | Keep original only in source-fidelity mode; canal foam is disabled. |
| `FloatingBodies.js:67–143`, `main.js:526–545` | CPU Gerstner buoyancy and damping; object position/velocity sent to contact-foam uniforms | **No object-driven heightfield, no propagating water displacement.** Reuse the emitter/velocity interface idea, supplement with the already-tested height/velocity solver. Do not describe foam as physical ripple propagation. |
| `Post.js:182–280, 316–357` | Linear HDR → bloom → exposure → fitted ACES → saturation/contrast → grain/vignette/fringe → exact sRGB encoding | Source-fidelity page retains it. Canal pipeline retains colour management, removes cinematic lens effects and strong bloom. Apply the same final transform to the compared waters. |
| `Clouds.js` | Half-resolution volumetric clouds with temporal accumulation and cloud shadows | Source-reference page only for now; not required for canal water. |

## Actual boot parameters

The GUI says “Tropical Noon”, but `applyPreset()` is not invoked on boot. The actual values observed in the controls and confirmed in source are: sun elevation **22°**, azimuth **108°**; amplitude **0.72 m**, choppiness **0.5**, **26** waves, longest wavelength **150 m**, detail **0.14**, detail scale **0.3**, refraction **0.05**, SSR **0.85**, clarity **1**, depth falloff **0.16**, roughness **0.08**, sun glitter **0**. Post: exposure **1.05**, bloom **0.65**, saturation **1.06**, contrast **1.02**, grain **0.05**, fringe **0.5**, vignette **0.16**.

The renderer uses `NoToneMapping`; the shader emits linear HDR, then `Post` performs tone mapping and sRGB **once**. The current Venice renderer applies Three.js ACES with exposure 0.9. Copying only `Ocean` into that renderer would bypass its intended output transform because the material is `toneMapped:false` and has no colour-space chunk.

## Integration issues established before any Venice edit

1. Source water ignores Three.js scene lights/shadow maps; its only shadow input is clouds. Bridge shadow support must be added explicitly.
2. Gerstner horizontal displacement depends on `Q * amplitude`; reducing amplitude alone does not proportionally reduce horizontal chop. Bank containment must be checked separately.
3. Source `Ocean.update()` reads local camera position. A passenger camera is nested in BoatRoot: integration must use world position without modifying the camera hierarchy.
4. Source depth thickness is an eye-space depth difference, not a complete ray path through refracted geometry. Preserve it for fidelity, document any later correction independently.
5. The source SSR cannot reflect off-screen geometry. The canal comparison will determine whether a planar fallback is necessary; running both unconditionally is not the default.

Source repository: [achrefelouafi/WaterThreeJS](https://github.com/achrefelouafi/WaterThreeJS/tree/4f85f4a557da80a1dd24b9243869177f30c604c7). Full MIT notice accompanies the copied source.
