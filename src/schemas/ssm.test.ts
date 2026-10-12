// src/schemas/ssm.test.ts
//
// Fișa de aptitudine: valabilitatea nu poate fi anterioară examinării.
// QA 8 oct 2026, HR-017 — o fișă „expirată" la 01.01.2026 pentru un examen
// din 10.09.2026 se salva fără nicio obiecție și intra în raportul de expirări.

import { describe, expect, it } from "vitest";

import { fisaAptitudineSchema } from "./ssm";

const FISA = {
  employee_id: "66666666-6666-4666-8666-666666666666",
  tip: "periodic",
  data_examinarii: "2026-09-10",
  rezultat: "apt",
};

describe("fisaAptitudineSchema — valabil_pana față de data_examinarii", () => {
  it("valabilitatea anterioară examinării: issue pe `valabil_pana`", () => {
    const r = fisaAptitudineSchema.safeParse({ ...FISA, valabil_pana: "2026-01-01" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "valabil_pana");
    expect(issue?.message).toContain("anterioară datei examinării");
  });

  it("valabilitatea egală cu data examinării trece", () => {
    expect(fisaAptitudineSchema.safeParse({ ...FISA, valabil_pana: "2026-09-10" }).success).toBe(
      true,
    );
  });

  it("valabilitatea ulterioară trece", () => {
    expect(fisaAptitudineSchema.safeParse({ ...FISA, valabil_pana: "2027-09-10" }).success).toBe(
      true,
    );
  });

  it("valabilitatea goală devine null și trece", () => {
    const r = fisaAptitudineSchema.safeParse({ ...FISA, valabil_pana: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.valabil_pana).toBeNull();
  });
});
