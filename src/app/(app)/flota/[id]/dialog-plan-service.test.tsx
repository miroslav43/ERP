// src/app/(app)/flota/[id]/dialog-plan-service.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Acțiunile sunt mimate (modul `"use server"`: trage `server-only`). Se verifică
  ce PLEACĂ din casetă și ce arată ea; verificarea în browser nu e posibilă pe
  ramura asta, fiindcă baza din cloud n-are 0203.
*/
const creeazaPlanService = vi.fn();
const actualizeazaPlanService = vi.fn();
vi.mock("../actions-service", () => ({
  creeazaPlanService: (...a: unknown[]) => creeazaPlanService(...a),
  actualizeazaPlanService: (...a: unknown[]) => actualizeazaPlanService(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/x",
}));

import { golesteToasturi } from "@/components/ui/toast";
import type { PlanService } from "@/lib/queries/fleet-service";

import { DialogPlanService } from "./dialog-plan-service";

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

const existent: PlanService = {
  id: PLAN,
  vehicle_id: VEHICUL,
  denumire: "Revizie periodică",
  tip: "revizie",
  interval_km: 10000,
  interval_luni: 12,
  baza_data: "2026-01-15",
  baza_km: 40000,
  ultima_data: "2026-09-01",
  ultimii_km: 45000,
  urmatoarea_data: "2027-09-01",
  urmatorii_km: 55000,
  prag_avertizare_km: 800,
  activ: true,
  observatii: "Cu ulei sintetic",
};

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  creeazaPlanService.mockReset();
  actualizeazaPlanService.mockReset();
  creeazaPlanService.mockResolvedValue({ ok: true, data: { id: PLAN } });
  actualizeazaPlanService.mockResolvedValue({ ok: true, data: { id: PLAN } });
});

describe("DialogPlanService — plan nou", () => {
  function deschide(): void {
    render(<DialogPlanService vehiculId={VEHICUL} kmCurent={46500} azi="2026-10-12" />);
    fireEvent.click(screen.getByRole("button", { name: /Plan nou/u }));
  }

  it("pornește de la azi și kilometrajul vehiculului; nu are bifa „activ”", () => {
    deschide();
    expect((screen.getByLabelText(/Ultima intervenție — data/u) as HTMLInputElement).value).toBe(
      "2026-10-12",
    );
    expect(
      (screen.getByLabelText(/Ultima intervenție — kilometraj/u) as HTMLInputElement).value,
    ).toBe("46500");
    expect(screen.queryByLabelText(/Planul e activ/u)).toBeNull();
  });

  it("previzualizează următoarea scadență pe măsură ce se completează intervalele", () => {
    deschide();
    expect(screen.getByTestId("previzualizare-scadenta").textContent).toContain(
      "cel puțin un interval",
    );

    fireEvent.change(screen.getByLabelText(/La fiecare \(km\)/u), { target: { value: "10000" } });
    expect(screen.getByTestId("previzualizare-scadenta").textContent).toContain("56.500 km");

    fireEvent.change(screen.getByLabelText(/La fiecare \(luni\)/u), { target: { value: "12" } });
    expect(screen.getByTestId("previzualizare-scadenta").textContent).toContain(
      "12.10.2027 sau 56.500 km",
    );

    fireEvent.change(screen.getByLabelText(/Ultima intervenție — data/u), {
      target: { value: "2026-01-31" },
    });
    fireEvent.change(screen.getByLabelText(/La fiecare \(luni\)/u), { target: { value: "1" } });
    // 31 ianuarie + 1 lună: ultima zi a lunii mai scurte, ca în bază.
    expect(screen.getByTestId("previzualizare-scadenta").textContent).toContain("28.02.2026");
  });

  it("trimite totul ca text; la creare nu pleacă `activ`", async () => {
    deschide();
    fireEvent.change(screen.getByLabelText(/Denumirea planului/u), {
      target: { value: "Revizie periodică" },
    });
    fireEvent.change(screen.getByLabelText(/La fiecare \(km\)/u), { target: { value: "10000" } });
    await trimite();

    expect(creeazaPlanService).toHaveBeenCalledTimes(1);
    expect(creeazaPlanService.mock.calls[0]?.[0]).toStrictEqual({
      vehicle_id: VEHICUL,
      denumire: "Revizie periodică",
      tip: "revizie",
      interval_km: "10000",
      interval_luni: "",
      baza_data: "2026-10-12",
      baza_km: "46500",
      prag_avertizare_km: "",
      observatii: "",
    });
    expect(actualizeazaPlanService).not.toHaveBeenCalled();
  });

  it("refuzul „cel puțin un interval” apare pe ambele câmpuri", async () => {
    const mesaj = "Alegeți cel puțin un interval: în kilometri sau în luni.";
    creeazaPlanService.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: { interval_km: [mesaj], interval_luni: [mesaj] },
        requestId: "t",
      },
    });
    deschide();
    fireEvent.change(screen.getByLabelText(/Denumirea planului/u), { target: { value: "Plan" } });
    await trimite();
    expect((await screen.findAllByText(mesaj)).length).toBe(2);
  });
});

