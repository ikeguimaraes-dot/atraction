import { describe, it, expect } from "vitest";
import { niches, segmentPack, accountPack } from "../../src/data/niches";
import { demo } from "../../src/lib/demo";
describe("segment presets", () => {
  it("supplies complete five-stage packs for every supported segment", () => {
    for (const [id, pack] of Object.entries(niches)) {
      expect(pack.stages, id).toHaveLength(5);
      expect(new Set(pack.stages).size, id).toBe(5);
      expect(pack.message, id).toContain("{nome}");
      expect(pack.service, id).toBeTruthy();
      expect(pack.robots, id).toHaveLength(3);
    }
    for (const id of ["fintech", "software", "restaurante", "ia", "outro"])
      expect(niches).toHaveProperty(id);
  });
  it("preserves existing deal stages and allows a custom segment name", () => {
    const t = demo().tenant;
    const old = accountPack(t);
    expect(segmentPack(t, "software", "", true).stages).toEqual(old.stages);
    expect(segmentPack(t, "software", "", false).stages).toEqual(
      niches.software.stages,
    );
    expect(segmentPack(t, "outro", "  Logística  ", true).name).toBe(
      "Logística",
    );
    expect(segmentPack(t, "outro", "", false).name).toBe("Outro / Geral");
  });
});
