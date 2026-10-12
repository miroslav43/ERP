// src/app/(app)/flota/[id]/dialog-intrare-service.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `../actions-service` e un modul `"use server"`: importat, trage după el
  `createAction` și deci `server-only`, care aruncă la import în proiectul `ui`.
  Se înlocuiește cu un spion: ce se verifică aici e ce PLEACĂ din casetă, nu ce
  face serverul. Verificarea în browser nu e posibilă pe ramura asta: baza din
  cloud n-are 0203.
*/
const adaugaIntrareService = vi.fn();
vi.mock("../actions-service", () => ({
  adaugaIntrareService: (...argumente: unknown[]) => adaugaIntrareService(...argumente),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/x",
}));

import { golesteToasturi } from "@/components/ui/toast";
import type { PlanService } from "@/lib/queries/fleet-service";

import { DialogIntrareService } from "./dialog-intrare-service";

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
const PLAN = "22222222-2222-4222-8222-222222222222";
const ALT_PLAN = "33333333-3333-4333-8333-333333333333";

const plan = (id: string, denumire: string, tip: PlanService["tip"]): PlanService => ({
  id,
  vehicle_id: VEHICUL,
  denumire,
  tip,
  interval_km: 10000,
  interval_luni: 12,
  baza_data: "2026-01-01",
  baza_km: 40000,
  ultima_data: "2026-01-01",
  ultimii_km: 40000,
  urmatoarea_data: "2027-01-01",
  urmatorii_km: 50000,
  prag_avertizare_km: 1000,
  activ: true,
  observatii: null,
});

const planuri = [
  plan(PLAN, "Revizie periodică", "revizie"),
  plan(ALT_PLAN, "Schimb anvelope", "anvelope"),
];

function deschide(props: Partial<React.ComponentProps<typeof DialogIntrareService>> = {}): void {
  render(
    <DialogIntrareService
      vehiculId={VEHICUL}
      kmCurent={46500}
      pragSalt={1500}
      azi="2026-10-12"
      planuri={planuri}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Intervenție nouă/u }));
}

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  adaugaIntrareService.mockReset();
  adaugaIntrareService.mockResolvedValue({ ok: true, data: { id: "i1" } });
});

describe("DialogIntrareService", () => {
  it("precompletează data de azi și kilometrajul vehiculului", () => {
    deschide();
    expect((screen.getByLabelText(/Data intervenției/u) as HTMLInputElement).value).toBe(
      "2026-10-12",
    );
    expect((screen.getByLabelText(/Kilometraj la bord/u) as HTMLInputElement).value).toBe("46500");
  });

  it("trimite totul ca TEXT, cu golul gol: schema face coerciția, nu caseta", async () => {
    deschide();
    fireEvent.change(screen.getByLabelText(/Ce s-a lucrat/u), {
      target: { value: "Ulei, filtre" },
    });
    fireEvent.change(screen.getByLabelText(/Cost piese/u), { target: { value: "300" } });
    await trimite();

    expect(adaugaIntrareService).toHaveBeenCalledTimes(1);
    expect(adaugaIntrareService.mock.calls[0]?.[0]).toStrictEqual({
      vehicle_id: VEHICUL,
      plan_id: "",
      data_interventiei: "2026-10-12",
      km: "46500",
      tip: "revizie",
      descriere: "Ulei, filtre",
      furnizor: "",
      numar_factura: "",
      cost_piese: "300",
      cost_manopera: "",
      anvelope_montate: "",
      observatii: "",
    });
  });

  it("sub kilometrajul vehiculului: o spune pe câmp, fără să blocheze", () => {
    deschide();
    fireEvent.change(screen.getByLabelText(/Kilometraj la bord/u), { target: { value: "30000" } });
    expect(screen.getByText(/Sub kilometrajul vehiculului \(46\.500 km\)/u)).toBeTruthy();
  });

  it("peste prag: avertizează că kilometrajul vehiculului va urca", () => {
    deschide();
    fireEvent.change(screen.getByLabelText(/Kilometraj la bord/u), { target: { value: "52000" } });
    expect(screen.getByText(/Cu 5\.500 km peste kilometrajul vehiculului/u)).toBeTruthy();
  });

  it("anvelopele montate apar doar la tipul „Anvelope” și pleacă în încărcătură", async () => {
    deschide();
    expect(screen.queryByLabelText(/Anvelope montate după lucrare/u)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Tipul lucrării/u), { target: { value: "anvelope" } });
    fireEvent.change(screen.getByLabelText(/Anvelope montate după lucrare/u), {
      target: { value: "iarna" },
    });
    fireEvent.change(screen.getByLabelText(/Ce s-a lucrat/u), { target: { value: "Schimb" } });
    await trimite();

    expect(adaugaIntrareService.mock.calls[0]?.[0]).toMatchObject({
      tip: "anvelope",
      anvelope_montate: "iarna",
    });
  });

  it("alegerea unui plan îi preia tipul lucrării și îl trimite ca plan_id", async () => {
    deschide();
    fireEvent.change(screen.getByLabelText(/Din planul/u), { target: { value: ALT_PLAN } });
    expect((screen.getByLabelText(/Tipul lucrării/u) as HTMLSelectElement).value).toBe("anvelope");
    fireEvent.change(screen.getByLabelText(/Ce s-a lucrat/u), { target: { value: "x y" } });
    await trimite();
    expect(adaugaIntrareService.mock.calls[0]?.[0]).toMatchObject({ plan_id: ALT_PLAN });
  });

  it("din butonul unui plan: planul și tipul vin preselectate, descrierea cu denumirea lui", () => {
    render(
      <DialogIntrareService
        vehiculId={VEHICUL}
        kmCurent={46500}
        pragSalt={1500}
        azi="2026-10-12"
        planuri={planuri}
        planImplicit={planuri[1]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Înregistrează intervenția pentru „Schimb anvelope”",
      }),
    );
    expect((screen.getByLabelText(/Din planul/u) as HTMLSelectElement).value).toBe(ALT_PLAN);
    expect((screen.getByLabelText(/Tipul lucrării/u) as HTMLSelectElement).value).toBe("anvelope");
    expect((screen.getByLabelText(/Ce s-a lucrat/u) as HTMLInputElement).value).toBe(
      "Schimb anvelope",
    );
  });

  it("eroarea P0001 de pe plan ajunge lângă câmpul „Din planul”", async () => {
    adaugaIntrareService.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Planul ales nu aparține acestui vehicul.",
        fieldErrors: { plan_id: ["Planul ales nu aparține acestui vehicul."] },
        requestId: "t",
      },
    });
    deschide();
    fireEvent.change(screen.getByLabelText(/Ce s-a lucrat/u), { target: { value: "x y" } });
    await trimite();
    expect(await screen.findByText("Planul ales nu aparține acestui vehicul.")).toBeTruthy();
    expect(screen.getByLabelText(/Din planul/u).getAttribute("aria-invalid")).toBe("true");
  });
});
