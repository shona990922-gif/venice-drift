import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
/** Static modules are merged by material, preserving real-world texel density. */
export class GeometryBatch {
  private batches = new Map<MeshStandardMaterial, BufferGeometry[]>();
  readonly transform = new Matrix4();
  constructor(
    readonly parent: Group,
    readonly reflect = true,
  ) {}
  add(
    g: BufferGeometry,
    m: MeshStandardMaterial,
    position = new Vector3(),
    rotation = new Euler(),
    scale = new Vector3(1, 1, 1),
    tile = 3.2,
  ) {
    g.applyMatrix4(
      new Matrix4().compose(
        position,
        new Quaternion().setFromEuler(rotation),
        scale,
      ),
    );
    const p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      uv = g.getAttribute("uv");
    if (uv)
      for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(n.getX(i)),
          ny = Math.abs(n.getY(i)),
          nz = Math.abs(n.getZ(i));
        uv.setXY(
          i,
          (nx > nz && nx > ny ? p.getZ(i) : p.getX(i)) / tile,
          (ny > nx && ny > nz ? p.getZ(i) : p.getY(i)) / tile,
        );
      }
    g.applyMatrix4(this.transform);
    const list = this.batches.get(m) ?? [];
    list.push(g);
    this.batches.set(m, list);
    return g;
  }
  box(
    m: MeshStandardMaterial,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    rotation = new Euler(),
    tile = 3.2,
  ) {
    return this.add(
      new BoxGeometry(w, h, d),
      m,
      new Vector3(x, y, z),
      rotation,
      undefined,
      tile,
    );
  }
  cylinder(
    m: MeshStandardMaterial,
    top: number,
    bottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    segments = 10,
    rotation = new Euler(),
  ) {
    return this.add(
      new CylinderGeometry(top, bottom, height, segments),
      m,
      new Vector3(x, y, z),
      rotation,
    );
  }
  flush(name: string) {
    const meshes: Mesh[] = [];
    for (const [material, gs] of this.batches) {
      // Extrusions are non-indexed, primitives indexed. Normalize before merging.
      const normalized = gs.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(normalized);
      gs.forEach((g) => g.dispose());
      normalized.forEach((g) => g.dispose());
      if (!merged) throw Error("Incompatible modular geometry");
      const mesh = new Mesh(merged, material);
      mesh.name = `${name} / ${material.name || material.color.getHexString()}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (this.reflect) mesh.layers.enable(1);
      this.parent.add(mesh);
      meshes.push(mesh);
    }
    this.batches.clear();
    return meshes;
  }
}
