import {
  BufferGeometry,
  CatmullRomCurve3,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Path,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { GeometryBatch } from "./GeometryBatch";
import { pbr, type PBRSet } from "./Materials";
export interface FacadeSpec {
  name: string;
  s: number;
  side: number;
  width: number;
  height: number;
  color: number;
  floors: number[];
  columns: number[];
  type: "gothic" | "palazzo" | "house";
  seed: number;
}
export const PALETTE = [
  "#d4a479",
  "#d79581",
  "#e2c392",
  "#d8ccb4",
  "#b5725c",
  "#c3ae94",
];
export function rand(n: number) {
  return (
    ((Math.sin(n * 127.1 + 31.7) * 43758.5453123) % 1) +
    1 -
    Math.floor(((Math.sin(n * 127.1 + 31.7) * 43758.5453123) % 1) + 1)
  );
}
export class VenetianKit {
  walls: MeshStandardMaterial[];
  stone: MeshStandardMaterial;
  brick: MeshStandardMaterial;
  roof: MeshStandardMaterial;
  wood: MeshStandardMaterial;
  green: MeshStandardMaterial;
  greenDark: MeshStandardMaterial;
  iron = new MeshStandardMaterial({
    color: "#273531",
    roughness: 0.68,
    metalness: 0.25,
  });
  glass = new MeshStandardMaterial({
    color: "#172d2b",
    roughness: 0.25,
    metalness: 0.05,
  });
  recess = new MeshStandardMaterial({ color: "#152220", roughness: 1 });
  curtain = new MeshStandardMaterial({ color: "#cfc5ad", roughness: 1 });
  terracotta = new MeshStandardMaterial({ color: "#825444", roughness: 0.94 });
  leaf = new MeshStandardMaterial({ color: "#345b31", roughness: 0.93 });
  leafLight = new MeshStandardMaterial({ color: "#596b36", roughness: 0.93 });
  flower = new MeshStandardMaterial({ color: "#9e3a49", roughness: 0.82 });
  lamp = new MeshStandardMaterial({
    color: "#b5a16a",
    roughness: 0.32,
    emissive: "#735528",
    emissiveIntensity: 0.14,
  });
  constructor(set: PBRSet) {
    this.walls = PALETTE.map((c) => pbr(set, "plaster", c, true));
    this.stone = pbr(set, "stone", "#dfd3b9", true);
    this.brick = pbr(set, "brick", "#bf9e86", true);
    this.roof = pbr(set, "roof", "#b88b68");
    this.wood = pbr(set, "wood", "#887353");
    this.green = pbr(set, "wood", "#496956");
    this.greenDark = pbr(set, "wood", "#345644");
    for (const m of [this.green, this.greenDark]) {
      m.onBeforeCompile = (s) => {
        s.fragmentShader = s.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
 diffuseColor.rgb=diffuse*(.7+texture2D(map,vMapUv).r*.65);`,
        );
      };
      m.customProgramCacheKey = () => "painted-wood-v1";
    }
    this.glass.metalness = 0.32;
    this.glass.roughness = 0.19;
  }
  windowPath(
    x: number,
    y: number,
    w: number,
    h: number,
    arch: boolean,
    gothic = false,
  ): Shape {
    const s = new Shape();
    s.moveTo(x - w / 2, y);
    s.lineTo(x + w / 2, y);
    if (arch) {
      const spring = y + h - w * (gothic ? 0.7 : 0.5);
      s.lineTo(x + w / 2, spring);
      if (gothic) {
        s.quadraticCurveTo(x + w * 0.5, y + h * 0.93, x, y + h);
        s.quadraticCurveTo(x - w * 0.5, y + h * 0.93, x - w / 2, spring);
      } else s.absarc(x, spring, w / 2, 0, Math.PI, false);
    } else {
      s.lineTo(x + w / 2, y + h);
      s.lineTo(x - w / 2, y + h);
    }
    s.closePath();
    return s;
  }
  private extrusion(s: Shape, depth = 0.1) {
    return new ExtrudeGeometry(s, {
      depth,
      bevelEnabled: false,
      curveSegments: 12,
    });
  }
  facade(b: GeometryBatch, d: GeometryBatch, s: FacadeSpec) {
    const { width: w, height: h, seed } = s;
    const wall = this.walls[s.color];
    // Skin with true openings, recessed glass and a separate rear masonry volume.
    const skin = new Shape([
      new Vector2(-w / 2, -0.6),
      new Vector2(w / 2, -0.6),
      new Vector2(w / 2, h),
      new Vector2(-w / 2, h),
    ]);
    const openings: {
      x: number;
      y: number;
      w: number;
      h: number;
      arch: boolean;
      gothic: boolean;
      id: number;
      floor: number;
    }[] = [];
    for (let floor = 0; floor < s.floors.length; floor++) {
      const y = s.floors[floor];
      for (let j = 0; j < s.columns.length; j++) {
        const x =
            s.columns[j] + (floor > 1 ? (rand(seed + floor) - 0.5) * 0.22 : 0),
          id = seed + floor * 37 + j * 19;
        const wh =
          floor === 0
            ? 1.68
            : floor === 1
              ? s.type === "gothic"
                ? 2.8
                : 2.35
              : 1.9;
        const ww =
          s.type === "gothic" && floor === 1 ? 1.25 : 1.02 + rand(id) * 0.16;
        const arch =
          (s.type !== "house" && floor === 1) ||
          (s.type === "palazzo" && floor === 2);
        if (floor === 0 && Math.abs(x - w * 0.13) < 2) continue;
        openings.push({
          x,
          y,
          w: ww,
          h: wh,
          arch,
          gothic: s.type === "gothic",
          id,
          floor,
        });
      }
    }
    const doorX = w * 0.13,
      doorW = s.type === "house" ? 1.48 : 2.12,
      doorH = s.type === "house" ? 2.75 : 3.3;
    skin.holes.push(
      new Path(this.windowPath(doorX, 0.12, doorW, doorH, true).getPoints()),
    );
    for (const o of openings)
      skin.holes.push(
        new Path(
          this.windowPath(o.x, o.y, o.w, o.h, o.arch, o.gothic).getPoints(),
        ),
      );
    b.add(this.extrusion(skin, 0.22), wall, new Vector3(0, 0, -0.22));
    b.box(wall, w, h, 7.8, 0, h / 2, -4.15);
    for (const o of openings) this.window(b, d, o, s.type);
    this.door(b, d, doorX, 0.12, doorW, doorH, s.type === "house");
    // Ground floor is chipped masonry, with an uneven intertidal seam in the material.
    b.box(this.brick, w, 0.6, 0.075, 0, 0.19, 0.025);
    for (let k = 0; k < Math.ceil(w / 0.63); k++) {
      const x = -w / 2 + k * 0.63 + 0.315,
        y = 0.55 + rand(seed + k) * 0.13;
      b.box(
        this.stone,
        0.59,
        0.21,
        0.17,
        x,
        y,
        0.045,
        new Euler(0, 0, (rand(k + seed) - 0.5) * 0.035),
        2,
      );
    }
    for (const [level, thickness, depth] of [
      [h, 0.19, 0.36],
      [h - 0.22, 0.17, 0.22],
      [h - 0.42, 0.1, 0.12],
    ])
      b.box(this.stone, w + 0.4, thickness, depth, 0, level, depth / 2 - 0.015);
    for (let x = -w / 2 + 0.25; x < w / 2; x += 0.46)
      b.box(this.stone, 0.17, 0.18, 0.27, x, h - 0.37, 0.06);
    if (s.type !== "house")
      for (const y of s.floors.slice(1))
        b.box(this.stone, w + 0.1, 0.095, 0.12, 0, y - 0.35, 0.06);
    // Hip roof with a low terracotta pitch and a visible irregular tiled eave.
    const roofShape = new Shape([
      new Vector2(-4.25, 0),
      new Vector2(4.25, 0),
      new Vector2(0, 1.55),
    ]);
    b.add(
      this.extrusion(roofShape, w + 0.62),
      this.roof,
      new Vector3(-w / 2 - 0.31, h + 0.12, -4),
      new Euler(0, Math.PI / 2, 0),
      undefined,
      2.5,
    );
    for (let x = -w / 2 - 0.18; x < w / 2 + 0.3; x += 0.27) {
      b.add(
        new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(x, h + 0.17, 0.25),
            new Vector3(x, h + 0.24, -0.05),
            new Vector3(x, h + 0.29, -0.34),
          ]),
          3,
          0.074,
          6,
          false,
        ),
        this.roof,
      );
    }
    // Two varied masonry chimney pots, not a repeated skyline grid.
    if (s.type !== "gothic") {
      const cx = -w * 0.3;
      b.box(this.brick, 0.8, 1.6, 0.8, cx, h + 1.28, -3.3);
      b.box(this.stone, 1.02, 0.14, 1.0, cx, h + 2.1, -3.3);
      b.cylinder(this.terracotta, 0.24, 0.3, 0.55, cx, h + 2.43, -3.3, 10);
    }
    this.drain(d, -w / 2 + 0.19, h);
    if (seed % 2 === 0) this.wallLamp(d, w / 2 - 1.2, 2.75);
    // Cast iron mooring rings fixed into the masonry, close to the water.
    for (const x of [-w * 0.33, w * 0.34]) {
      d.add(
        new TorusGeometry(0.12, 0.025, 6, 16),
        this.iron,
        new Vector3(x, 0.65, 0.15),
      );
      d.box(this.iron, 0.13, 0.15, 0.08, x, 0.83, 0.1);
    }
  }
  window(
    b: GeometryBatch,
    d: GeometryBatch,
    o: {
      x: number;
      y: number;
      w: number;
      h: number;
      arch: boolean;
      gothic: boolean;
      id: number;
      floor: number;
    },
    type: string,
  ) {
    const { x, y, w, h, arch, gothic, id, floor } = o;
    const frame = this.windowPath(x, y - 0.1, w + 0.28, h + 0.22, arch, gothic);
    frame.holes.push(
      new Path(this.windowPath(x, y, w, h, arch, gothic).getPoints()),
    );
    b.add(this.extrusion(frame, 0.12), this.stone, new Vector3(0, 0, 0.015));
    b.add(
      this.extrusion(this.windowPath(x, y, w, h, arch, gothic), 0.04),
      this.recess,
      new Vector3(0, 0, -0.19),
    );
    const pane = new ShapeGeometry(
      this.windowPath(x, y + 0.045, w - 0.09, h - 0.09, arch, gothic),
    );
    pane.setAttribute(
      "_light_seed",
      new Float32BufferAttribute(
        new Float32Array(pane.attributes.position.count).fill(rand(id + 771)),
        1,
      ),
    );
    b.add(pane, this.glass, new Vector3(0, 0, -0.14));
    b.box(this.greenDark, 0.045, h - 0.08, 0.055, x, y + h / 2, -0.09);
    b.box(this.greenDark, w - 0.05, 0.045, 0.055, x, y + h * 0.44, -0.09);
    if (h > 2.3)
      b.box(this.greenDark, w - 0.05, 0.045, 0.055, x, y + h * 0.76, -0.09);
    b.box(this.stone, w + 0.4, 0.13, 0.37, x, y - 0.1, 0.105);
    b.box(this.stone, w + 0.26, 0.085, 0.24, x, y - 0.23, 0.06);
    const balcony = floor === 1 && (type === "gothic" || rand(id + 3) > 0.66);
    if (balcony)
      this.balcony(
        b,
        d,
        x,
        y - 0.25,
        type === "gothic" ? w + 0.48 : w + 0.7,
        id,
      );
    if (!arch || type !== "gothic") {
      // Full, folded and partly open shutters vary by opening, not by random building copies.
      const state = rand(id + 12);
      for (const sign of [-1, 1])
        this.shutter(
          b,
          d,
          x + (sign * w) / 2,
          y,
          w * 0.48,
          h,
          sign,
          state > 0.76 ? 0.07 : state > 0.45 ? 1.85 : 2.92,
          id + sign,
        );
    }
    if (rand(id + 9) > 0.68) {
      for (const sign of [-1, 1]) {
        const geom = new BufferGeometry(),
          pos: number[] = [],
          indices: number[] = [];
        for (let i = 0; i <= 8; i++)
          for (let j = 0; j <= 5; j++)
            pos.push(
              x + sign * (w * 0.2 + (i / 8) * w * 0.23),
              y + 0.1 + (j / 5) * (h - 0.3),
              -0.125 + Math.sin(i * 2.5) * 0.012,
            );
        for (let i = 0; i < 8; i++)
          for (let j = 0; j < 5; j++) {
            const a = i * 6 + j;
            indices.push(a, a + 6, a + 1, a + 6, a + 7, a + 1);
          }
        geom.setAttribute("position", new Float32BufferAttribute(pos, 3));
        geom.setAttribute(
          "uv",
          new Float32BufferAttribute(
            pos.flatMap((_, i) => (i % 3 === 0 ? [0, 0] : [])),
            2,
          ),
        );
        geom.setIndex(indices);
        geom.computeVertexNormals();
        d.add(geom, this.curtain);
      }
    }
    if (floor === 1 && rand(id + 22) > 0.6)
      this.flowerBox(d, x, y - 0.08, balcony ? 0.73 : 0.3, w * 0.85, id);
  }
  shutter(
    b: GeometryBatch,
    d: GeometryBatch,
    hinge: number,
    y: number,
    w: number,
    h: number,
    sign: number,
    angle: number,
    id: number,
  ) {
    const oldB = b.transform.clone(),
      oldD = d.transform.clone();
    const pivot = new Matrix4().makeRotationY(sign * angle);
    pivot.setPosition(hinge, y, 0.075);
    b.transform.multiply(pivot);
    d.transform.multiply(pivot);
    const mat = rand(id) > 0.45 ? this.green : this.greenDark;
    b.box(mat, w, h, 0.048, (-sign * w) / 2, h / 2, 0);
    for (const x of [-sign * 0.035, -sign * (w - 0.035)])
      b.box(mat, 0.048, h + 0.035, 0.075, x, h / 2, 0.008);
    for (const yy of [0.04, h - 0.04, h * 0.45])
      b.box(mat, w, 0.06, 0.074, (-sign * w) / 2, yy, 0.01);
    for (let yy = 0.14; yy < h - 0.1; yy += 0.11)
      d.box(
        mat,
        w - 0.105,
        0.063,
        0.044,
        (-sign * w) / 2,
        yy,
        0.032,
        new Euler(-0.34, 0, 0),
      );
    b.transform.copy(oldB);
    d.transform.copy(oldD);
  }
  balcony(
    b: GeometryBatch,
    d: GeometryBatch,
    x: number,
    y: number,
    w: number,
    id: number,
  ) {
    b.box(this.stone, w + 0.18, 0.16, 0.95, x, y, 0.32);
    for (const xx of [x - w * 0.32, x + w * 0.32]) {
      b.box(this.stone, 0.16, 0.27, 0.52, xx, y - 0.2, 0.23);
      b.box(this.stone, 0.23, 0.15, 0.28, xx, y - 0.38, 0.13);
    }
    for (const yy of [y + 0.17, y + 0.9])
      d.box(this.iron, w, 0.04, 0.045, x, yy, 0.77);
    for (let xx = x - w / 2; xx <= x + w / 2 + 0.01; xx += 0.14)
      d.box(this.iron, 0.024, 0.83, 0.027, xx, y + 0.48, 0.77);
    for (const sign of [-1, 1]) {
      d.box(this.iron, 0.035, 0.04, 0.77, x + (sign * w) / 2, y + 0.9, 0.4);
      d.box(this.iron, 0.035, 0.83, 0.035, x + (sign * w) / 2, y + 0.48, 0.04);
    }
    if (id % 2 === 0)
      for (let xx = x - w / 2 + 0.25; xx < x + w / 2; xx += 0.4)
        d.add(
          new TorusGeometry(0.15, 0.013, 4, 16),
          this.iron,
          new Vector3(xx, y + 0.51, 0.78),
        );
  }
  flowerBox(
    d: GeometryBatch,
    x: number,
    y: number,
    z: number,
    w: number,
    seed: number,
  ) {
    d.box(this.terracotta, w, 0.18, 0.22, x, y - 0.04, z);
    for (let i = 0; i < 48; i++) {
      const px = x + (rand(seed + i * 5) - 0.5) * w,
        py = y + 0.14 + rand(seed + i * 7) * 0.2,
        pz = z + (rand(seed + i * 11) - 0.5) * 0.3;
      const leaf = new SphereGeometry(0.064, 5, 3);
      leaf.scale(1, 0.25, 1.75);
      d.add(
        leaf,
        i % 3 === 0 ? this.leafLight : this.leaf,
        new Vector3(px, py, pz),
        new Euler(rand(i) * 2, rand(i + 6) * 6, rand(i + 7) * 2),
      );
      if (i % 5 === 0)
        d.add(
          new SphereGeometry(0.035, 5, 4),
          this.flower,
          new Vector3(px, py + 0.05, pz),
        );
    }
  }
  door(
    b: GeometryBatch,
    d: GeometryBatch,
    x: number,
    y: number,
    w: number,
    h: number,
    simple: boolean,
  ) {
    const frame = this.windowPath(x, y - 0.06, w + 0.35, h + 0.28, true);
    frame.holes.push(new Path(this.windowPath(x, y, w, h, true).getPoints()));
    b.add(this.extrusion(frame, 0.19), this.stone, new Vector3(0, 0, 0.02));
    b.add(
      this.extrusion(this.windowPath(x, y, w, h, true), 0.04),
      this.wood,
      new Vector3(0, 0, -0.12),
    );
    const straight = h - w / 2;
    for (let xx = x - w / 2 + 0.1; xx < x + w / 2; xx += 0.18)
      d.box(this.recess, 0.012, straight, 0.018, xx, y + straight / 2, -0.058);
    b.box(this.wood, 0.085, straight, 0.075, x, y + straight / 2, -0.06);
    for (const yy of [0.3, 1.25, straight - 0.15])
      b.box(this.wood, w - 0.12, 0.095, 0.055, x, y + yy, -0.045);
    if (!simple) {
      d.add(
        new TorusGeometry(0.07, 0.017, 6, 16),
        this.iron,
        new Vector3(x + 0.13, 1.29, 0),
      );
      b.box(this.stone, w + 0.3, 0.14, 0.48, x, 0.18, 0.15);
    }
  }
  drain(d: GeometryBatch, x: number, h: number) {
    d.cylinder(this.iron, 0.047, 0.047, h - 0.35, x, h / 2, 0.12, 8);
    for (let y = 1; y < h; y += 2.0)
      d.box(this.iron, 0.14, 0.045, 0.22, x, y, 0.05);
    d.add(
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(x, 0.32, 0.12),
          new Vector3(x, 0.18, 0.2),
          new Vector3(x, 0.15, 0.36),
        ]),
        6,
        0.051,
        8,
        false,
      ),
      this.iron,
    );
  }
  wallLamp(d: GeometryBatch, x: number, y: number) {
    d.box(this.iron, 0.15, 0.25, 0.1, x, y, 0.09);
    d.add(
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(x, y, 0.1),
          new Vector3(x, y + 0.12, 0.5),
          new Vector3(x, y - 0.02, 0.65),
        ]),
        12,
        0.025,
        6,
        false,
      ),
      this.iron,
    );
    d.box(this.lamp, 0.19, 0.29, 0.19, x, y - 0.18, 0.64);
    d.box(this.iron, 0.29, 0.075, 0.29, x, y + 0.01, 0.64);
    d.box(this.iron, 0.23, 0.06, 0.23, x, y - 0.36, 0.64);
    for (const dx of [-0.1, 0.1])
      for (const dz of [-0.1, 0.1])
        d.box(this.iron, 0.018, 0.32, 0.018, x + dx, y - 0.18, 0.64 + dz);
  }
}
