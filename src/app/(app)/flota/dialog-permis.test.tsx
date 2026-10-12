// src/app/(app)/flota/dialog-permis.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `./actions-soferi` e un modul `"use server"`: se înlocuiește cu spioni. Ce se
  verifică aici e ce PLEACĂ din casetă (cheile schemei, bifele multiple) și că
  reînnoirea scrie pe ACELAȘI permis.
*/
const adaugaPermis = vi.fn();
const actualizeazaPermis = vi.fn();
vi.mock("./actions-soferi", () => ({
  adaugaPermis: (...a: unknown[]) => adaugaPermis(...a),
  actualizeazaPermis: (...a: unknown[]) => actualizeazaPermis(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/angajati/a1",
}));

import { golesteToasturi } from "@/components/ui/toast";

import { DialogPermis } from "./dialog-permis";

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

const ANGAJAT = "a1a1a1a1-1111-4111-8111-111111111111";
const PERMIS = "p1p1p1p1-1111-4111-8111-111111111111";

function camp(eticheta: RegExp): HTMLInputElement {
  return screen.getByLabelText(eticheta) as HTMLInputElement;
}

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  adaugaPermis.mockReset();
  adaugaPermis.mockResolvedValue({ ok: true, data: { id: PERMIS } });
  actualizeazaPermis.mockReset();
  actualizeazaPermis.mockResolvedValue({ ok: true, data: { id: PERMIS } });
});

describe("DialogPermis", () => {
  it("înregistrarea trimite cheile schemei și TOATE categoriile bifate", async () => {
    render(<DialogPermis employeeId={ANGAJAT} numeAngajat="Ana Pop" permis={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Înregistrează permisul/ }));

    fireEvent.change(camp(/Numărul permisului/), { target: { value: "AB123456" } });
    fireEvent.change(camp(/Valabil până la/), { target: { value: "2030-01-10" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "B" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "CE" }));
    await trimite();

    expect(adaugaPermis).toHaveBeenCalledTimes(1);
    expect(adaugaPermis.mock.calls[0]?.[0]).toEqual({
      employee_id: ANGAJAT,
      numar: "AB123456",
      categorii: ["B", "CE"],
      eliberat_la: "",
      expira_la: "2030-01-10",
      observatii: "",
    });
    expect(actualizeazaPermis).not.toHaveBeenCalled();
  });

  it("reînnoirea pornește de la permisul existent și scrie pe același id", async () => {
    render(
      <DialogPermis
        employeeId={ANGAJAT}
        numeAngajat="Ana Pop"
        permis={{
          id: PERMIS,
          employee_id: ANGAJAT,
          numar: "AB123456",
          categorii: ["B"],
          eliberat_la: "2020-01-10",
          expira_la: "2030-01-10",
          observatii: null,
          fisier_path: null,
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Reînnoiește sau corectează permisul lui Ana Pop/ }),
    );

    expect(camp(/Numărul permisului/).value).toBe("AB123456");
    expect((screen.getByRole("checkbox", { name: "B" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(camp(/Valabil până la/), { target: { value: "2040-01-10" } });
    await trimite();

    expect(actualizeazaPermis).toHaveBeenCalledTimes(1);
    expect(actualizeazaPermis.mock.calls[0]?.[0]).toMatchObject({
      id: PERMIS,
      employee_id: ANGAJAT,
      categorii: ["B"],
      expira_la: "2040-01-10",
    });
    expect(adaugaPermis).not.toHaveBeenCalled();
  });

  it("eroarea bazei pe categorii ajunge sub grupul de bife", async () => {
    adaugaPermis.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: { categorii: ["Alegeți cel puțin o categorie de permis."] },
        requestId: "t",
      },
    });
    render(<DialogPermis employeeId={ANGAJAT} numeAngajat="Ana Pop" permis={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Înregistrează permisul/ }));
    await trimite();

    expect(screen.getByText("Alegeți cel puțin o categorie de permis.")).toBeTruthy();
  });
});
