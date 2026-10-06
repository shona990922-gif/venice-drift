import { BufferGeometry, Material, Mesh, Object3D, Texture } from "three";
/** Final teardown only. Streamed chunk geometries are disposed by their owner. */
export function disposeSceneAssets(root: Object3D) {
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<Material>(),
    textures = new Set<Texture>();
  root.traverse((o) => {
    if (o instanceof Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  for (const m of materials) {
    for (const v of Object.values(m)) if (v instanceof Texture) textures.add(v);
    m.dispose();
  }
  for (const g of geometries) g.dispose();
  for (const t of textures) t.dispose();
}
