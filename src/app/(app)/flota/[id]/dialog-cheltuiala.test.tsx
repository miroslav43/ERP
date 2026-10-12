// src/app/(app)/flota/[id]/dialog-cheltuiala.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Acțiunea e mimată (modul `"use server"`); baza din cloud n-are 0203, deci nu se poate verifica în browser. */
const adaugaCheltuiala = vi.fn();
vi.mock("../actions-service", () => ({
  adaugaCheltuiala: (...a: unknown[]) => adaugaCheltuiala(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/x",
}));

import { golesteToasturi } from "@/components/ui/toast";

import { DialogCheltuiala } from "./dialog-cheltuiala";

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

function deschide(): void {
  render(<DialogCheltuiala vehiculId={VEHICUL} azi="2026-10-12" />);
  fireEvent.click(screen.getByRole("button", { name: /Cheltuială nouă/u }));
}

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  adaugaCheltuiala.mockReset();
  adaugaCheltuiala.mockResolvedValue({ ok: true, data: { id: "c1" } });
});

describe("DialogCheltuiala", () => {
  it("pornește de la azi și de la „Parcare”; litrii nu se văd", () => {
    deschide();
    expect((screen.getByLabelText(/^Data/u) as HTMLInputElement).value).toBe("2026-10-12");
    expect((screen.getByLabelText(/Categoria/u) as HTMLSelectElement).value).toBe("parcare");
    expect(screen.queryByLabelText(/^Litri/u)).toBeNull();
  });

  it("litrii apar doar la „Combustibil fără foaie” și pleacă în încărcătură", async () => {
    deschide();
    fireEvent.change(screen.getByLabelText(/Categoria/u), {
      target: { value: "combustibil_fara_foaie" },
    });
    fireEvent.change(screen.getByLabelText(/^Litri/u), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText(/Suma/u), { target: { value: "300.50" } });
    await trimite();

    expect(adaugaCheltuiala.mock.calls[0]?.[0]).toStrictEqual({
      vehicle_id: VEHICUL,
      categorie: "combustibil_fara_foaie",
      data_cheltuielii: "2026-10-12",
      suma: "300.50",
      litri: "40",
      km_bord: "",
      numar_document: "",
      observatii: "",
    });
  });

  it("suma lipsă pleacă goală, ca schema să-i spună „Scrieți suma”, nu 0 lei", async () => {
    deschide();
    await trimite();
    expect(adaugaCheltuiala.mock.calls[0]?.[0]).toMatchObject({ suma: "" });
  });
});
