// src/app/(app)/flota/foi/[id]/uit-cursa.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `../uit/actions` e un modul `"use server"`: importat, trage după el
  `createAction` și `server-only`. Se înlocuiește cu spioni: ce se verifică aici
  e ce PLEACĂ din casetă și ce vede omul înainte de salvare.
*/
const adaugaUit = vi.fn();
const actualizeazaUit = vi.fn();
const stergeUit = vi.fn();
vi.mock("../uit/actions", () => ({
  adaugaUit: (...a: unknown[]) => adaugaUit(...a),
  actualizeazaUit: (...a: unknown[]) => actualizeazaUit(...a),
  stergeUit: (...a: unknown[]) => stergeUit(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/foi/f1",
}));

import { golesteToasturi } from "@/components/ui/toast";

import { UitCursa } from "./uit-cursa";

function asiguraDialogNativ(): void {
  const proto = globalThis.HTMLDialogElement?.prototype;
  if (proto === undefined) return;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function () {
      this.open = true;
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function () {
      this.open = false;
    };
  }
}
asiguraDialogNativ();

const FOAIE = "f1f1f1f1-1111-4111-8111-111111111111";
const CURSA = "c1c1c1c1-1111-4111-8111-111111111111";

const valabil = {
  id: "u1",
  uit: "3V0P0L0P0T3JUW46",
  data_inceput: "2026-10-20",
  valabilitate_zile: 5,
  observatii: null,
};
const expirat = {
  id: "u2",
  uit: "4C0U0C0J0W3DDQ92",
  data_inceput: "2026-10-01",
  valabilitate_zile: 5,
  observatii: "De la furnizor.",
};

beforeEach(() => {
  golesteToasturi();
  adaugaUit.mockReset();
  adaugaUit.mockResolvedValue({ ok: true, data: { id: "u9" } });
  actualizeazaUit.mockReset();
  actualizeazaUit.mockResolvedValue({ ok: true, data: { id: "u1" } });
  stergeUit.mockReset();
});

describe("UitCursa", () => {
  it("lista: codul în grupe de patru și starea în ziua foii; fără butoane pe foaia de citit", () => {
    render(
      <UitCursa
        foaieId={FOAIE}
        cursaId={CURSA}
        ziuaFoii="2026-10-21"
        uituri={[valabil, expirat]}
        editabil={false}
      />,
    );
    expect(screen.getByText("3V0P 0L0P 0T3J UW46")).toBeTruthy();
    expect(screen.getByText("Valabil")).toBeTruthy();
    expect(screen.getByText("Expirat din 06.10.2026")).toBeTruthy();
    expect(screen.getByText("De la furnizor.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Adaugă UIT/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Șterge codul UIT/ })).toBeNull();
  });

  it("codul tastat de pe hârtie se arată normalizat înainte de salvare și pleacă așa cum l-a scris omul", async () => {
    render(<UitCursa foaieId={FOAIE} cursaId={CURSA} ziuaFoii="2026-10-21" uituri={[]} editabil />);
    fireEvent.click(screen.getByRole("button", { name: /Adaugă UIT/ }));

    const cod = screen.getByLabelText(/Codul UIT/) as HTMLInputElement;
    fireEvent.change(cod, { target: { value: "3vop-olop otej.uw46" } });
    expect(screen.getByText(/Am citit:/).textContent).toContain("3V0P 0L0P 0TEJ UW46");

    fireEvent.change(cod, { target: { value: "3vop-0l0p 0t3j.uw46" } });
    expect(screen.getByText(/Am citit:/).textContent).toContain("format valid");
    // Data de început pornește din ziua foii.
    expect((screen.getByLabelText(/Data începerii/) as HTMLInputElement).value).toBe("2026-10-21");

    await act(async () => {
      fireEvent.submit(document.querySelector("form")!);
    });
    expect(adaugaUit).toHaveBeenCalledTimes(1);
    expect(adaugaUit.mock.calls[0]?.[0]).toMatchObject({
      trip_sheet_id: FOAIE,
      cursa_id: CURSA,
      uit: "3vop-0l0p 0t3j.uw46",
      data_inceput: "2026-10-21",
      valabilitate_zile: "5",
    });
  });

  it("cifrele de control greșite se spun la tastare", () => {
    render(<UitCursa foaieId={FOAIE} cursaId={CURSA} ziuaFoii="2026-10-21" uituri={[]} editabil />);
    fireEvent.click(screen.getByRole("button", { name: /Adaugă UIT/ }));
    fireEvent.change(screen.getByLabelText(/Codul UIT/), {
      target: { value: "3V0P0L0P0T3JUW47" },
    });
    expect(screen.getByText(/Am citit:/).textContent).toContain(
      "ultimele două cifre nu se potrivesc",
    );
  });

  it("o dată departe de ziua foii primește nota nemodală", () => {
    render(<UitCursa foaieId={FOAIE} cursaId={CURSA} ziuaFoii="2026-10-21" uituri={[]} editabil />);
    fireEvent.click(screen.getByRole("button", { name: /Adaugă UIT/ }));
    fireEvent.change(screen.getByLabelText(/Data începerii/), { target: { value: "2062-10-21" } });
    expect(screen.getByText(/departe de ziua foii/)).toBeTruthy();
  });

  it("corectura nu poartă codul: doar data, valabilitatea și observația", async () => {
    render(
      <UitCursa
        foaieId={FOAIE}
        cursaId={CURSA}
        ziuaFoii="2026-10-21"
        uituri={[valabil]}
        editabil
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Modifică codul UIT 3V0P 0L0P 0T3J UW46/ }));
    // Titlul casetei poartă codul; câmpul lui nu există.
    expect(document.querySelector('input[name="uit"]')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Valabilitatea/), { target: { value: "15" } });
    await act(async () => {
      fireEvent.submit(document.querySelector("form")!);
    });
    expect(actualizeazaUit.mock.calls[0]?.[0]).toEqual({
      id: "u1",
      trip_sheet_id: FOAIE,
      data_inceput: "2026-10-20",
      valabilitate_zile: "15",
      observatii: "",
    });
  });
});
