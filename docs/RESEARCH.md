# Venice Drift — ROUND 01 research record

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
