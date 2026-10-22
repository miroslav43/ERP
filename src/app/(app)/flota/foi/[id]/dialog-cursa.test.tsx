// src/app/(app)/flota/foi/[id]/dialog-cursa.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `../../actions-curse` e un modul `"use server"`: importat, trage după el
  `createAction` și `server-only`. Se înlocuiește cu spioni: ce se verifică aici
  e ce PLEACĂ din casetă, nu ce face serverul.
*/
const adaugaCursa = vi.fn();
const actualizeazaCursa = vi.fn();
vi.mock("../../actions-curse", () => ({
  adaugaCursa: (...a: unknown[]) => adaugaCursa(...a),
  actualizeazaCursa: (...a: unknown[]) => actualizeazaCursa(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/foi/f1",
}));

import { golesteToasturi } from "@/components/ui/toast";
import type { CursaFoaie, PropunereCursa, SablonTraseu } from "@/domain/fleet/foaie";

import { DialogCursa } from "./dialog-cursa";

/**
 * Ce apără fișierul: caseta cursei după 0200.
 *
 * - propune ce acceptă baza (km de la sosirea cursei precedente, locul unde s-a
 *   ajuns), ca omul să vadă cifra înainte de a salva;
 * - șablonul precompletează locurile, scopul și km estimați — câmpurile sunt
 *   necontrolate, deci fără remontare (`key`) alegerea n-ar schimba nimic;
 * - golul de la km pleacă `""` (schema îl face „lipsește” / „pe drum”), nu 0;
 * - când ultima cursă e pe drum, butonul e dezactivat.
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

const FOAIE = "f1f1f1f1-1111-4111-8111-111111111111";

const propunere: PropunereCursa = {
  kmPlecare: 10100,
  dupa: "2026-10-05T08:30:00.000Z",
  deLaLoc: "Client Câmpina",
  blocata: false,
};

const sabloane: readonly SablonTraseu[] = [
  {
    id: "s1",
    denumire: "Câmpina — Sediu",
    de_la_loc: "Câmpina",
    pana_la_loc: "Sediu",
    scop: "Întoarcere",
    km_estimat: 35,
  },
];

function camp(eticheta: RegExp): HTMLInputElement {
  return screen.getByLabelText(eticheta) as HTMLInputElement;
}

async function deschideSiTrimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  adaugaCursa.mockReset();
  adaugaCursa.mockResolvedValue({ ok: true, data: { id: "c1" } });
  actualizeazaCursa.mockReset();
  actualizeazaCursa.mockResolvedValue({ ok: true, data: { id: "c1" } });
});

describe("DialogCursa", () => {
  it("cursa nouă propune km și locul unde s-a ajuns; golurile pleacă ca șir gol", async () => {
    render(<DialogCursa foaieId={FOAIE} cursa={null} propunere={propunere} sabloane={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Cursă nouă/ }));

    expect(camp(/Km la plecare/).value).toBe("10100");
    expect(camp(/De la/).value).toBe("Client Câmpina");
    // Ora României a sosirii precedente: 08:30 UTC = 11:30 în octombrie.
    expect(camp(/^Plecare/).value).toBe("2026-10-05T11:30");

    fireEvent.change(camp(/Până la/), { target: { value: "Sediu" } });
    fireEvent.change(camp(/Scopul/), { target: { value: "Întoarcere" } });
    await deschideSiTrimite();

    expect(adaugaCursa).toHaveBeenCalledTimes(1);
    expect(adaugaCursa.mock.calls[0]?.[0]).toMatchObject({
      trip_sheet_id: FOAIE,
      km_plecare: "10100",
      km_sosire: "",
      sosire_la: "",
      de_la_loc: "Client Câmpina",
      pana_la_loc: "Sediu",
      sablon_id: null,
    });
  });

  it("șablonul precompletează locurile, scopul și km de sosire estimați", async () => {
    render(<DialogCursa foaieId={FOAIE} cursa={null} propunere={propunere} sabloane={sabloane} />);
    fireEvent.click(screen.getByRole("button", { name: /Cursă nouă/ }));

    fireEvent.change(screen.getByLabelText(/Din șablon/), { target: { value: "s1" } });

    expect(camp(/De la/).value).toBe("Câmpina");
    expect(camp(/Până la/).value).toBe("Sediu");
    expect(camp(/Scopul/).value).toBe("Întoarcere");
    expect(camp(/Km la sosire/).value).toBe("10135");

    await deschideSiTrimite();
    expect(adaugaCursa.mock.calls[0]?.[0]).toMatchObject({ sablon_id: "s1", km_sosire: "10135" });
  });

  it("ultima cursă e pe drum: „Cursă nouă” e dezactivat", () => {
    render(
      <DialogCursa
        foaieId={FOAIE}
        cursa={null}
        propunere={{ ...propunere, blocata: true }}
        sabloane={[]}
      />,
    );
    expect((screen.getByRole("button", { name: /Cursă nouă/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("corectura pleacă pe `actualizeazaCursa`, cu cifrele cursei", async () => {
    const cursa: CursaFoaie = {
      id: "c7",
      ordine: 1,
      plecare_la: "2026-10-05T05:00:00.000Z",
      sosire_la: "2026-10-05T06:00:00.000Z",
      de_la_loc: "Sediu",
      pana_la_loc: "Depozit",
      scop: "Aprovizionare",
      km_plecare: 10000,
      km_sosire: 10040,
      km_parcursi: 40,
    };
    render(<DialogCursa foaieId={FOAIE} cursa={cursa} propunere={propunere} sabloane={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Modifică cursa/ }));
    expect(camp(/Km la sosire/).value).toBe("10040");

    await deschideSiTrimite();
    expect(adaugaCursa).not.toHaveBeenCalled();
    expect(actualizeazaCursa.mock.calls[0]?.[0]).toMatchObject({
      id: "c7",
      trip_sheet_id: FOAIE,
      km_plecare: "10000",
      km_sosire: "10040",
      sosire_la: "2026-10-05T09:00",
    });
    // 0217: fără selector (implicit), încadrarea nu pleacă, deci nu se suprascrie.
    expect(screen.queryByLabelText(/RO e-Transport/)).toBeNull();
    expect(actualizeazaCursa.mock.calls[0]?.[0]).not.toHaveProperty("e_transport");
  });

  it("0217: cu selectorul, încadrarea cursei e preselectată și pleacă la corectură", async () => {
    const cursa = {
      id: "c8",
      ordine: 1,
      plecare_la: "2026-10-05T05:00:00.000Z",
      sosire_la: "2026-10-05T06:00:00.000Z",
      de_la_loc: "Sediu",
      pana_la_loc: "Vama Nădlac",
      scop: "Export",
      km_plecare: 10000,
      km_sosire: 10040,
      km_parcursi: 40,
      e_transport: "international" as const,
    };
    render(
      <DialogCursa
        foaieId={FOAIE}
        cursa={cursa}
        propunere={propunere}
        sabloane={[]}
        arataETransport
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Modifică cursa/ }));
    const selector = screen.getByLabelText(/RO e-Transport/) as HTMLSelectElement;
    expect(selector.value).toBe("international");
    expect(screen.getByText(/nu declară nimic la ANAF/)).toBeTruthy();

    fireEvent.change(selector, { target: { value: "risc_fiscal_national" } });
    await deschideSiTrimite();
    expect(actualizeazaCursa.mock.calls[0]?.[0]).toMatchObject({
      id: "c8",
      e_transport: "risc_fiscal_national",
    });
  });
});
