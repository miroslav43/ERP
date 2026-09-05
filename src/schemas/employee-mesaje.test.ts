// src/schemas/employee-mesaje.test.ts
//
// Mesajele de validare ale înrolării sunt citite de un om care tocmai a
// completat șase pași. „Invalid input: expected string, received undefined" nu
// e un mesaj: e un raport despre tipuri, în engleză, care nu spune nici ce
// câmp, nici ce trebuia scris acolo.
//
// Testul apără două lucruri deodată: că niciun câmp obligatoriu nu cade pe
// mesajul implicit al lui Zod, și că motivele calculate de validatoare
// (`validateazaCnp`, `validateazaIban`) ajung la om în loc să fie înlocuite cu
// „nu este valid".
import { describe, expect, it } from "vitest";

import { inroleazaAngajatSchema } from "@/schemas/employee";

/** Urmele mesajelor implicite ale lui Zod, toate în engleză. */
const IMPLICITE_ZOD = [
  "Invalid input",
  "Expected",
  "expected string",
  "received undefined",
  "Required",
  "Invalid enum value",
];

const BAZA_VALIDA = {
  first_name: "Ion",
  last_name: "Popescu",
  // CNP cu cifra de control CORECTĂ, calculată cu cheia 279146358279.
  cnp: "1960229123452",
  numar_act: "123456",
  act_eliberat_de: "SPCLEP Cluj",
  act_eliberat_la: "2020-01-01",
  reges_tip_act: "CarteIdentitate",
  serie_act: "CJ",
  adresa_strada: "Str. Memorandumului 1",
  adresa_oras: "Cluj-Napoca",
  adresa_judet: "Cluj",
  hired_on: "2026-01-01",
  data_contract: "2026-01-01",
  valabil_de_la: "2026-01-01",
  salariu_baza: 4000,
};

describe("mesajele de validare ale înrolării", () => {
  it("niciun câmp lipsă nu cade pe mesajul implicit al lui Zod", () => {
    const rezultat = inroleazaAngajatSchema.safeParse({});
    expect(rezultat.success).toBe(false);
    if (rezultat.success) return;

    const gresite = rezultat.error.issues
      .filter((i) => IMPLICITE_ZOD.some((urma) => i.message.includes(urma)))
      .map((i) => `${String(i.path.join("."))}: ${i.message}`);

    expect(gresite, `câmpuri cu mesaj implicit englezesc:\n${gresite.join("\n")}`).toStrictEqual(
      [],
    );
  });

  it("fiecare mesaj de câmp lipsă numește câmpul", () => {
    const rezultat = inroleazaAngajatSchema.safeParse({});
    if (rezultat.success) throw new Error("schema n-a refuzat obiectul gol");

    for (const problema of rezultat.error.issues) {
      // Fie numește câmpul între ghilimele românești, fie e un mesaj propriu
      // care spune ce trebuie ales („Alegeți tipul actului…").
      expect(
        problema.message.includes("„") || /^[A-ZȘȚĂÂÎ]/u.test(problema.message),
        `mesaj fără subiect pentru „${String(problema.path.join("."))}": ${problema.message}`,
      ).toBe(true);
    }
  });

  it("CNP-ul greșit spune DE CE, nu doar că nu e valid", () => {
    // Cifră de control stricată: ultima cifră schimbată.
    const rezultat = inroleazaAngajatSchema.safeParse({ ...BAZA_VALIDA, cnp: "1960229123453" });
    if (rezultat.success) throw new Error("CNP-ul stricat a trecut");

    const mesaj = rezultat.error.issues.find((i) => i.path[0] === "cnp")?.message ?? "";
    expect(mesaj).not.toBe("CNP-ul introdus nu este valid.");
    expect(mesaj.toLowerCase()).toContain("control");
  });

  it("CNP-ul prea scurt spune câte cifre trebuie", () => {
    const rezultat = inroleazaAngajatSchema.safeParse({ ...BAZA_VALIDA, cnp: "123" });
    if (rezultat.success) throw new Error("CNP-ul scurt a trecut");

    const mesaj = rezultat.error.issues.find((i) => i.path[0] === "cnp")?.message ?? "";
    expect(mesaj).toContain("13");
  });

  it("IBAN-ul greșit spune lungimea așteptată", () => {
    const rezultat = inroleazaAngajatSchema.safeParse({
      ...BAZA_VALIDA,
      iban: "RO49AAAA1B31007593840000XX",
    });
    if (rezultat.success) throw new Error("IBAN-ul stricat a trecut");

    const mesaj = rezultat.error.issues.find((i) => i.path[0] === "iban")?.message ?? "";
    expect(mesaj).not.toBe("IBAN-ul introdus nu este valid.");
    expect(mesaj).toContain("24");
  });

  it("baza validă chiar trece — altfel testele de mai sus n-ar dovedi nimic", () => {
    expect(inroleazaAngajatSchema.safeParse(BAZA_VALIDA).success).toBe(true);
  });
});

describe("pachetul salarial declarat la înrolare", () => {
  const cu = (peste: Record<string, unknown>) =>
    inroleazaAngajatSchema.safeParse({ ...BAZA_VALIDA, ...peste });

  const componenta = (peste: Record<string, unknown> = {}) => ({
    component_type_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "spor_suma",
    procent: null,
    suma: 500,
    ...peste,
  });

  it("lipsa lor e o stare validă — majoritatea angajaților n-au niciuna", () => {
    const r = cu({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.componente_salariale).toStrictEqual([]);
      expect(r.data.scutiri_fiscale).toStrictEqual([]);
    }
  });

  it("o primă fixă cu sumă trece", () => {
    expect(cu({ componente_salariale: [componenta()] }).success).toBe(true);
  });

  it("o primă fixă FĂRĂ sumă e refuzată, cu mesaj despre sumă", () => {
    const r = cu({ componente_salariale: [componenta({ suma: null })] });
    if (r.success) throw new Error("componenta fără sumă a trecut");
    const problema = r.error.issues.find((i) => i.path.includes("suma"));
    expect(problema?.message).toContain("sumă fixă");
  });

  it("un spor PROCENTUAL fără procent e refuzat, cu mesaj despre procent", () => {
    const r = cu({
      componente_salariale: [componenta({ kind: "spor_procent", suma: null, procent: null })],
    });
    if (r.success) throw new Error("sporul fără procent a trecut");
    const problema = r.error.issues.find((i) => i.path.includes("procent"));
    expect(problema?.message).toContain("procent");
  });

  it("scutirea cere un tip din listă, nu un text oarecare", () => {
    const bun = cu({ scutiri_fiscale: [{ exemption_type: "constructii" }] });
    expect(bun.success).toBe(true);

    const rau = cu({ scutiri_fiscale: [{ exemption_type: "inventat" }] });
    if (rau.success) throw new Error("tipul inventat a trecut");
    expect(rau.error.issues.some((i) => i.message.includes("Alegeți tipul de scutire"))).toBe(true);
  });

  it("plafonul lunar are interval, iar mesajul îl spune", () => {
    const r = cu({
      scutiri_fiscale: [{ exemption_type: "it", plafon_lunar: 9_000_000 }],
    });
    if (r.success) throw new Error("plafonul absurd a trecut");
    const problema = r.error.issues.find((i) => i.path.includes("plafon_lunar"));
    expect(problema?.message).toContain("1.000.000");
  });
});
