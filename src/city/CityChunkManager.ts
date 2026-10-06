import { Group, Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RouteController } from "../journey/RouteController";
import { VenetianKit } from "./VenetianKit";
import {
  kitMaterials,
  CHUNK_LENGTH,
  facadeSpecs,
  facadeMatrix,
} from "./JourneyLayout";
import { GeometryBatch } from "./GeometryBatch";
export class CityChunkManager {
  readonly root = new Group();
  readonly loaded = new Map<number, Group>();
  readonly pending = new Map<number, Promise<void>>();
  readonly far = new Map<number, Group>();
  readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private materials;
  private low = false;
  private lastDistance = -100;
  private disposed = false;
  private target = 0;
  loads = 0;
  unloads = 0;
  errors: string[] = [];
  readonly count: number;
  private failed = new Map<number, number>();
  constructor(
    readonly route: RouteController,
    readonly kit: VenetianKit,
  ) {
    this.materials = kitMaterials(kit);
    this.count = Math.ceil(route.length / CHUNK_LENGTH);
    for (let i = 0; i < this.count; i++) {
      const g = new Group();
      g.name = "Far_" + i;
      const b = new GeometryBatch(g);
      for (const s of facadeSpecs(i)) {
        b.transform.copy(facadeMatrix(route, s));
        b.box(
          kit.walls[s.color],
          s.width,
          s.height,
          7.8,
          0,
          s.height / 2,
          -3.9,
        );
        b.box(kit.roof, s.width + 0.3, 0.8, 8, 0, s.height + 0.35, -3.9);
        for (const y of s.floors)
          for (const x of s.columns)
            b.box(kit.greenDark, 1.1, 1.85, 0.07, x, y + 0.94, 0.04);
      }
      b.flush("Far silhouette").forEach((m) => (m.castShadow = false));
      this.far.set(i, g);
      this.root.add(g);
    }
  }
  async start() {
    await Promise.all([0, 1].map((i) => this.load(i)));
    this.update(0);
  }
  private release(group: Group) {
    group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    group.removeFromParent();
  }
  private load(i: number) {
    if (i < 0 || i >= this.count || this.loaded.has(i) || this.disposed)
      return Promise.resolve();
    if (this.pending.has(i)) return this.pending.get(i)!;
    if ((this.failed.get(i) ?? 0) > performance.now()) return Promise.resolve();
    const promise = this.loader
      .loadAsync(
        `${import.meta.env.BASE_URL}assets/city/canal-${String(i).padStart(2, "0")}.glb`,
      )
      .then((gltf) => {
        gltf.scene.traverse((o) => {
          if (o instanceof Mesh) {
            const originals = Array.isArray(o.material)
              ? o.material
              : [o.material];
            o.material = originals.map(
              (m) => this.materials.get(m.name) || this.kit.stone,
            );
            if (o.material.length === 1) o.material = o.material[0];
            originals.forEach((m) => m.dispose());
            o.castShadow = true;
            o.receiveShadow = true;
            if (!o.parent?.name.includes("LOD0")) o.layers.enable(1);
          }
        });
        if (this.disposed || Math.abs(i - this.target) > 3) {
          this.release(gltf.scene);
          return;
        }
        this.loaded.set(i, gltf.scene);
        this.root.add(gltf.scene);
        this.loads++;
        this.lastDistance = -100;
        this.update(this.route.distance, this.low);
      })
      .catch((error) => {
        this.errors.push(`Canal ${i}: ${String(error)}`);
        this.failed.set(i, performance.now() + 10000);
      })
      .finally(() => this.pending.delete(i));
    this.pending.set(i, promise);
    return promise;
  }
  update(distance: number, low = false) {
    if (Math.abs(distance - this.lastDistance) < 0.5 && low === this.low)
      return;
    this.lastDistance = distance;
    this.low = low;
    this.target = Math.min(this.count - 1, Math.floor(distance / CHUNK_LENGTH));
    for (const i of [
      this.target,
      this.target + 1,
      this.target - 1,
      this.target + 2,
    ])
      void this.load(i);
    for (const [i, g] of this.loaded) {
      if (i < this.target - 1 || i > this.target + 2) {
        this.release(g);
        this.loaded.delete(i);
        this.unloads++;
        continue;
      }
      const d = Math.abs(i * CHUNK_LENGTH + CHUNK_LENGTH / 2 - distance);
      g.visible = d < 110;
      const detail = g.getObjectByName("LOD0"),
        body = g.getObjectByName("LOD1"),
        far = g.getObjectByName("LOD2");
      if (detail) detail.visible = d < (low ? 34 : 54);
      if (body) body.visible = true;
      if (far) far.visible = false;
      g.traverse((o) => {
        if (o instanceof Mesh) o.castShadow = d < 65;
      });
    }
    for (const [i, g] of this.far) {
      const d = Math.abs(i * CHUNK_LENGTH + 21 - distance);
      g.visible = !this.loaded.get(i)?.visible && d < 230;
    }
  }
  dispose() {
    this.disposed = true;
    for (const g of this.loaded.values()) this.release(g);
    for (const g of this.far.values()) this.release(g);
    this.loaded.clear();
    this.far.clear();
  }
}
