import {
  Euler,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  Texture,
} from "three";
import { RouteController } from "../journey/RouteController";
import { GeometryBatch } from "./GeometryBatch";
import { VenetianKit, rand, type FacadeSpec } from "./VenetianKit";
import type { PBRSet } from "./Materials";
export const CHUNK_LENGTH = 42;
export const kitMaterials = (kit: VenetianKit) => {
  const map = new Map<string, MeshStandardMaterial>();
  for (const [key, value] of Object.entries(kit)) {
    if (value instanceof MeshStandardMaterial) {
      value.name = "kit:" + key;
      map.set(value.name, value);
    } else if (Array.isArray(value))
      value.forEach((m, i) => {
        if (m instanceof MeshStandardMaterial) {
          m.name = `kit:${key}:${i}`;
          map.set(m.name, m);
        }
      });
  }
  return map;
};
export function bakeKit() {
  const set = Object.fromEntries(
    ["plaster", "stone", "brick", "roof", "wood"].map((n) => [
      n,
      { color: new Texture(), normal: new Texture(), arm: new Texture() },
    ]),
  ) as PBRSet;
  const k = new VenetianKit(set);
  kitMaterials(k);
  return k;
}
const motifs = [
  { type: "house", color: 2, h: 12.5, levels: [1.1, 4.2, 7.4, 10.2] },
  { type: "gothic", color: 4, h: 16.1, levels: [1.3, 5.0, 9, 12.8] },
  { type: "palazzo", color: 0, h: 15.5, levels: [1.5, 5.1, 8.8, 12.1] },
  { type: "house", color: 1, h: 11.2, levels: [1.2, 4.5, 8.1] },
  { type: "palazzo", color: 3, h: 15.9, levels: [1.4, 5.5, 9.5, 13] },
  { type: "house", color: 5, h: 13.3, levels: [1.2, 4.8, 8.2, 10.7] },
] as const;
export function facadeSpecs(chunk: number) {
  const out: FacadeSpec[] = [];
  const widths = [
    [10.4, 14.6, 15.1],
    [15.8, 9.5, 14.7],
    [12.8, 16.2, 11.1],
    [9.8, 13.7, 16.6],
  ];
  for (const side of [-1, 1]) {
    let cursor = chunk * CHUNK_LENGTH;
    const pattern = widths[(chunk + (side === 1 ? 2 : 0)) % widths.length];
    for (let j = 0; j < 3; j++) {
      const width = pattern[j],
        s = cursor + width / 2;
      cursor += width + 0.62;
      if (side === 1 && s > 425) continue;
      const id = chunk * 23 + j * 7 + (side === 1 ? 107 : 3),
        motif = motifs[(chunk * 3 + j + (side === 1 ? 2 : 0)) % motifs.length],
        scale = 0.93 + rand(id + 4) * 0.15;
      const n = width < 11 ? 3 : width > 15 ? 5 : 4,
        span = width * 0.72;
      const columns = Array.from(
        { length: n },
        (_, i) => (i / (n - 1) - 0.5) * span + (i % 2 ? 0.12 : 0),
      );
      out.push({
        name: `${motif.type} ${chunk}-${side}-${j}`,
        s,
        side,
        width,
        height: motif.h * scale,
        color: motif.color,
        floors: motif.levels.map((y) => y * scale),
        columns,
        type: motif.type,
        seed: id,
      });
    }
  }
  return out;
}
export function facadeMatrix(route: RouteController, s: FacadeSpec) {
  const p = route.pointAtDistance(s.s),
    t = route.tangentAtDistance(s.s),
    cross = new Vector3(-t.z, 0, t.x);
  let offset = route.widthAt(s.s) / 2 + 0.48;
  for (let v = -s.width / 2; v <= s.width / 2; v += 0.5) {
    const pp = route.pointAtDistance(s.s + v);
    offset = Math.max(
      offset,
      route.widthAt(s.s + v) / 2 + 0.45 + pp.clone().sub(p).dot(cross) * s.side,
    );
  }
  const normal = cross.clone().multiplyScalar(-s.side),
    pos = p.addScaledVector(cross, s.side * offset);
  return new Matrix4().compose(
    pos,
    new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.atan2(normal.x, normal.z),
    ),
    new Vector3(1, 1, 1),
  );
}
export function buildChunk(
  index: number,
  route: RouteController,
  kit: VenetianKit,
) {
  const root = new Group();
  root.name = "Canal_" + String(index).padStart(2, "0");
  const body = new Group(),
    details = new Group(),
    far = new Group();
  body.name = "LOD1";
  details.name = "LOD0";
  far.name = "LOD2";
  root.add(body, details, far);
  const b = new GeometryBatch(body),
    d = new GeometryBatch(details, false),
    f = new GeometryBatch(far);
  for (const spec of facadeSpecs(index)) {
    const mat = facadeMatrix(route, spec);
    b.transform.copy(mat);
    d.transform.copy(mat);
    f.transform.copy(mat);
    kit.facade(b, d, spec);
    const w = spec.width,
      h = spec.height;
    f.box(kit.walls[spec.color], w, h, 7.8, 0, h / 2, -3.9);
    f.box(kit.roof, w + 0.3, 0.7, 8, 0, h + 0.3, -3.9, new Euler(0, 0, 0.015));
    for (const y of spec.floors)
      for (const x of spec.columns)
        f.box(kit.greenDark, 1.1, 1.9, 0.06, x, y + 0.95, 0.025);
  }
  b.flush("Main elevations");
  d.flush("Near ironwork and plants");
  f.flush("Distant elevations");
  return root;
}
