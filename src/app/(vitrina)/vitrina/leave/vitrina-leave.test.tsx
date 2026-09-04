import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ANGAJATI } from "@/demo/lume";

import { VitrinaConcedii } from "./vitrina-leave";

/**
 * Poarta anti-minciună. Precedentul din casă: vinieta-fluturaș a desenat un
 * inel INVIZIBIL în producție, fără nicio eroare, fiindcă nimic nu verifica
 * randarea. Un demo cu date fabricate n-are, din oficiu, o astfel de poartă.
 */
describe("vitrina de concedii", () => {
  it("randează toți angajații lumii fictive", () => {
    render(<VitrinaConcedii azi="2026-03-10" />);
    for (const angajat of ANGAJATI) {
      // `getAllByText`, nu `getByText`: numele apare și în coloana de nume, și în
      // descrierea `sr-only` a fiecărei celule cu absență a omului — un angajat
      // cu absențe apare de 5-6 ori în DOM, iar `getByText` ar arunca pe el.
      expect(screen.getAllByText(new RegExp(angajat.nume)).length).toBeGreaterThan(0);
    }
  });

  it("randează absențe, nu starea goală", () => {
    render(<VitrinaConcedii azi="2026-03-10" />);
    // Proiectul nu are `@testing-library/jest-dom` instalat, deci `toBeInTheDocument`
    // nu există aici — convenția din `src/components/**/*.test.tsx` e `.toBeNull()`
    // pe rezultatul lui `queryByText` (ex. `bara-filtre.test.tsx:137`).
    expect(screen.queryByText(/Nicio absență de echipă/)).toBeNull();
  });

  it("se mută odată cu luna primită", () => {
    render(<VitrinaConcedii azi="2027-11-15" />);
    // Componenta nu scrie numele lunii nicăieri. Singura urmă a lunii pe ecran e
    // data din descrierea celulelor cu absență, în forma `DD.MM.AAAA`
    // (`descriereCelula`, src/domain/leave/planificator.ts:176-180).
    expect(screen.getAllByText(/\d{2}\.11\.2027/).length).toBeGreaterThan(0);
  });
});
