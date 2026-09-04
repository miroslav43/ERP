import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { angajatiVizibili } from "@/demo/roluri";

import { VitrinaConcedii } from "./vitrina-leave";

/**
 * Poarta anti-minciună. Precedentul din casă: vinieta-fluturaș a desenat un
 * inel INVIZIBIL în producție, fără nicio eroare, fiindcă nimic nu verifica
 * randarea. Un demo cu date fabricate n-are, din oficiu, o astfel de poartă.
 */
describe("vitrina de concedii", () => {
  it("randează toți angajații vizibili administratorului, rolul implicit", () => {
    render(<VitrinaConcedii azi="2026-03-10" />);
    for (const angajat of angajatiVizibili("org_admin")) {
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

  it("comutatorul de rol schimbă cine apare pe calendar", async () => {
    // `@testing-library/jest-dom` nu e instalat: `toBeInTheDocument()` nu
    // există aici — vezi comentariul de mai sus. Numele apare de mai multe ori
    // în DOM (coloana de nume + `sr-only` per celulă de absență), deci
    // `getByText`/`queryByText` ar arunca „found multiple elements” — se
    // folosește `getAllByText`/`queryAllByText`, la fel ca în testul de mai sus.
    const { default: userEvent } = await import("@testing-library/user-event");
    const utilizator = userEvent.setup();
    render(<VitrinaConcedii azi="2026-03-10" />);

    expect(screen.getAllByText(/Toma Gabriela/).length).toBeGreaterThan(0);

    await utilizator.click(screen.getByRole("button", { name: "Angajat" }));

    expect(screen.queryAllByText(/Toma Gabriela/)).toHaveLength(0);
    expect(screen.getAllByText(/Popescu Ion/).length).toBeGreaterThan(0);
  });
});
