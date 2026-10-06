import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
await mkdir(".build", { recursive: true });
await mkdir("public/assets/city", { recursive: true });
await build({
  entryPoints: ["src/city/JourneyLayout.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: ".build/city.mjs",
});
await build({
  entryPoints: ["src/journey/RouteController.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: ".build/route.mjs",
});
const { bakeKit, buildChunk, CHUNK_LENGTH } = await import(
  pathToFileURL(process.cwd() + "/.build/city.mjs")
);
const { RouteController } = await import(
  pathToFileURL(process.cwd() + "/.build/route.mjs")
);
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((v) => {
      this.result = v;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((v) => {
      this.result =
        "data:" + blob.type + ";base64," + Buffer.from(v).toString("base64");
      this.onloadend?.();
    });
  }
};
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const route = new RouteController(),
  kit = bakeKit(),
  records = [];
for (let i = 0; i < Math.ceil(route.length / CHUNK_LENGTH); i++) {
  const group = buildChunk(i, route, kit);
  group.traverse((o) => {
    if (o.material) {
      for (const k of ["map", "normalMap", "aoMap", "roughnessMap"])
        o.material[k] = null;
    }
  });
  const raw = await new GLTFExporter().parseAsync(group, {
    binary: true,
    onlyVisible: false,
  });
  const document = await io.readBinary(new Uint8Array(raw));
  await document.transform(
    dedup(),
    weld(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  const result = await io.writeBinary(document),
    file = `canal-${String(i).padStart(2, "0")}.glb`;
  await writeFile("public/assets/city/" + file, result);
  let triangles = 0;
  group.traverse((o) => {
    if (o.geometry) {
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      o.geometry.dispose();
    }
  });
  records.push({
    index: i,
    file,
    start: i * CHUNK_LENGTH,
    end: Math.min(route.length, (i + 1) * CHUNK_LENGTH),
    bytes: result.length,
    triangles,
  });
  console.log(file, result.length, triangles);
}
await writeFile(
  "public/assets/city/manifest.json",
  JSON.stringify(
    {
      version: 3,
      length: route.length,
      chunkLength: CHUNK_LENGTH,
      chunks: records,
    },
    null,
    2,
  ),
);
