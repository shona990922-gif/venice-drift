import {
  CatmullRomCurve3,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  TubeGeometry,
  Vector3,
} from "three";
import { RouteController } from "../journey/RouteController";
import { BoatController } from "../journey/BoatController";
import { GeometryBatch } from "./GeometryBatch";
import { VenetianKit } from "./VenetianKit";
export class SceneryDetails {
  readonly root = new Group();
  private groups: { distance: number; group: Group }[] = [];
  private lamps: PointLight[] = [];
  private ends: { distance: number; near: Group; far: Group }[] = [];
  private ownMaterials: MeshStandardMaterial[] = [];
  constructor(
    readonly route: RouteController,
    readonly kit: VenetianKit,
  ) {
    for (const [s, side] of [
      [24, -1],
      [119, 1],
      [236, -1],
      [339, 1],
      [410, -1],
      [466, 1],
    ])
      this.moor(s, side);
    this.terrace(411);
    this.background();
  }
  private locate(s: number, side: number, offset: number) {
    const g = new Group(),
      p = this.route.pointAtDistance(s),
      t = this.route.tangentAtDistance(s),
      c = new Vector3(-t.z, 0, t.x);
    g.position.copy(
      p.addScaledVector(c, side * (this.route.widthAt(s) / 2 + offset)),
    );
    g.rotation.y = Math.atan2(-t.x, -t.z);
    this.root.add(g);
    this.groups.push({ distance: s, group: g });
    return g;
  }
  private moor(s: number, side: number) {
    const g = this.locate(s, side, -1.15),
      k = this.kit,
      b = new GeometryBatch(g),
      d = new GeometryBatch(g, false);
    for (const z of [-4.1, 4.1]) {
      b.cylinder(
        k.wood,
        0.12,
        0.17,
        2.0,
        side * 0.48,
        0.38,
        z,
        10,
        new Euler(0, 0, 0.016 * side),
      );
      b.cylinder(k.stone, 0.13, 0.13, 0.065, side * 0.48, 1.4, z, 10);
      for (let y = 0.64; y < 0.79; y += 0.045) {
        const points = [];
        for (let i = 0; i <= 20; i++)
          points.push(
            new Vector3(
              side * 0.48 + Math.cos((i / 20) * Math.PI * 2) * 0.15,
              y,
              z + Math.sin((i / 20) * Math.PI * 2) * 0.15,
            ),
          );
        d.add(
          new TubeGeometry(new CatmullRomCurve3(points), 20, 0.016, 5, false),
          k.wood,
        );
      }
      const rope = [
        new Vector3(side * 0.48, 0.76, z),
        new Vector3(side * 0.27, 0.28, z * 0.74),
        new Vector3(side * 0.14, 0.4, z * 0.65),
      ];
      d.add(
        new TubeGeometry(new CatmullRomCurve3(rope), 14, 0.018, 5, false),
        k.wood,
      );
    }
    if (s !== 119 && s !== 339) {
      const boat = new BoatController();
      boat.root.scale.set(0.71, 0.79, 0.76);
      boat.root.position.x = -side * 0.1;
      boat.root.rotation.y = 0.035 * side;
      g.add(boat.root);
      boat.root.traverse((o) => {
        if (o instanceof Mesh) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          this.ownMaterials.push(...(ms as MeshStandardMaterial[]));
        }
      });
    }
    b.flush("Moored piles");
    d.flush("Mooring hemp");
  }
  private terrace(s: number) {
    const g = this.locate(s, 1, -3.4),
      k = this.kit,
      b = new GeometryBatch(g),
      d = new GeometryBatch(g, false);
    const awning = new MeshStandardMaterial({ color: "#ab8066", roughness: 1 }),
      linen = new MeshStandardMaterial({ color: "#c9b995", roughness: 1 });
    this.ownMaterials.push(awning, linen);
    b.box(k.wood, 3.4, 0.2, 15, 1.7, 0.28, 0);
    for (let z = -7; z <= 7; z += 1.4) {
      b.cylinder(k.wood, 0.075, 0.09, 1.2, 0, 0.55, z, 8);
      d.box(k.iron, 0.045, 0.055, 1.4, 0, 1.12, z + 0.7);
    }
    for (const z of [-5.2, -1.1, 3.1]) {
      b.cylinder(k.iron, 0.043, 0.07, 0.72, 1.8, 0.76, z, 8);
      b.cylinder(linen, 0.56, 0.56, 0.065, 1.8, 1.14, z, 20);
      for (const dir of [-1, 1]) {
        d.box(k.wood, 0.5, 0.07, 0.48, 1.8, 0.78, z + dir * 0.82);
        d.box(k.wood, 0.51, 0.5, 0.055, 1.8, 1.05, z + dir * 1.03);
        for (const x of [1.6, 2.0])
          for (const zz of [z + dir * 0.82 - 0.16, z + dir * 0.82 + 0.16])
            d.box(k.iron, 0.034, 0.42, 0.034, x, 0.55, zz);
      }
      d.cylinder(k.lamp, 0.045, 0.06, 0.1, 1.8, 1.23, z, 10);
      k.flowerBox(d, 0.17, 1.16, z, 1.15, Math.round(z * 99));
    }
    // Folded linen awning follows the facade, with a modest weathered valance.
    for (const z of [-6, 6])
      b.cylinder(k.iron, 0.045, 0.055, 3, 3.0, 1.9, z, 8);
    b.box(awning, 3.2, 0.055, 12.5, 1.85, 3.25, 0, new Euler(0, 0, -0.13));
    b.box(awning, 0.035, 0.27, 12.5, 0.27, 3.32, 0);
    for (const z of [-6, 0, 6]) {
      const light = new PointLight("#ffc082", 0, 6, 2);
      light.position.set(0.35, 2.45, z);
      g.add(light);
      this.lamps.push(light);
      b.cylinder(k.iron, 0.035, 0.06, 2.5, 0.2, 1.57, z, 8);
      b.box(k.lamp, 0.16, 0.23, 0.16, 0.2, 2.8, z);
    }
    b.flush("Trattoria terrace");
    d.flush("Flowers and quiet tables");
    // Keep the light count constant: distant intensity is zero, avoiding a shader
    // recompile when the terrace first enters view.
    g.updateWorldMatrix(true, true);
    for (const light of this.lamps) this.root.attach(light);
  }
  private background() {
    const root = new Group(),
      b = new GeometryBatch(root),
      k = this.kit;
    this.root.add(root);
    // Recessed ends are scenery only; the ride turns around under a fade before
    // reaching either wall. They conceal the finite geometry and long empty sky gaps.
    // A recessed piazza edge keeps the hero church open to view, while a
    // second row encloses the world when the passenger looks toward the bank.
    for (let s = 433; s < this.route.length + 28; s += 14) {
      const p = this.route.pointAtDistance(s),
        t = this.route.tangentAtDistance(s),
        c = new Vector3(-t.z, 0, t.x);
      p.addScaledVector(c, this.route.widthAt(s) / 2 + 18);
      b.transform.makeRotationY(Math.atan2(-c.x, -c.z)).setPosition(p);
      const id = Math.round(s),
        h = 10 + (id % 3) * 2;
      b.box(k.stone, 14, 0.35, 20, 0, 0.1, 2.0);
      b.box(k.walls[id % 6], 13.8, h, 8, 0, h / 2, -4);
      b.box(k.roof, 14.2, 0.65, 8.3, 0, h + 0.3, -4);
      for (let x = -4.8; x <= 4.8; x += 3.2)
        for (let y = 1.4; y < h - 1; y += 3.2) {
          b.box(k.stone, 1.23, 2.04, 0.12, x, y + 1, 0.06);
          b.box(k.greenDark, 0.93, 1.8, 0.15, x, y + 1, 0.14);
        }
    }
    for (const s of [-36, this.route.length + 26]) {
      const p = this.route.pointAtDistance(s),
        t = this.route.tangentAtDistance(s),
        near = new Group(),
        far = new Group();
      near.position.copy(p);
      far.position.copy(p);
      near.rotation.y = far.rotation.y =
        Math.atan2(-t.x, -t.z) + (s < 0 ? Math.PI : 0);
      this.root.add(near, far);
      this.ends.push({ distance: s, near, far });
      const nb = new GeometryBatch(near),
        nd = new GeometryBatch(near, false),
        fb = new GeometryBatch(far);
      for (let i = -3; i <= 3; i++) {
        const h = 12 + ((i + 4) % 3) * 1.5;
        nb.transform.makeTranslation(i * 10, 0, 0);
        nd.transform.copy(nb.transform);
        k.facade(nb, nd, {
          name: "Terminal palazzo " + i,
          s,
          side: 1,
          width: 9.7,
          height: h,
          color: (i + 7) % 6,
          floors: h > 13 ? [1.2, 4.6, 7.8, 10.8] : [1.2, 4.6, 8.1],
          columns: [-3.2, -1.1, 1.1, 3.2],
          type: i % 2 === 0 ? "palazzo" : "house",
          seed: 900 + i * 17,
        });
        fb.box(k.walls[(i + 7) % 6], 9.7, h, 8, i * 10, h / 2, -4);
        fb.box(k.roof, 10, 0.6, 8.2, i * 10, h + 0.2, -4);
        for (let x = -3.2; x <= 3.2; x += 2.13)
          for (let y = 1.2; y < h - 2; y += 3.2)
            fb.box(k.greenDark, 0.93, 1.8, 0.06, i * 10 + x, y + 1, 0.01);
      }
      nb.flush("Terminal elevations").forEach((m) => (m.castShadow = false));
      nd.flush("Terminal details").forEach((m) => (m.castShadow = false));
      fb.flush("Terminal silhouettes").forEach((m) => (m.castShadow = false));
    }
    const meshes = b.flush("Distant closing elevations");
    meshes.forEach((m) => (m.castShadow = false));
  }
  update(distance: number, lightLevel: number) {
    for (const e of this.ends) {
      const d = Math.abs(e.distance - distance);
      e.near.visible = d < 90;
      e.far.visible = !e.near.visible;
    }
    for (const { distance: s, group } of this.groups)
      group.visible = Math.abs(s - distance) < 95;
    for (const lamp of this.lamps)
      lamp.intensity =
        lightLevel *
        5.5 *
        Math.max(0, Math.min(1, (95 - Math.abs(411 - distance)) / 15));
  }
  dispose() {
    this.root.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    for (const m of new Set(this.ownMaterials)) m.dispose();
    this.root.removeFromParent();
  }
}
