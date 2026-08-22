// src/domain/payroll/breakdown-etichete.test.ts
//
// Testul care împiedică reapariția unui defect deja întâmplat.
//
// Fluturașul afișează `calc_breakdown` rând cu rând, cu
// `ETICHETE_PAS[pas.pas] ?? pas.pas`. Fallback-ul face ca un pas fără etichetă
// să apară pe un document oficial ca o cheie tehnică — „sporRepaus" în loc de
// „Ore lucrate în zile de repaus săptămânal". Nu produce nicio eroare, deci nu
// se observă până când îl vede un angajat.
//
// S-a întâmplat: motorul a primit șapte pași noi (indemnizații, baze separate,
// avantaje în natură, rest de plată) fără ca fluturașul să știe de ei.
//
// Ambele fișiere se citesc ca TEXT, deliberat: componenta e o componentă React
// cu importuri de UI, iar testul trebuie să ruleze fără DOM și fără să tragă
// după el jumătate din aplicație.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MOTOR = join(process.cwd(), "src/domain/payroll/calc.ts");
const FLUTURAS = join(process.cwd(), "src/components/payroll/fluturas.tsx");

/** Pașii pe care motorul îi înregistrează prin `inregistreaza("...")`. */
function pasiiMotorului(): readonly string[] {
  const sursa = readFileSync(MOTOR, "utf8");
  const gasiti = [...sursa.matchAll(/inregistreaza\(\s*"([a-zA-Z]+)"/g)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1]],
  );
  return [...new Set(gasiti)];
}

/** Cheile din `ETICHETE_PAS`, citite tot ca text. */
function eticheteleFluturasului(): ReadonlySet<string> {
  const sursa = readFileSync(FLUTURAS, "utf8");
  const bloc = /const ETICHETE_PAS: Record<string, string> = \{([\s\S]*?)\n\};/.exec(sursa);
  if (bloc === null) throw new Error("Nu am găsit ETICHETE_PAS în fluturas.tsx.");
  return new Set(
    [...(bloc[1] ?? "").matchAll(/^\s*([a-zA-Z]+):/gm)].flatMap((m) =>
      m[1] === undefined ? [] : [m[1]],
    ),
  );
}

describe("fluturașul cunoaște toți pașii motorului", () => {
  it("nu s-a putut citi zero pași — altfel testul ar trece fals-pozitiv", () => {
    expect(pasiiMotorului().length).toBeGreaterThan(15);
    expect(eticheteleFluturasului().size).toBeGreaterThan(15);
  });

  it("fiecare pas înregistrat de motor are o etichetă în română", () => {
    const etichete = eticheteleFluturasului();
    const fara = pasiiMotorului().filter((pas) => !etichete.has(pas));
    expect(
      fara,
      `Pași fără etichetă — ar apărea pe fluturaș ca chei tehnice: ${fara.join(", ")}`,
    ).toEqual([]);
  });

  it("breakdown-ul conține DOAR sume în lei, niciodată ore sau zile", () => {
    // Fluturașul formatează fiecare valoare cu `formatLei`. Un număr de ore
    // strecurat în breakdown s-ar tipări drept „8,00 lei" pe un document pe
    // care angajatul îl semnează.
    const suspecte = pasiiMotorului().filter((pas) => /^(ore|zile|nr)/i.test(pas));
    expect(suspecte, `Pași care nu par sume în lei: ${suspecte.join(", ")}`).toEqual([]);
  });
});