describe("DialogPlanService — corectură", () => {
  function deschide(plan: PlanService = existent): void {
    render(<DialogPlanService vehiculId={VEHICUL} kmCurent={46500} azi="2026-10-12" plan={plan} />);
    fireEvent.click(screen.getByRole("button", { name: /Modifică planul „Revizie periodică”/u }));
  }

  it("afișează valorile planului, cu BAZA (nu ultima derivată) în câmpurile de pornire", () => {
    deschide();
    expect((screen.getByLabelText(/Denumirea planului/u) as HTMLInputElement).value).toBe(
      "Revizie periodică",
    );
    expect((screen.getByLabelText(/Ultima intervenție — data/u) as HTMLInputElement).value).toBe(
      "2026-01-15",
    );
    expect(
      (screen.getByLabelText(/Ultima intervenție — kilometraj/u) as HTMLInputElement).value,
    ).toBe("40000");
    expect((screen.getByLabelText(/Avertizare cu/u) as HTMLInputElement).value).toBe("800");
    expect((screen.getByLabelText(/Planul e activ/u) as HTMLInputElement).checked).toBe(true);
  });

  it("previzualizarea ține cont de intervenția legată, ca triggerul: la deschidere arată scadența din bază", () => {
    deschide();
    // Baza e 15.01.2026 / 40.000 km, dar intervenția legată din 01.09.2026 la
    // 45.000 km a mutat ultima: 12 luni → 01.09.2027, +10.000 km → 55.000 km.
    const text = screen.getByTestId("previzualizare-scadenta").textContent;
    expect(text).toContain("01.09.2027");
    expect(text).toContain("55.000 km");
  });

  it("o bază mai nouă decât intervenția legată trece înaintea ei în previzualizare", () => {
    deschide();
    fireEvent.change(screen.getByLabelText(/Ultima intervenție — data/u), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText(/Ultima intervenție — kilometraj/u), {
      target: { value: "46000" },
    });
    const text = screen.getByTestId("previzualizare-scadenta").textContent;
    expect(text).toContain("01.10.2027");
    expect(text).toContain("56.000 km");
  });

  it("oprirea planului pleacă ca `activ: false`; id-ul și vehiculul sunt în încărcătură", async () => {
    deschide();
    fireEvent.click(screen.getByLabelText(/Planul e activ/u));
    await trimite();

    expect(actualizeazaPlanService).toHaveBeenCalledTimes(1);
    expect(actualizeazaPlanService.mock.calls[0]?.[0]).toMatchObject({
      id: PLAN,
      vehicle_id: VEHICUL,
      activ: false,
      interval_km: "10000",
      interval_luni: "12",
      baza_km: "40000",
    });
    expect(creeazaPlanService).not.toHaveBeenCalled();
  });

  it("un plan oprit se deschide cu bifa debifată", () => {
    deschide({ ...existent, activ: false });
    expect((screen.getByLabelText(/Planul e activ/u) as HTMLInputElement).checked).toBe(false);
  });
});
