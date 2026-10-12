// src/schemas/mesaje-data.test.ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { marcheazaTransmisSchema, propunePlecareSchema } from "@/app/(app)/reges/constante";

import { creeazaAngajatSchema, creeazaContractSchema } from "./employee";
import { creeazaEvaluareSchema } from "./evaluation";
import { setariSalarizareSchema } from "./payroll";
import { cheltuialaNouaSchema, politicaNouaSchema } from "./per-diem";

/**
 * Mesajele de format ale datelor (UX-026, ONB-033).
 *
 * Ecranul arată data ca „zz.ll.aaaa” (`IntrareData`), dar mesajul de eroare
 * cerea „formatul AAAA-LL-ZZ” — un format pe care utilizatorul nu-l vede
 * nicăieri și nu-l poate tasta în caseta vizibilă. Valoarea trimisă rămâne ISO;
 * se schimbă doar ce i se spune omului.
 */

const GRESIT = "12.10.2026";

function mesajPe(schema: z.ZodType, intrare: Record<string, unknown>, camp: string): string {
  const r = schema.safeParse(intrare);
  expect(r.success).toBe(false);
  if (r.success) return "";
  const issue = r.error.issues.find((i) => i.path[0] === camp);
  expect(issue, `nicio problemă pe „${camp}”`).toBeDefined();
  return issue?.message ?? "";
}

const CAZURI: readonly (readonly [string, z.ZodType, string])[] = [
  ["angajat — dată opțională", creeazaAngajatSchema, "data_nasterii"],
  ["contract — dată obligatorie", creeazaContractSchema, "data_contract"],
  ["evaluare", creeazaEvaluareSchema, "data_evaluarii"],
  ["salarizare — setări", setariSalarizareSchema, "valabil_de_la"],
  ["diurnă — cheltuială", cheltuialaNouaSchema, "data_cheltuielii"],
  ["diurnă — politică", politicaNouaSchema, "valabil_de_la"],
  ["REGES — transmis la", marcheazaTransmisSchema, "transmisLa"],
  ["REGES — început", propunePlecareSchema, "dataInceput"],
  ["REGES — sfârșit", propunePlecareSchema, "dataSfarsit"],
];

describe("mesajele de format ale datelor", () => {
  it.each(CAZURI)("%s: cere zz.ll.aaaa, nu AAAA-LL-ZZ", (_nume, schema, camp) => {
    const mesaj = mesajPe(schema, { [camp]: GRESIT }, camp);
    expect(mesaj).toContain("zz.ll.aaaa");
    expect(mesaj).not.toContain("AAAA-LL-ZZ");
    expect(mesaj.endsWith(".")).toBe(true);
  });
});
