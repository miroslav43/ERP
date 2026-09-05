// src/app/(app)/angajati/nou/_components/campuri-obligatorii.test.ts
//
// Steluța „(obligatoriu)" din formular trebuie să spună ADEVĂRUL despre ce
// refuză schema. Lipsa ei pe un câmp cerut e cel mai ieftin fel de a face pe
// cineva să piardă un pas întreg: completează tot, apasă „Continuă", și abia
// atunci află că trebuia și buletinul.
//
// Testul NU repetă lista de câmpuri: o DERIVĂ din `inroleazaAngajatSchema`,
// parsând un obiect gol și adunând ce se plânge. Așa, un câmp devenit
// obligatoriu mâine sparge testul până când primește și steluța — în loc să
// treacă tăcut, cum a trecut până acum.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { inroleazaAngajatSchema } from "@/schemas/employee";

const DIRECTOR = join(process.cwd(), "src/app/(app)/angajati/nou/_components");

/** Cheile pe care schema le refuză când lipsesc dintr-un obiect gol. */
function campuriObligatorii(): readonly string[] {
  const rezultat = inroleazaAngajatSchema.safeParse({});
  if (rezultat.success) return [];
  return [
    ...new Set(
      rezultat.error.issues.filter((i) => i.path.length === 1).map((i) => String(i.path[0])),
    ),
  ].sort();
}

/**
 * Eticheta de deschidere a fiecărui `<Camp …>` din pașii asistentului.
 *
 * Se merge caracter cu caracter în loc de o expresie regulată: atributele
 * conțin acolade cu apeluri (`erori={mesajCamp(errors.cnp)}`), iar un `>` din
 * interiorul lor ar tăia eticheta la mijloc și ar ascunde un `obligatoriu`
 * scris mai jos.
 */
function eticheteCamp(): readonly string[] {
  const etichete: string[] = [];
  for (const fisier of readdirSync(DIRECTOR).filter((f) => f.startsWith("pas-"))) {
    const sursa = readFileSync(join(DIRECTOR, fisier), "utf8");
    let i = sursa.indexOf("<Camp");
    while (i !== -1) {
      let adancime = 0;
      let j = i;
      while (j < sursa.length) {
        const c = sursa[j];
        if (c === "{") adancime += 1;
        else if (c === "}") adancime -= 1;
        else if (c === ">" && adancime === 0) break;
        j += 1;
      }
      etichete.push(sursa.slice(i, j));
      i = sursa.indexOf("<Camp", j);
    }
  }
  return etichete;
}

describe("steluța de obligatoriu din asistentul de înrolare", () => {
  const obligatorii = campuriObligatorii();
  const etichete = eticheteCamp();

  it("schema chiar impune câmpuri — altfel testul ar trece în gol", () => {
    expect(obligatorii.length).toBeGreaterThan(10);
    expect(etichete.length).toBeGreaterThan(20);
  });

  it.each(obligatorii)("„%s” are steluță în formular", (camp) => {
    const eticheta = etichete.find((e) => e.includes(`nume="${camp}"`));
    // Un câmp obligatoriu care nu apare deloc în asistent e o altă problemă,
    // dar tot o problemă: omul n-are unde să-l completeze.
    expect(eticheta, `„${camp}” nu apare în niciun pas al asistentului`).toBeDefined();
    expect(eticheta, `„${camp}” e obligatoriu în schemă, dar n-are steluță`).toContain(
      "obligatoriu",
    );
  });

  /*
   * Câmpuri pe care SCHEMA le acceptă goale, dar fără de care se rupe o funcție
   * mai jos. NU primesc steluță — ar fi o minciună, formularul chiar trece mai
   * departe fără ele — ci un indiciu care spune CE se rupe. Fiecare are dovada
   * în cod, nu o presupunere.
   */
  it.each([
    ["cod_cor", "REGES", "domain/reges/validare.ts — verificaContract refuză fără cod COR"],
    ["iban", "bancar", "domain/payroll/bancar/sepa.ts — ordinul fără IBAN e respins"],
    ["functie", "documentele", "lib/documents/valori-inrolare.ts — rubrica rămâne goală"],
  ])("„%s” spune ce se rupe fără el (%s)", (camp) => {
    const eticheta = etichete.find((e) => e.includes(`nume="${camp}"`));
    expect(eticheta, `„${camp}” nu apare în asistent`).toBeDefined();
    expect(eticheta, `„${camp}” n-are indiciu despre ce blochează`).toContain("ajutor=");
  });
});
