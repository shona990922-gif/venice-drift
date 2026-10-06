import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Euler,
  Vector3,
  Shape,
  ExtrudeGeometry,
  LatheGeometry,
  Vector2,
  InstancedMesh,
  CylinderGeometry,
  Matrix4,
  TorusGeometry,
  CircleGeometry,
  CatmullRomCurve3,
  TubeGeometry,
} from "three";
import { RouteController, ROUTE } from "../journey/RouteController";
import { GeometryBatch } from "./GeometryBatch";
import { SceneryDetails } from "./SceneryDetails";
import { VenetianKit } from "./VenetianKit";
export class JourneyScenery {
  readonly root = new Group();
  readonly bridges: Group[] = [];
  readonly collision: Mesh[] = [];
  readonly landmark = new Group();
  readonly details: SceneryDetails;
  constructor(
    readonly route: RouteController,
    readonly kit: VenetianKit,
  ) {
    this.banks();
    for (const bridge of ROUTE.bridges) {
      const g = this.bridge(bridge.distance, bridge.style);
      this.bridges.push(g);
      this.root.add(g);
    }
    this.church();
    this.poles();
    this.details = new SceneryDetails(route, kit);
    this.root.add(this.details.root);
  }
  private banks() {
    const n = Math.ceil((this.route.length + 80) / 0.55),
      b = new GeometryBatch(this.root);
    for (const side of [-1, 1]) {
      const pos: number[] = [],
        uv: number[] = [],
        idx: number[] = [];
      for (let i = 0; i <= n; i++) {
        const s = -38 + ((this.route.length + 80) * i) / n,
          p = this.route.pointAtDistance(s),
          t = this.route.tangentAtDistance(s),
          w = this.route.widthAt(s) / 2;
        const x = p.x - t.z * (w + 0.05) * side,
          z = p.z + t.x * (w + 0.05) * side;
        pos.push(x, -0.95, z, x, 0.36, z);
        uv.push(s / 2.4, -0.4, s / 2.4, 0.15);
        if (i < n) {
          const a = i * 2;
          if (side === 1) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const geo = new BufferGeometry();
      geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new Mesh(geo, this.kit.brick);
      m.castShadow = true;
      m.receiveShadow = true;
      m.layers.enable(1);
      this.root.add(m);
      for (let s = -38; s < this.route.length + 40; s += 1.4) {
        const p = this.route.pointAtDistance(s),
          t = this.route.tangentAtDistance(s),
          c = new Vector3(-t.z, 0, t.x),
          yaw = Math.atan2(-t.x, -t.z);
        p.addScaledVector(c, (this.route.widthAt(s) / 2 + 0.2) * side);
        b.transform.makeRotationY(yaw).setPosition(p);
        b.box(
          this.kit.stone,
          0.55,
          0.2,
          1.47,
          0,
          0.32,
          0,
          new Euler(0, 0, Math.sin(s * 2) * 0.012),
          2.2,
        );
        // Quay strip follows the canal instead of an infinite horizontal plane.
        b.box(this.kit.stone, 9, 0.16, 1.49, side * 4.55, 0.15, 0);
      }
    }
    b.flush("Quay and eroded coping");
  }
  private bridge(distance: number, style: number) {
    const root = new Group(),
      b = new GeometryBatch(root),
      d = new GeometryBatch(root, false);
    const width = this.route.widthAt(distance) + 0.9,
      span = width / 2,
      arch = style === 0 ? 3.7 : style === 1 ? 3.3 : 6.1,
      base = 0.45,
      depth = style === 1 ? 2.7 : 3.7,
      thick = style === 2 ? 0.65 : 0.48;
    const y = (x: number) =>
      base + arch * Math.sqrt(Math.max(0, 1 - (x / span) ** 2));
    const shape = new Shape();
    shape.moveTo(-span, base);
    for (let i = 0; i <= 80; i++) {
      const x = -span + (i / 80) * width;
      shape.lineTo(x, y(x) + thick);
    }
    for (let i = 80; i >= 0; i--) {
      const x = -span + (i / 80) * width;
      shape.lineTo(x, y(x));
    }
    shape.closePath();
    b.add(
      new ExtrudeGeometry(shape, { depth, bevelEnabled: false }),
      style === 1 ? this.kit.brick : this.kit.stone,
      new Vector3(0, 0, -depth / 2),
    );
    for (const z of [-depth / 2 - 0.06, depth / 2 + 0.06]) {
      for (let i = 0; i < 48; i++) {
        const x = -span + ((i + 0.5) / 48) * width,
          slope = Math.atan2(
            y(Math.min(span, x + 0.02)) - y(Math.max(-span, x - 0.02)),
            0.04,
          );
        b.box(
          this.kit.stone,
          width / 48 + 0.012,
          0.2,
          0.2,
          x,
          y(x) + 0.12,
          z,
          new Euler(0, 0, slope),
          2,
        );
        if (style === 2) {
          d.cylinder(
            this.kit.stone,
            0.072,
            0.09,
            0.83,
            x,
            y(x) + thick + 0.47,
            z,
            7,
          );
        } else {
          d.box(this.kit.iron, 0.031, 0.91, 0.036, x, y(x) + thick + 0.49, z);
          for (const dy of [0.18, 0.96])
            d.box(
              this.kit.iron,
              width / 48 + 0.05,
              0.042,
              0.048,
              x,
              y(x) + thick + dy,
              z,
              new Euler(0, 0, slope),
            );
        }
      }
    }
    if (style === 2)
      for (const z of [-depth / 2 - 0.06, depth / 2 + 0.06]) {
        const points = Array.from({ length: 129 }, (_, i) => {
          const x = -span + (i / 128) * width;
          return new Vector3(x, y(x) + thick + 0.97, z);
        });
        d.add(
          new TubeGeometry(new CatmullRomCurve3(points), 128, 0.105, 8, false),
          this.kit.stone,
        );
      }
    for (const side of [-1, 1]) {
      b.box(this.kit.stone, 0.9, 1.8, depth + 0.5, side * span, 0.25, 0);
      for (let i = 0; i < 7; i++)
        b.box(
          this.kit.stone,
          0.48,
          0.16 * (7 - i),
          depth,
          side * (span + 0.3 + i * 0.46),
          0.37 + 0.08 * (7 - i),
          0,
        );
    }
    this.collision.push(...b.flush("Bridge " + style));
    d.flush("Bridge railing " + style);
    root.position.copy(this.route.pointAtDistance(distance));
    const t = this.route.tangentAtDistance(distance);
    root.rotation.y = Math.atan2(-t.x, -t.z);
    root.name = ROUTE.bridges[style].name;
    return root;
  }
  private church() {
    const k = this.kit,
      b = new GeometryBatch(this.landmark),
      d = new GeometryBatch(this.landmark, false);
    const p = this.route.pointAtDistance(ROUTE.landmarkDistance),
      t = this.route.tangentAtDistance(ROUTE.landmarkDistance),
      cross = new Vector3(-t.z, 0, t.x);
    this.landmark.position.copy(p.addScaledVector(cross, 22));
    this.landmark.rotation.y = Math.atan2(-t.x, -t.z);
    this.root.add(this.landmark);
    b.box(k.stone, 23, 0.7, 25, 0, 0, -5);
    b.box(k.stone, 5.2, 1.1, 7, -12, 0.03, -7);
    b.box(k.walls[3], 18, 13, 14, 0, 6.5, -5);
    b.box(k.stone, 19, 0.65, 15, 0, 13.2, -5);
    b.cylinder(k.stone, 6.1, 6.4, 3.1, 0, 14.5, -5, 32);
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const a = ((i / 24) * Math.PI) / 2;
      points.push(new Vector2(Math.cos(a) * 6.2, Math.sin(a) * 8.1));
    }
    b.add(new LatheGeometry(points, 48), k.roof, new Vector3(0, 15.9, -5));
    b.cylinder(k.stone, 0.65, 0.85, 2.5, 0, 24, -5, 16);
    b.cylinder(k.iron, 0.03, 0.04, 1.8, 0, 25.9, -5, 7);
    b.box(k.iron, 1.05, 0.07, 0.06, 0, 26.25, -5);
    for (const x of [-7.3, -4.3, 4.3, 7.3]) {
      b.cylinder(k.stone, 0.33, 0.41, 10, x, 5.4, 2.5, 12);
      b.box(k.stone, 0.95, 0.4, 0.95, x, 0.56, 2.5);
      b.box(k.stone, 0.95, 0.3, 0.95, x, 10.5, 2.5);
    }
    k.door(b, d, 0, 0.2, 3.6, 6.8, false);
    b.box(k.stone, 19, 0.42, 1.2, 0, 11, 2.2);
    const pediment = new Shape();
    pediment.moveTo(-9.5, 0);
    pediment.lineTo(9.5, 0);
    pediment.lineTo(0, 4.1);
    pediment.closePath();
    b.add(
      new ExtrudeGeometry(pediment, { depth: 0.55, bevelEnabled: false }),
      k.stone,
      new Vector3(0, 11.2, 2.3),
    );
    b.add(new CircleGeometry(1.25, 32), k.recess, new Vector3(0, 8.9, 2.53));
    b.add(
      new TorusGeometry(1.3, 0.15, 8, 32),
      k.stone,
      new Vector3(0, 8.9, 2.56),
    );
    for (const x of [-7.3, -4.3, 4.3, 7.3])
      b.box(k.stone, 1.1, 0.4, 1.1, x, 10.6, 2.5);
    for (const x of [-13.96, -10.04])
      for (const z of [-8.96, -5.04]) b.box(k.stone, 0.2, 23.8, 0.2, x, 12, z);
    for (const yy of [18, 22.8]) b.box(k.stone, 4.45, 0.18, 4.45, -12, yy, -7);
    // A separate campanile provides a readable slender silhouette against sky.
    b.box(k.walls[4], 4.2, 24, 4.2, -12, 12, -7);
    b.box(k.stone, 4.7, 0.45, 4.7, -12, 24, -7);
    b.box(k.recess, 3.6, 3.7, 3.6, -12, 26, -7);
    for (const x of [-13.8, -10.2])
      for (const z of [-8.8, -5.2]) b.box(k.stone, 0.37, 4, 0.37, x, 26, z);
    b.box(k.stone, 4.6, 0.4, 4.6, -12, 28.1, -7);
    b.cylinder(
      k.roof,
      0,
      3.1,
      5,
      -12,
      30.5,
      -7,
      4,
      new Euler(0, Math.PI / 4, 0),
    );
    b.flush("Santa quiete");
    d.flush("Church doorway");
  }
  private poles() {
    const geometry = new CylinderGeometry(0.105, 0.135, 2.15, 9),
      mat = this.kit.wood;
    const points: Vector3[] = [];
    for (let s = 3; s < this.route.length; s += 17) {
      for (const side of [-1, 1]) {
        const p = this.route.pointAtDistance(s),
          t = this.route.tangentAtDistance(s);
        points.push(
          p
            .addScaledVector(
              new Vector3(-t.z, 0, t.x),
              side * (this.route.widthAt(s) / 2 - 0.48),
            )
            .setY(0.55),
        );
      }
    }
    const mesh = new InstancedMesh(geometry, mat, points.length),
      m = new Matrix4();
    points.forEach((p, i) =>
      mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.layers.enable(1);
    this.root.add(mesh);
  }
  update(distance: number, lights: number) {
    this.details.update(distance, lights);
  }
  dispose() {
    this.details.dispose();
    this.root.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    this.root.removeFromParent();
  }
}
