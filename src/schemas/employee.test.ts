// src/schemas/employee.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  actualizeazaAngajatSchema,
  CAMPURI_EDITABILE_ANGAJAT,
  mutaAngajatiSchema,
} from "./employee";

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

/**
 * Schema mutării între departamente.
 *
 * Contrastul cu testele de mai sus e chiar ideea ei: `actualizeazaAngajatSchema`
 * are 36 de câmpuri și trebuie apărată cu o poartă care numără mulțimi, fiindcă
 * orice cheie lipsă golește o coloană. Schema asta are DOUĂ câmpuri, deci nu are
 * ce goli — și de-asta mutarea nu trece prin cealaltă.
 */
describe("mutaAngajatiSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("respinge lista goală de angajați", () => {
    expect(mutaAngajatiSchema.safeParse({ employee_ids: [], department_id: null }).success).toBe(
      false,
    );
  });

  it("respinge un identificator care nu e UUID", () => {
    expect(
      mutaAngajatiSchema.safeParse({ employee_ids: ["nu-e-uuid"], department_id: null }).success,
    ).toBe(false);
  });

  it("acceptă department_id null — scoaterea din departament", () => {
    expect(
      mutaAngajatiSchema.safeParse({ employee_ids: [UUID], department_id: null }).success,
    ).toBe(true);
  });

  it("pune department_id pe null când lipsește din intrare", () => {
    expect(mutaAngajatiSchema.parse({ employee_ids: [UUID] }).department_id).toBeNull();
  });

  it("respinge un department_id care nu e UUID", () => {
    expect(
      mutaAngajatiSchema.safeParse({ employee_ids: [UUID], department_id: "primul" }).success,
    ).toBe(false);
  });

  it("deduplică identificatorii repetați", () => {
    // Handler-ul compară numărul de rânduri întoarse de `.in("id", …)` cu
    // lungimea listei, ca să prindă un refuz parțial al politicii. Cu `[X, X]`
    // baza întoarce UN rând iar lungimea e doi, deci o scriere perfect reușită
    // ar fi raportată drept refuz („nu aveți dreptul"). Din interfață nu se
    // poate întâmpla — selecția e un `Set` — dar acțiunea e un endpoint POST
    // invocabil direct.
    const rezultat = mutaAngajatiSchema.parse({ employee_ids: [UUID, UUID, UUID] });
    expect(rezultat.employee_ids).toEqual([UUID]);
  });

  it("plafonează mutarea în masă la 200", () => {
    const prea = Array.from({ length: 201 }, () => UUID);
    expect(mutaAngajatiSchema.safeParse({ employee_ids: prea, department_id: null }).success).toBe(
      false,
    );
    const exact = Array.from({ length: 200 }, () => UUID);
    expect(mutaAngajatiSchema.safeParse({ employee_ids: exact, department_id: null }).success).toBe(
      true,
    );
  });
});

/**
 * Cealaltă jumătate a porții — cea pe care antetul de mai sus o promitea, dar
 * nu o verifica.
 *
 * `construiestePayload` din `formular-angajat.tsx` parcurge
 * `CAMPURI_EDITABILE_ANGAJAT` și citește `FormData` pentru fiecare cheie. O
 * cheie fără control randat produce ȘIRUL GOL, care ajunge la schemă, devine
 * `null` și SUPRASCRIE valoarea din bază. Nicio eroare: `UPDATE`-ul reușește,
 * doar că golește.
 *
 * Comentariul din formular o spunea în scris — „trebuie să primească și un
 * control randat mai jos, altfel prima salvare îl golește" — și tot s-a
 * întâmplat: `act_eliberat_la` și `reges_tip_act` au fost adăugate în listă
 * fără controale, iar prima salvare a oricărei fișe le-ar fi șters.
 *
 * Testul citește FIȘIERUL, nu randează componenta: proiectul `ui` din
 * `vitest.config.mts` acoperă doar `src/components/`, iar pentru pagini unealta
 * e Playwright. Aici e de ajuns o potrivire de `nume="…"`, fiindcă `<Camp>` e
 * singurul mod în care formularul randează un control.
 */
describe("formularul de editare randează tot ce trimite", () => {
  const FORMULAR = join(process.cwd(), "src/app/(app)/angajati/formular-angajat.tsx");
  const sursa = readFileSync(FORMULAR, "utf8");

  it("găsește formularul", () => {
    // Fără asta, o redenumire de fișier ar face testul verde pe un șir gol.
    expect(sursa.length).toBeGreaterThan(1000);
  });

  it("fiecare câmp editabil are un control randat", () => {
    // Două forme, amândouă legitime: `<Camp nume="…">` pentru controalele
    // obișnuite și `name="…"` direct pentru bifă, care nu trece prin `Camp` —
    // o casetă de bifat n-are eticheta deasupra, ci lângă ea.
    const fara = CAMPURI_EDITABILE_ANGAJAT.filter(
      (cheie) =>
        !new RegExp(`nume="${cheie}"`, "u").test(sursa) &&
        !new RegExp(`name="${cheie}"`, "u").test(sursa),
    );
    expect(
      fara,
      `Câmpuri trimise de \`construiestePayload\` fără control în formular: ${fara.join(", ")}. ` +
        `Prima salvare le va goli, fără nicio eroare.`,
    ).toEqual([]);
  });
});
