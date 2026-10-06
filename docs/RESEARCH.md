# Venice Drift — research record, ROUND 01–02.5

Research date: 2026-10-06. Implementation scope: a whitebox technical ride, not completed Venice art. References are studied before integration; algorithm experiments and screenshots remain in the task's `work/research` directory. No Sakura River Valley source or art is copied.

## Primary experience reference

[Sakura River Valley](https://valley.mengto.here.now/) is the primary product benchmark. Opened in real Chrome/WebGL, allowed to travel continuously, dragged horizontally and vertically, and observed after release. Foreground boat, midground bridge, and background pagoda create a readable progression. Reflections move with the scene and ripples break up their edges. The observed default camera is elevated behind the boat. Venice Drift retains the requested seated 1.34 m eye height, while adopting continuous travel, persistent user look offsets, heading inertia and a bridge as the visual event. No weather controls were visible in this visit; interactive weather switching is not claimed verified. Clear Day only in ROUND 01.

## Code actually read and executed

### Planar water

Repository: https://github.com/m2-md/screen-space-reflections-water-plane

Commit: `6c36a6385d34511052692452fd201f26a204fc16`.

Read `src/mirrorCamera.ts`, `src/oblique.ts`, `src/pipeline.ts`, `src/shaders/planarWater.frag.glsl`, `src/shaders/lib/wave.glsl`. Ran original Vite demo locally, switched to Planar, observed dynamic reflections with no browser errors. On this demo: ~60 FPS, 16 calls, 3,847 triangles, at its default low backbuffer resolution. These are reference-demo metrics, not Venice Drift performance.

Adapted mirror pose construction and Lengyel oblique projection with MIT attribution retained. Mirror points use y → 2h − y; directions use y → −y. Reflecting the view matrix with a negative determinant would reverse winding, so the camera is rebuilt from reflected position, target and up. A projective texture matrix includes view and projection; it must remain paired with the texture if reflection updates are skipped. All actual scene geometry above water can reflect even if outside the passenger camera frustum. Below-water geometry is clipped. Use Schlick Fresnel, small analytic derivatives, canal-aligned flow and shadow reception, not the source demo's flat shading.

Original mathematical tests: 101/102 passed; the exhaustive wave-bound test exceeded its 5 s timeout while the heavy external reference was running. No mathematical assertion failed. Do not report this run as all-passing.

### Path export and sampling

Repository: https://github.com/ClassOutside/ThreeJS_Camera_Follow_Path

Commit: `71af6daf7d6460d003efa9efb46a309bf4d7e9fe`.

Read `src/curveTools/CurveMethods.js`, `src/helpers/JSONHelper.js`, `src/positionAlongPathTools/PositionAlongPathMethods.js`, `PositionAlongPathState.js`, and `src/views/mainView.js`. The repository does not include its expected `scene.gltf` and `curvePath.json`; its complete scene cannot run unchanged. Executed the original movement module in a local visual harness with an explicit synthetic test curve and mouse-wheel input. Camera position changed from [0,3,14] to [2.83,3,12.96] without browser errors.

Do not copy unlicensed source. Implement independently: cumulative distance / actual curve length → getPointAt; getTangentAt → boat yaw. The reference scroll tween and direct camera lookAt are deliberately not used. Export workflow: Blender curve → sampled ordered mesh vertices → JSON. Apply Blender Z-up to Three Y-up conversion once, preserve metres, validate order/closed flag; do not inherit the example's every-third-element sampling blindly.

### Automatic tour and gesture separation

Repository: https://github.com/jstrait/city-tour

Commit: `b1fa4701b424c3b1b47757c29c2e3df7b5709964`.

Read `src/flythrough/curve_animation.js`, `vehicle_view.js`, `src/app/flythrough_gesture_processor.js`. Ran https://www.joelstrait.com/citytour/ and clicked Take a Tour; button became Stop Tour, moving scene rendered without browser errors. CurveAnimation derives normalized movement from curve length and extracts tangent orientation. VehicleView separates view offsets from vehicle motion. Its release-to-centre behavior conflicts with this project; no automatic recentering is retained. Do not copy the city generator or its visuals.

### Hull float, input and adaptive budgets

Repository: https://github.com/bob6664569/open-water

Commit metadata: `285b6ce32057c70191a7fe16c31d979fa383ac64`.

Read `site/js/simulation/boat.js`, `waves.js`, `controllers/view-input-controller.js`, `controllers/vessel-controller.js`, `runtime/performance.js`, `runtime/quality-controller.js`, `rendering/ocean.js`. The large media checkout stalled; source was retrieved separately. Ran the original WaveField in the path harness: update + heightAt produced time-varying sampled height. This is a module experiment, not a claim that the full powerboat demo was verified.

Boat source samples buoyancy points and applies relative normal damping. Our calm gondola uses four height samples, centimetre-scale waves and exponential damping, with path and float kept separate. Full rigid-body powerboat dynamics are inappropriate. Study input pointer ownership/cancel handling and adaptive hysteresis. Our low tier must preserve a live 256² reflection; do not carry over the reference's reflectionHz=0 behavior. No boat, sound or animal media copied.

### Official Three.js water and sky

Installed Three.js `0.185.1`. Read `examples/jsm/objects/Water.js` (projective reflection, Fresnel, shadow chunks, output colour conversion) and `Sky.js` (Preetham atmosphere and sun direction). Ran https://threejs.org/examples/webgl_shaders_sky.html without browser errors. Use imported official Sky + PMREM + DirectionalLight in the WebGL2 renderer; no ocean-scale displacement and no bloom.

## Inspected but intentionally deferred

- https://github.com/tordanik/OSM2World — inspected `core/.../building/BuildingModule.java` and `output/gltf/GltfOutput.java` at tree `8ec26a9...`. Building tags/map multipolygons become geometry; exporter deduplicates vertices/materials and writes glTF/GLB with quantization support. OSM import, georeferencing, Blender cleanup and real Venice footprints belong to ROUND 02. No imported OSM data in this whitebox; route is explicitly synthetic. No OSM2World demo claim.
- https://github.com/pmndrs/sky — inspected `src/Sky.ts` at `0ecf926...`: three/webgpu + TSL, atmosphere LUT baking, PMREM, solar coordinates and fog/haze integration. WebGPU-only enhancement research; not imported into the WebGL2 build, not demo-verified.
- https://github.com/NASA-AMMOS/3DTilesRendererJS — inspected `TilesRendererBase.js` at `b003e26...`: screen error target, prioritized download/parse queues, LRU eviction and disposal. Streaming PoC only, not imported or demo-verified in ROUND 01.
- https://github.com/deathraygames/three-js-boat-prototype — inspected `src/Boat.js` at `69aa1c7...`. Its throttle/game physics and position-added bob are unsuitable. Supplemental only; no copied code, no demo claim.

## Phase boundary

ROUND 01 uses intentional neutral architectural volumes and an authored gondola silhouette study. No photorealistic asset claim, no downloaded gondola GLB, no PBR facade maps, no surveyed urban geometry, no production scene streaming/LOD, no sound, no weather/day-night cycle. These are gated behind acceptance of route, look, bridge clearance and planar water.

## ROUND 02 — Hero Canal (subsequent accepted visual state)

Only the first 125 m of the existing spline is active, with a short terminal fade; no expanded map. Replaced whiteboxes with twelve individually specified façades. Wall bays have actual recessed windows/door openings; kits provide rectangular, round and gothic arches, shutters with different angles, balconies, ironwork, roof edges, pipes, lamps and sparse plants. Geometry is batched per material/chunk, with near details culled beyond 79 m. The stone bridge has an open solid arch and adequate passenger/boat clearance. These are authored modules, not surveyed Venice geometry or OSM imports.

PBR inputs: Poly Haven plastered_wall_04 (2K), white_sandstone_blocks_02, medieval_red_brick, clay_roof_tiles_02, dark_wooden_planks (1K); diffuse, normal and ARM channels. HDRI: kloofendal_48d_partly_cloudy_puresky (2K). Exact URLs, hashes and sizes in public/licenses/materials.json. [Poly Haven CC0 policy](https://polyhaven.com/license) verified. Waterline moisture changes colour and roughness. Sky uses HDRLoader and PMREM rather than the ROUND 01 analytic Sky. Side lighting, ACES exposure .9, no postprocess bloom. Real Three.js rendering checked from boat, under bridge, backward and in touch emulation.

The official Water.js / Water2.js multi-scale moving normal samples and Sky.js noise construction were inspected before making the low-amplitude two-scale differentiable-noise water normals. Existing mirror-camera implementation is unchanged. ROUND 02 images/metrics remain in round02-evidence as historical evidence.

## ROUND 02.5 — Local boat–water interaction

Read and executed original [Open Water WakeField](https://github.com/bob6664569/open-water/blob/285b6ce32057c70191a7fe16c31d979fa383ac64/site/js/simulation/wake-field.js) at the same pinned commit; also read rendering/ocean.js, especially bow pressure, troughs, paired Gaussian wake derivatives and normal response (lines 422–547). Original isolated module experiment over 600 frames: no active sources at 1.55 m/s because the reference threshold is 1.8 m/s; 36 active sources at 3 m/s; zero after another 23.33 s stopped. This is a source-module execution, not full-media demo verification. Its speed and ocean amplitudes are unsuitable for the gondola.

Adaptation: newly implemented BoatWaterInteraction keeps fixed world-space stern samples every .24 m, spreads paired wavelets at .28 m/s, decays over 10 s and rasterizes signed X/Z gradients plus a roughness mask into one 256² RGBA8 texture. Source history stays fixed through a turn; debug seek/loop reset clears it. Bow pressure/soft arcs and 20 cm tapered hull-edge noise are evaluated analytically in the existing water fragment shader. All three contributions affect the reflection sampling coordinates explicitly, the lighting normal, and a small local reflection softening. No white tint, foam, particle draw or displacement pass is added. PlanarReflection.ts, water body colours, baseline wave field, city, route and camera remain unchanged in this round.

Inspected Three.js 0.185.1 Water2.js flow/normal/Fresnel/projective reflection code and GPUComputationRenderer.js before selecting the simpler bounded CPU mask. This avoids extra render passes and a full fluid simulation; one 256 KiB GPU texture is uploaded about 30 times/s. The source-field gradient is capped at .20, with typical measured peak near .10; those slopes do not displace the surface geometry. Wake lifetime, spread, width, emission density and normal/reflection strength are separately tunable in BoatWaterInteraction.ts / CanalWater.ts.

Verification: unit checks for world-space retention, 30/60 Hz emission, low-speed generation, locality, lifetime and reset. Browser checks render precisely the same time/pose twice with interaction off/on, read actual colour buffers, and confirm changed water pixels with the sky/buildings unchanged. Desktop High and mobile-touch Low are measured separately without video encoding running. Actual journey recording shows automatic travel and deliberate bow/side/back look gestures. Physical phone performance is not inferred from Mac browser touch emulation.
