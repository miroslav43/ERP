import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { traduEroareCarduri } from "./erori";

function prinde(error: unknown): ActionDenied {
  try {
    traduEroareCarduri(error);
  } catch (e) {
    if (e instanceof ActionDenied) return e;
    throw e;
  }
  throw new Error("traduEroareCarduri n-a aruncat");
}

describe("traduEroareCarduri", () => {
  it.each([
    ["fcard_amprenta_uq", "numar", "Cardul este deja înregistrat."],
    ["fctx_alimentare_uq", "fuel_entry_id", "Alimentarea e deja legată de altă tranzacție."],
    ["fctx_dedup_uq", "cheie_dedup", "Tranzacția a fost deja importată."],
  ])("23505 pe %s → pe câmpul %s", (index, camp, mesaj) => {
    const e = prinde(
      eroarePostgrest("23505", `duplicate key value violates unique constraint "${index}"`),
    );
    expect(e.code).toBe("VALIDARE");
    expect(e.message).toBe(mesaj);
    expect(e.fieldErrors).toEqual({ [camp]: [mesaj] });
  });

  it.each([
    [
      "Vehiculul ales pentru card nu aparține organizației dumneavoastră sau nu mai e în parc.",
      "tinta",
    ],
    ["Șoferul ales pentru card nu aparține organizației dumneavoastră.", "tinta"],
    ["Numărul unui card nu se schimbă. Anulați cardul și înregistrați-l pe cel nou.", "numar"],
    ["Spuneți de ce ignorați tranzacția.", "nota"],
  ])("P0001 „%s” cade pe câmpul %s, cu mesajul bazei", (mesaj, camp) => {
    const e = prinde(eroarePostgrest("P0001", mesaj));
    expect(e.code).toBe("VALIDARE");
    expect(e.fieldErrors).toEqual({ [camp]: [mesaj] });
  });

  it("P0001 fără câmp: CONFLICT, cu mesajul bazei (cifrele rămân)", () => {
    const mesaj =
      "Datele din extras nu se modifică. Anulați importul și reimportați fișierul corectat.";
    const e = prinde(eroarePostgrest("P0001", mesaj));
    expect(e.code).toBe("CONFLICT");
    expect(e.message).toBe(mesaj);
  });

  it("restul trece mai departe neatins, la traducerea generică", () => {
    const brut = eroarePostgrest("42501", "new row violates row-level security policy");
    expect(() => traduEroareCarduri(brut)).toThrow(expect.objectContaining({ code: "42501" }));
  });
});
