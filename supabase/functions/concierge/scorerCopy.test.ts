import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// concierge/scorer.ts is a byte-for-byte copy of match-engine/scorer.ts so the
// Concierge's live (unmatched) comparison uses the exact same calculateMatchScore
// as the real match engine. Supabase edge functions have no shared-package
// mechanism, hence the copy. This guard fails loudly if the two drift.
describe("concierge/scorer.ts stays in sync with match-engine/scorer.ts", () => {
  it("is a byte-for-byte copy", () => {
    const base = path.resolve(process.cwd(), "supabase/functions");
    const conciergeCopy = readFileSync(path.join(base, "concierge/scorer.ts"), "utf8");
    const source = readFileSync(path.join(base, "match-engine/scorer.ts"), "utf8");
    expect(conciergeCopy).toBe(source);
  });
});
