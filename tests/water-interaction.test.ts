import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { GondolaWaterInteraction } from "../src/water/v2/GondolaWaterInteraction";
import { CANAL_DEFAULTS } from "../src/water/v2/Presets";
import type { HeightfieldAdapter } from "../src/water/simulation/HeightfieldAdapter";
function fixture() {
  const drops: { point: Vector3; strength: number; radius: number }[] = [];
  const sim = {
    createRipple: (point: Vector3, strength: number, radius: number) =>
      drops.push({ point: point.clone(), strength, radius }),
  } as Pick<HeightfieldAdapter, "createRipple">;
  return { drops, sim, interaction: new GondolaWaterInteraction() };
}
describe("Water V2 gondola displacement", () => {
  it("places four world-space hull contacts and conserves displaced volume", () => {
    const { drops, sim, interaction } = fixture();
    interaction.update(
      new Vector3(10, 0, 20),
      new Vector3(1, 0, 0),
      1.55,
      sim,
      CANAL_DEFAULTS,
    );
    expect(drops).toHaveLength(8);
    expect(interaction.positions.bow.x).toBeCloseTo(14.95);
    expect(interaction.positions.stern.x).toBeCloseTo(5.15);
    expect(interaction.positions.left.z).toBeCloseTo(19.07);
    expect(interaction.positions.right.z).toBeCloseTo(20.93);
    expect(drops.reduce((s, d) => s + d.strength, 0)).toBeCloseTo(0, 12);
    expect(drops.every((d) => d.radius < 0.5)).toBe(true);
  });
  it("stopping stops new emissions without clearing the existing simulation", () => {
    const { drops, sim, interaction } = fixture(),
      p = new Vector3(),
      f = new Vector3(0, 0, -1);
    interaction.update(p, f, 1.55, sim, CANAL_DEFAULTS);
    for (let i = 0; i < 300; i++)
      interaction.update(p, f, 0, sim, CANAL_DEFAULTS);
    expect(drops).toHaveLength(8);
    expect(interaction.velocity.length()).toBe(0);
  });
  it("scales disturbance with speed and does not emit more at a higher frame rate", () => {
    const slow = fixture(),
      fast = fixture(),
      f = new Vector3(0, 0, -1);
    slow.interaction.update(new Vector3(), f, 0.775, slow.sim, CANAL_DEFAULTS);
    fast.interaction.update(new Vector3(), f, 1.55, fast.sim, CANAL_DEFAULTS);
    expect(slow.drops[0].strength).toBeCloseTo(fast.drops[0].strength * 0.5);
    for (let i = 0; i < 240; i++)
      fast.interaction.update(new Vector3(), f, 1.55, fast.sim, CANAL_DEFAULTS);
    expect(fast.drops).toHaveLength(8);
  });
  it("old ripple coordinates remain fixed after turning or moving the boat", () => {
    const { drops, sim, interaction } = fixture(),
      p = new Vector3(),
      f = new Vector3(0, 0, -1);
    interaction.update(p, f, 1.55, sim, CANAL_DEFAULTS);
    const old = drops[0].point.clone();
    p.set(1, 0, -1);
    f.set(1, 0, 0);
    interaction.update(p, f, 1.55, sim, CANAL_DEFAULTS);
    expect(drops[0].point.toArray()).toEqual(old.toArray());
    expect(drops.at(-2)!.point.x).toBeCloseTo(-3.85);
  });
});
