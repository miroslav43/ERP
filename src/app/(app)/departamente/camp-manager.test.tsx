// src/app/(app)/departamente/camp-manager.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CampManager } from "./camp-manager";
import type { OptiuneAngajat } from "./tipuri";

/**
 * Bifa asta dezleagă o scriere pe fișa altcuiva: un om pleacă dintr-un
 * departament și intră în altul, iar efectivul vechi scade cu unu. Condiția care
 * o face să apară e deci singura piesă de interfață din modul care poate,
 * greșită, să mute pe cineva fără ca nimeni să fi cerut asta.
 *
 * Cazurile de mai jos apără cele două erori simetrice:
 *
 *  - bifa apare unde NU trebuie ⇒ formularul cere consimțământ pentru o mutare
 *    care nu are loc, iar omul învață să bifeze din reflex;
 *  - bifa NU apare unde trebuie ⇒ `FormData` n-o conține, schema o citește
 *    `false`, și managerul rămâne pe card fără să fie în listă. Adică exact
 *    defectul raportat, întors pe ușa din dos.
 */

const PRODUCTIE = "d-productie";
const VANZARI = "d-vanzari";

const ANGAJATI: readonly OptiuneAngajat[] = [
  {
    id: "e-1",
    full_name: "Pop Radu",
    departamentId: VANZARI,
    departamentDenumire: "Vânzări",
    conduceDepartamentulCurent: false,
  },
  {
    id: "e-2",
    full_name: "Marin Elena",
    departamentId: null,
    departamentDenumire: null,
    conduceDepartamentulCurent: false,
  },
  {
    id: "e-3",
    full_name: "Nistor Vlad",
    departamentId: PRODUCTIE,
    departamentDenumire: "Producție",
    conduceDepartamentulCurent: false,
  },
  {
    id: "e-4",
    full_name: "Barbu Alexandra",
    departamentId: "d-ascuns",
    departamentDenumire: null,
    conduceDepartamentulCurent: false,
  },
  // Membru în „Vânzări” ȘI managerul lui: mutarea îl scoate din departament, iar
  // triggerul `internal.sef_iese_din_departament` (0143) golește acolo managerul.
  {
    id: "e-5",
    full_name: "Ionescu Dan",
    departamentId: VANZARI,
    departamentDenumire: "Vânzări",
    conduceDepartamentulCurent: true,
  },
];

function randeaza(managerInitial: string | null = null, departamentId: string | null = PRODUCTIE) {
  return render(
    <CampManager
      idc={(sufix) => `test-${sufix}`}
      erori={[]}
      angajati={ANGAJATI}
      departamentId={departamentId}
      numeDepartament="Producție"
      managerInitial={managerInitial}
    />,
  );
}

const bifa = (): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>('input[name="muta_managerul_in_departament"]');

describe("CampManager", () => {
  it("nu cere nimic cât timp managerul e „— nedesemnat —”", () => {
    randeaza();
    expect(bifa()).toBeNull();
  });

  it("nu cere nimic pentru un manager NEREPARTIZAT", () => {
    // Nu se pierde nicio apartenență, deci nu e nimic de confirmat: serverul îl
    // repartizează tăcut. O bifă aici ar cere permisiunea de a nu strica nimic.
    randeaza("e-2");
    expect(bifa()).toBeNull();
  });

  it("nu cere nimic pentru un manager DEJA membru al departamentului", () => {
    randeaza("e-3");
    expect(bifa()).toBeNull();
  });

  it("cere confirmarea pentru un manager din ALT departament, și spune de unde", () => {
    randeaza("e-1");
    const b = bifa();
    expect(b).not.toBeNull();
    // Pornită: asta așteaptă omul. Consimțământul rămâne totuși unul TRIMIS —
    // schema nu presupune nimic dacă lipsește. Vezi `consimtamantMutareManager`.
    expect(b?.defaultChecked).toBe(true);
    expect(screen.getByText(/Vânzări/u)).toBeTruthy();
  });

  it("apare și dispare pe măsură ce se schimbă alegerea", () => {
    randeaza("e-1");
    expect(bifa()).not.toBeNull();

    const select = document.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "e-2" } });
    expect(bifa()).toBeNull();

    fireEvent.change(select, { target: { value: "e-1" } });
    expect(bifa()).not.toBeNull();
  });

  it("la CREARE tratează orice om repartizat drept venit din altă parte", () => {
    // `departamentId={null}`: departamentul nu există încă. Chiar și cineva din
    // „Producție" vine, aici, dintr-un departament care nu e ăsta.
    randeaza("e-3", null);
    expect(bifa()).not.toBeNull();
  });

  it("nu inventează „nerepartizat” pentru un departament ascuns de RLS", () => {
    // `departamentId` există, `departamentDenumire` e null: omul E undeva, doar
    // că apelantul nu poate vedea unde. Mutarea rămâne o mutare, deci se cere.
    randeaza("e-4");
    expect(bifa()).not.toBeNull();
    expect(screen.getByText(/alt departament/u)).toBeTruthy();
  });

  it("pentru un manager care CONDUCE departamentul din care pleacă, spune că acela rămâne fără manager", () => {
    // Consecința triggerului `internal.sef_iese_din_departament` (0143): cine e
    // scos din departamentul pe care îl conduce nu-l mai conduce. Bifa rămâne
    // pornită — QA a cerut avertisment, nu blocaj (ADM-014) — dar efectul se
    // spune ÎNAINTE de apăsare, nu se descoperă pe card, după.
    randeaza("e-5");
    expect(bifa()).not.toBeNull();
    expect(bifa()?.defaultChecked).toBe(true);
    expect(screen.getByText(/rămâne fără manager/u)).toBeTruthy();
    expect(screen.getByText(/Este și managerul departamentului „Vânzări”/u)).toBeTruthy();
  });

  it("pentru un membru simplu din alt departament NU vorbește despre manager rămas", () => {
    // Propoziția ar fi falsă: departamentul lui are alt șef, sau niciunul, iar
    // mutarea nu atinge `departments.manager_employee_id` acolo.
    randeaza("e-1");
    expect(bifa()).not.toBeNull();
    expect(screen.queryByText(/rămâne fără manager/u)).toBeNull();
  });
});
