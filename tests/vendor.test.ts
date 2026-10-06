import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import manifest from "../docs/water-source-manifest.json";
it("retains the four actual 5194 water/environment modules without rewriting them", () => {
  for (const f of manifest.files) {
    const bytes = readFileSync(
      new URL("../src/water/v2/vendor/waterthreejs/" + f.file, import.meta.url),
    );
    expect(createHash("sha256").update(bytes).digest("hex"), f.file).toBe(
      f.sha256,
    );
  }
});
