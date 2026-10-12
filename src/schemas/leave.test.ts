// src/schemas/leave.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { creeazaCerereSchema } from "./leave";

const TIP = "11111111-1111-4111-8111-111111111111";

const BAZA = {
  employee_id: null,
  leave_type_id: TIP,
  data_inceput: "2026-11-02",
  data_sfarsit: "2026-11-06",
};

const eroriPe = (intrare: unknown) => {
  const rezultat = creeazaCerereSchema.safeParse(intrare);
  expect(rezultat.success).toBe(false);
  return z.flattenError(rezultat.error as z.ZodError).fieldErrors as Record<
    string,
    string[] | undefined
  >;
};

/**
 * UX-040: pe câmpul gol apăreau două propoziții lipite de `<Camp>` —
 * „…în formatul AAAA-LL-ZZ. Anul datei de început este în afara intervalului
 * acceptat.” Prima cerea un format pe care omul nu-l vede (caseta arată
 * zz.ll.aaaa), a doua n-avea sens pentru un câmp gol.
 */
describe("cererea de concediu — mesajele datelor", () => {
  it("baza e validă", () => {
    expect(creeazaCerereSchema.safeParse(BAZA).success).toBe(true);
  });

  it("data de început goală: un singur mesaj, în formatul vizibil", () => {
    const mesaje = eroriPe({ ...BAZA, data_inceput: "" })["data_inceput"] ?? [];
    expect(mesaje).toHaveLength(1);
    expect(mesaje[0]).toContain("zz.ll.aaaa");
    expect(mesaje[0]).not.toContain("AAAA-LL-ZZ");
    expect(mesaje[0]).not.toContain("intervalului");
  });

  it("ambele date goale: câte un singur mesaj pe fiecare câmp", () => {
    const erori = eroriPe({ ...BAZA, data_inceput: "", data_sfarsit: "" });
    expect(erori["data_inceput"]).toEqual(["Introduceți data de început (zz.ll.aaaa)."]);
    expect(erori["data_sfarsit"]).toEqual(["Introduceți data de sfârșit (zz.ll.aaaa)."]);
  });

  it("un an din 1990 e refuzat în continuare, cu mesajul despre an", () => {
    const mesaje = eroriPe({ ...BAZA, data_inceput: "1990-01-01" })["data_inceput"] ?? [];
    expect(mesaje).toEqual(["Anul datei de început este în afara intervalului acceptat."]);
  });
});
