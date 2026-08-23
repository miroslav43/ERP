// src/schemas/employee.test.ts
import { describe, expect, it } from "vitest";

import { actualizeazaAngajatSchema, CAMPURI_EDITABILE_ANGAJAT } from "./employee";

/**
 * Poarta care apără fișa de personal de o ștergere tăcută.
 *
 * `actualizeazaAngajatSchema` e un `.pick()` din schema de creare, iar câmpurile
 * picate își păstrează `.default(...)`. Consecința, măsurată pe cod real: dintr-un
 * obiect cu 13 chei trimis de formular, Zod scotea 34, iar handler-ul le trimitea
 * pe toate la `.update()`. Cele 22 pe care formularul nu le arăta se scriau ca
 * `null` — adresa, actul de identitate, contactul de urgență, starea civilă,
 * managerul direct — sau reveneau la implicit („RO", „normale", pilonul II bifat).
 * Nicio eroare: `UPDATE`-ul reușea, doar că golea.
 *
 * Testele de mai jos nu verifică o convenție de stil. Verifică faptul că lista
 * pe care o parcurge formularul și mulțimea de chei pe care schema le scrie sunt
 * ACEEAȘI mulțime. Când cineva adaugă un câmp în `.pick()` fără să-i dea un
 * control, testul pică aici, nu producția peste o lună.
 */
describe("actualizeazaAngajatSchema", () => {
  it("acceptă exact câmpurile pe care formularul de editare le parcurge, plus id", () => {
    const dinSchema = Object.keys(actualizeazaAngajatSchema.shape).sort();
    const dinFormular = [...CAMPURI_EDITABILE_ANGAJAT, "id"].sort();
    expect(dinSchema).toStrictEqual(dinFormular);
  });

  it("substituie implicitele pentru orice cheie absentă — de aceea lista trebuie să fie completă", () => {
    const rezultat = actualizeazaAngajatSchema.safeParse({
      id: "3f5e1a2b-8c4d-4e6f-9a1b-2c3d4e5f6a7b",
      last_name: "Popescu",
      first_name: "Ion",
    });
    expect(rezultat.success).toBe(true);
    if (!rezultat.success) return;

    // Dovada comportamentului, nu o dorință: o cheie lipsă NU rămâne absentă din
    // ieșire, deci nu poate însemna „lasă coloana neatinsă" la un UPDATE.
    expect(Object.keys(rezultat.data).length).toBe(CAMPURI_EDITABILE_ANGAJAT.length + 1);
    expect(rezultat.data.adresa_strada).toBeNull();
    expect(rezultat.data.manager_employee_id).toBeNull();
    expect(rezultat.data.contact_urgenta_nume).toBeNull();
    expect(rezultat.data.cetatenie).toBe("RO");
    expect(rezultat.data.conditii_munca).toBe("normale");
  });
});
