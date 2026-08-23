// src/components/ui/bara-filtre.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inlocuieste = vi.fn<(adresa: string) => void>();
let parametriCurenti = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: inlocuieste, push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/angajati",
  useSearchParams: () => parametriCurenti,
}));

import { BaraFiltre } from "./bara-filtre";

/**
 * Regula pe care o apără fișierul: bara nu poate șterge decât cheile care i-au
 * fost declarate. Restul supraviețuiesc.
 *
 * Defectul era real în șase module și s-a agravat odată cu tabelele noi: după
 * ce listele au primit `sort` și `limita`, orice apăsare pe „Filtrează" le
 * arunca pe amândouă, iar utilizatorul își pierdea ordinea aleasă fără nicio
 * indicație că s-a întâmplat ceva.
 */

const CHEI = ["status", "departament"] as const;

function randeaza(adresa: string) {
  parametriCurenti = new URLSearchParams(adresa);
  inlocuieste.mockClear();
  return render(
    <BaraFiltre active={[{ cheie: "status", eticheta: "Stare: activ" }]} cheiProprii={[...CHEI]}>
      <input name="status" aria-label="Stare" defaultValue={parametriCurenti.get("status") ?? ""} />
      <input name="departament" aria-label="Departament" defaultValue="" />
    </BaraFiltre>,
  );
}

/** Ultima adresă cerută, ca `URLSearchParams`. */
function ultimaAdresa(): URLSearchParams {
  const apel = inlocuieste.mock.calls.at(-1)?.[0] ?? "";
  return new URLSearchParams(apel.split("?")[1] ?? "");
}

describe("BaraFiltre — cheile străine supraviețuiesc", () => {
  beforeEach(() => {
    inlocuieste.mockClear();
  });

  it("trimiterea păstrează `sort` și `limita`, pe care bara nu le cunoaște", () => {
    const { container } = randeaza("status=activ&sort=-nume&limita=50");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    const p = ultimaAdresa();
    expect(p.get("sort")).toBe("-nume");
    expect(p.get("limita")).toBe("50");
  });

  it("cursorul de paginare NU supraviețuiește — ar continua de la un rând ieșit din rezultat", () => {
    const { container } = randeaza("cursor=abc123&sort=nume");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    const p = ultimaAdresa();
    expect(p.get("cursor")).toBeNull();
    expect(p.get("sort")).toBe("nume");
  });

  it("un câmp golit își șterge cheia, nu o lasă goală în adresă", () => {
    const { container } = randeaza("status=activ&sort=nume");
    fireEvent.change(screen.getByLabelText("Stare"), { target: { value: "" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(ultimaAdresa().has("status")).toBe(false);
  });

  it("spațiile din jurul valorii nu ajung în adresă", () => {
    const { container } = randeaza("");
    fireEvent.change(screen.getByLabelText("Departament"), { target: { value: "  Producție  " } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(ultimaAdresa().get("departament")).toBe("Producție");
  });
});

describe("BaraFiltre — pastilele", () => {
  it("ștergerea unei pastile atinge doar cheia ei", () => {
    randeaza("status=activ&departament=prod&sort=nume");
    fireEvent.click(screen.getByRole("button", { name: /Șterge filtrul/ }));
    const p = ultimaAdresa();
    expect(p.has("status")).toBe(false);
    expect(p.get("departament")).toBe("prod");
    expect(p.get("sort")).toBe("nume");
  });

  it("«Șterge toate filtrele» nu șterge sortarea — nu e un filtru", () => {
    randeaza("status=activ&departament=prod&sort=nume&limita=50");
    fireEvent.click(screen.getByRole("button", { name: "Șterge toate filtrele" }));
    const p = ultimaAdresa();
    expect(p.has("status")).toBe(false);
    expect(p.has("departament")).toBe(false);
    expect(p.get("sort")).toBe("nume");
    expect(p.get("limita")).toBe("50");
  });

  it("fără filtre active, bara nu arată nici pastile, nici butonul de golire", () => {
    parametriCurenti = new URLSearchParams();
    render(
      <BaraFiltre active={[]} cheiProprii={[...CHEI]}>
        <input name="status" aria-label="Stare" />
      </BaraFiltre>,
    );
    expect(screen.queryByText("Filtre active:")).toBeNull();
  });
});
