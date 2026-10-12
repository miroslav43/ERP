// src/app/(app)/flota/foi/dialog-foaie-noua.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `../actions` e un modul `"use server"`: importat, trage după el `createAction`
  și deci `server-only`, care aruncă la import în proiectul `ui`. Se înlocuiește
  cu un spion: ce se verifică aici e ce PLEACĂ din casetă, nu ce face serverul.
*/
const creeazaFoaie = vi.fn();
vi.mock("../actions", () => ({
  creeazaFoaie: (...argumente: unknown[]) => creeazaFoaie(...argumente),
}));

const impinge = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: impinge, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/portal/masina-mea",
}));

import { golesteToasturi, ZonaToast } from "@/components/ui/toast";

import { DialogFoaieNoua, type DateFoaieNoua } from "./dialog-foaie-noua";

/**
 * Ce apără fișierul: contractul casetei cu `creeazaFoaie` după 0196.
 *
 * Sub `trip_sheets:create = all` (angajatul și managerul), șoferul NU se
 * alege: `angajati: null` scoate selectorul, iar `employee_id` pleacă `null`,
 * ca acțiunea să rezolve fișa proprie pe server. Cu un selector gol trimis ca
 * `""`, acțiunea ar fi întors „Alegeți șoferul.” pe un câmp care nici nu se
 * vede — un refuz fără ieșire, pe care nici `tsc`, nici testele de acțiune nu-l
 * prind, fiindcă amândouă stau de partea cealaltă a `FormData`.
 */

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

const VEHICUL = "11111111-1111-4111-8111-111111111111";
const ANGAJAT = "22222222-2222-4222-8222-222222222222";

const proprii: DateFoaieNoua = {
  vehicule: [{ id: VEHICUL, nr_inmatriculare: "B123ABC", km_curent: 10500 }],
  angajati: null,
};

const cuSoferi: DateFoaieNoua = {
  vehicule: proprii.vehicule,
  angajati: [{ id: ANGAJAT, full_name: "Ana Șofer", marca: "M-1" }],
};

async function completeazaSiTrimite(): Promise<void> {
  fireEvent.change(screen.getByLabelText(/Plecare/), { target: { value: "2026-10-12T07:30" } });
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  creeazaFoaie.mockReset();
  creeazaFoaie.mockResolvedValue({ ok: true, data: { id: "f1" } });
  impinge.mockClear();
});

describe("DialogFoaieNoua", () => {
  it("fără listă de angajați (șoferul e cel conectat): nu arată selectorul și trimite `null`", async () => {
    render(<DialogFoaieNoua date={proprii} deschisInitial bazaFoaie="/portal/masina-mea/foi" />);

    expect(screen.queryByLabelText(/Șofer/)).toBeNull();
    await completeazaSiTrimite();

    expect(creeazaFoaie).toHaveBeenCalledTimes(1);
    expect(creeazaFoaie.mock.calls[0]?.[0]).toMatchObject({
      vehicle_id: VEHICUL,
      employee_id: null,
      km_plecare: "10500",
    });
  });

  it('cu lista de angajați (administratorul): selectorul e acolo, iar golul pleacă `""`', async () => {
    render(<DialogFoaieNoua date={cuSoferi} deschisInitial />);

    expect(screen.getByLabelText(/Șofer/)).toBeInstanceOf(HTMLSelectElement);
    await completeazaSiTrimite();

    // Golul nu devine `null`: `z.uuid()` îl refuză pe câmp, cu „Alegeți șoferul.”.
    expect(creeazaFoaie.mock.calls[0]?.[0]).toMatchObject({ employee_id: "" });
  });

  it("toastul de reușită duce la foaia din portal, nu la cea din aplicație", async () => {
    render(
      <>
        <DialogFoaieNoua date={proprii} deschisInitial bazaFoaie="/portal/masina-mea/foi" />
        <ZonaToast zona="portal" />
      </>,
    );
    await completeazaSiTrimite();

    fireEvent.click(await screen.findByRole("button", { name: "Deschide ciorna" }));
    expect(impinge).toHaveBeenCalledWith("/portal/masina-mea/foi/f1");
  });

  it("fără nicio mașină: explicația, nu un buton care n-ar duce nicăieri", () => {
    render(<DialogFoaieNoua date={{ vehicule: [], angajati: null }} />);
    expect(screen.queryByRole("button", { name: "Foaie nouă" })).toBeNull();
    expect(screen.getByText(/Nu aveți niciun vehicul alocat/)).toBeTruthy();
  });
});
