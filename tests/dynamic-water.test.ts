import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { RippleWindow, CanalMask } from "../src/water/RippleWindow";
import { RainImpactQueue } from "../src/water/WaterImpact";
import { BoatWaterInteraction } from "../src/water/BoatWaterInteraction";
import { RouteController, ROUTE } from "../src/journey/RouteController";
import { CANAL_DEFAULTS } from "../src/water/v2/Presets";
import type { WaterImpact } from "../src/water/WaterImpact";

describe("world anchored dynamic interaction", () => {
  it("retains the same world position across integer texel scrolls", () => {
    const w = new RippleWindow(24, 256),
      p = new Vector3(10, 0, -30);
    w.move(p);
    const point = p.clone().add(new Vector3(2, 0, 3)),
      uv = w.worldToUV(point);
    const shift = w.move(p.clone().add(new Vector3(0.53, 0, -0.27))),
      next = w.worldToUV(point);
    expect(next.clone().add(shift).distanceTo(uv)).toBeLessThan(1e-12);
    expect(shift.x * 256).toBeCloseTo(Math.round(shift.x * 256), 9);
  });
  it("rejects land and identifies bridge cover along all sections", () => {
    const r = new RouteController(),
      m = new CanalMask(r);
    for (let d = 0; d < r.length; d += 3) {
      const p = r.pointAtDistance(d),
        t = r.tangentAtDistance(d),
        side = new Vector3(-t.z, 0, t.x);
      expect(m.test(p.x, p.z).inside).toBe(true);
      p.addScaledVector(side, r.widthAt(d) / 2 + 2);
      expect(m.test(p.x, p.z, d).inside).toBe(false);
    }
    for (const b of ROUTE.bridges) {
      const p = r.pointAtDistance(b.distance);
      expect(m.test(p.x, p.z).covered).toBe(true);
    }
  });
  it("bounds batched queue and snapshots positions instead of retaining mutable boat vectors", () => {
    const q = new RainImpactQueue(24),
      p = new Vector3(1, 0, 2);
    for (let i = 0; i < 40; i++)
      q.push({
        worldPosition: p,
        radius: 0.06,
        strength: -0.001,
        source: "RAIN",
      });
    p.x = 100;
    expect(q.length).toBe(24);
    expect(q.dropped).toBe(16);
    expect(q.consume(8)[0].worldPosition.x).toBe(1);
    expect(q.length).toBe(16);
  });
  it("stops all boat emissions at zero speed while retaining simulation history", () => {
    const b = new BoatWaterInteraction(),
      r = new RouteController();
    let hull = 0,
      drops = 0;
    const sim = {
      createRipple() {},
      moveHull() {
        hull++;
      },
      enqueue() {
        drops++;
      },
    };
    for (let i = 0; i < 60; i++) {
      r.update(1 / 60);
      b.update(r.position, r.tangent, r.speed, sim, CANAL_DEFAULTS);
    }
    expect(hull).toBeGreaterThan(20);
    expect(drops).toBeGreaterThan(0);
    const old = [hull, drops];
    for (let i = 0; i < 60; i++)
      b.update(r.position, r.tangent, 0, sim, CANAL_DEFAULTS);
    expect([hull, drops]).toEqual(old);
    expect(b.centers).toHaveLength(10);
  });
  it("keeps six moving hull volumes on LOW", () => {
    const b = new BoatWaterInteraction(true);
    b.update(
      new Vector3(),
      new Vector3(0, 0, -1),
      1,
      { createRipple() {} },
      CANAL_DEFAULTS,
    );
    expect(b.centers).toHaveLength(6);
  });
  it("places visible contact waves beyond both hull tips, with no net water added", () => {
    const b = new BoatWaterInteraction();
    const drops: WaterImpact[] = [];
    const forward = new Vector3(1, 0, 0);
    const sim = {
      createRipple() {},
      enqueue: (e: WaterImpact) => drops.push(e),
    };
    b.update(new Vector3(), forward, 1.55, sim, CANAL_DEFAULTS);
    b.update(new Vector3(0.25, 0, 0), forward, 1.55, sim, CANAL_DEFAULTS);
    const bow = drops.find((e) => e.source === "BOAT_BOW")!;
    const stern = drops.find((e) => e.source === "BOAT_STERN")!;
    expect(bow.worldPosition.x - 0.24).toBeGreaterThan(5.15);
    expect(stern.worldPosition.x - 0.24).toBeLessThan(-4.85);
    expect(
      drops.reduce((sum, e) => sum + e.strength * e.radius ** 2, 0),
    ).toBeCloseTo(0, 12);
    expect(Math.max(...drops.map((e) => Math.abs(e.strength)))).toBeLessThan(
      0.01,
    );
  });
  it("leaves the same distance-spaced trail at different rendering frame rates", () => {
    const sample = (hz: number) => {
      const b = new BoatWaterInteraction();
      const drops: WaterImpact[] = [];
      const forward = new Vector3(0, 0, -1);
      const sim = {
        createRipple() {},
        enqueue: (e: WaterImpact) => drops.push(e),
      };
      for (let i = 0; i <= hz * 4; i++)
        b.update(
          new Vector3(0, 0, (-1.55 * i) / hz),
          forward,
          1.55,
          sim,
          CANAL_DEFAULTS,
        );
      return drops;
    };
    const slow = sample(30),
      fast = sample(120);
    expect(slow.length).toBeGreaterThan(0);
    expect(slow).toHaveLength(fast.length);
    slow.forEach((e, i) => {
      expect(e.worldPosition.distanceTo(fast[i].worldPosition)).toBeLessThan(
        1e-9,
      );
      expect(e.strength).toBe(fast[i].strength);
    });
  });
  it("lets the side control independently reduce hull drag without removing bow or stern", () => {
    const b = new BoatWaterInteraction();
    const gains: number[] = [],
      drops: WaterImpact[] = [];
    const sim = {
      createRipple() {},
      moveHull: (
        _old: Vector3[],
        _next: Vector3[],
        _r: number[],
        gain: number,
      ) => gains.push(gain),
      enqueue: (e: WaterImpact) => drops.push(e),
    };
    const forward = new Vector3(0, 0, -1);
    b.update(new Vector3(), forward, 1.55, sim, CANAL_DEFAULTS);
    b.update(new Vector3(0, 0, -0.25), forward, 1.55, sim, CANAL_DEFAULTS);
    b.update(new Vector3(0, 0, -0.5), forward, 1.55, sim, {
      ...CANAL_DEFAULTS,
      side: 0,
    });
    expect(gains[0]).toBeGreaterThan(0);
    expect(gains[1]).toBe(0);
    expect(drops.filter((e) => e.source === "BOAT_BOW")).toHaveLength(4);
    expect(drops.filter((e) => e.source === "BOAT_STERN")).toHaveLength(4);
  });
});
