// src/app/(app)/cursuri/biblioteca/nou/asistent-material.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AsistentMaterial } from "./asistent-material";

/**
 * Pasul 4 al asistentului e un PROCES, nu un câmp: creează rândul, semnează
 * încărcarea, urcă octeții, verifică semnătura. Defectul ADM-016 a stat exact
 * în ordinea pașilor: rândul se crea ÎNAINTE ca fișierul să fie verificat, iar
 * la un fișier respins omul rămânea cu un material „Lipsă” în bibliotecă și cu
 * un Callout care îi spunea că „nu s-a scris nimic”. La a doua apăsare se
 * crea încă un rând — pe producție, 23505 pe `course_materials_cod_uk`.
 *
 * Cazurile de aici fixează cele trei garanții: fișierul greșit e respins LA
 * ALEGERE, fără scriere; după un eșec de după creare se continuă pe rândul
 * creat, nu se face altul; iar textul de pe ecran spune ce s-a întâmplat.
 *
 * `../../actions` e un modul `"use server"` care trage după el `server-only`,
 * iar `useRouter` cere contextul App Router. Aici se verifică ce se DESENEAZĂ
 * și ce se CHEAMĂ, nu ce scrie serverul.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const creeazaMaterial = vi.fn();
const pregatesteIncarcareMaterial = vi.fn();
const salveazaVersiuneFisier = vi.fn();
const renuntaLaIncarcare = vi.fn();
const salveazaVersiuneLink = vi.fn();
vi.mock("../../actions", () => ({
  creeazaMaterial: (...a: unknown[]) => creeazaMaterial(...a) as unknown,
  pregatesteIncarcareMaterial: (...a: unknown[]) => pregatesteIncarcareMaterial(...a) as unknown,
  salveazaVersiuneFisier: (...a: unknown[]) => salveazaVersiuneFisier(...a) as unknown,
  renuntaLaIncarcare: (...a: unknown[]) => renuntaLaIncarcare(...a) as unknown,
  salveazaVersiuneLink: (...a: unknown[]) => salveazaVersiuneLink(...a) as unknown,
}));

const urcaPeUrlSemnat = vi.fn();
vi.mock("@/lib/storage/urca-semnat", () => ({
  urcaPeUrlSemnat: (...a: unknown[]) => urcaPeUrlSemnat(...a) as unknown,
}));

const MATERIAL_ID = "11111111-1111-4111-8111-111111111111";
const CALE = "org/11111111-1111-4111-8111-111111111111/v1.pdf";

/** `happy-dom` nu deschide dialogul sistemului: punem `files` și declanșăm `change`. */
function alege(input: HTMLInputElement, fisier: File): void {
  Object.defineProperty(input, "files", { value: [fisier], configurable: true });
  fireEvent.change(input);
}

function maiDeparte(): void {
  fireEvent.click(screen.getByRole("button", { name: "Mai departe" }));
}

/** Pașii 1–3 cu valori valide: PDF, titlu și cod, treapta „bifă”. */
function panaLaPasul4(): void {
  render(<AsistentMaterial />);
  maiDeparte();
  fireEvent.change(screen.getByLabelText(/^Titlu/u), { target: { value: "Regulament intern" } });
  fireEvent.change(screen.getByLabelText(/^Cod/u), { target: { value: "regulament_intern" } });
  maiDeparte();
  maiDeparte();
  expect(screen.getByRole("heading", { name: "Conținutul" })).toBeTruthy();
}

const campulFisier = (): HTMLInputElement =>
  screen.getByLabelText(/Document PDF/u) as HTMLInputElement;

const butonulSalveaza = (): HTMLButtonElement =>
  screen.getByRole("button", { name: "Salvează materialul" }) as HTMLButtonElement;

async function apasaSalveaza(): Promise<void> {
  await act(async () => {
    fireEvent.click(butonulSalveaza());
  });
}

const PDF = () => new File(["%PDF-1.4 x"], "regulament.pdf", { type: "application/pdf" });

function serverulCareCreeazaSiPregateste(): void {
  creeazaMaterial.mockResolvedValue({ ok: true, data: { id: MATERIAL_ID } });
  pregatesteIncarcareMaterial.mockResolvedValue({
    ok: true,
    data: { urlSemnat: "https://exemplu.supabase.co/semnat", cale: CALE },
  });
  urcaPeUrlSemnat.mockResolvedValue(true);
  renuntaLaIncarcare.mockResolvedValue({ ok: true, data: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AsistentMaterial — pasul 4 nu lasă în urmă un material fără conținut", () => {
  it("un .exe ales la pasul 4 e respins LA ALEGERE, iar `creeazaMaterial` nu e chemat", async () => {
    serverulCareCreeazaSiPregateste();
    panaLaPasul4();

    alege(campulFisier(), new File(["MZ"], "instalator.exe", { type: "application/x-msdownload" }));

    // Respingerea vine de la câmp, înainte de orice buton: textul e cel din
    // `verificaMaterial`, ca omul să citească același motiv oriunde ar cădea.
    expect(screen.getByText("Acceptăm doar fișiere PDF.")).toBeTruthy();
    expect(screen.queryByText("instalator.exe")).toBeNull();
    expect(butonulSalveaza().disabled).toBe(true);

    await apasaSalveaza();
    expect(creeazaMaterial).not.toHaveBeenCalled();
    expect(pregatesteIncarcareMaterial).not.toHaveBeenCalled();
  });

  it("după un eșec la `salveazaVersiuneFisier`, a doua apăsare NU mai creează materialul", async () => {
    serverulCareCreeazaSiPregateste();
    salveazaVersiuneFisier
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "VALIDARE", message: "Fișierul nu este un PDF.", fieldErrors: null },
      })
      .mockResolvedValueOnce({ ok: true, data: { id: "v-1" } });
    panaLaPasul4();
    alege(campulFisier(), PDF());

    await apasaSalveaza();
    expect(await screen.findByText("Fișierul nu este un PDF.")).toBeTruthy();
    expect(creeazaMaterial).toHaveBeenCalledTimes(1);
    // Octeții urcaseră: obiectul se scoate din bucket, rândul RĂMÂNE.
    expect(renuntaLaIncarcare).toHaveBeenCalledTimes(1);
    expect(renuntaLaIncarcare).toHaveBeenCalledWith({ material_id: MATERIAL_ID, cale: CALE });

    await apasaSalveaza();
    expect(await screen.findByRole("heading", { name: "Materialul e gata" })).toBeTruthy();
    // O singură creare în două încercări: pe producție a doua dădea 23505 pe
    // `course_materials_cod_uk`, fiindcă primul rând exista deja cu același cod.
    expect(creeazaMaterial).toHaveBeenCalledTimes(1);
    expect(renuntaLaIncarcare).toHaveBeenCalledTimes(1);
    expect(salveazaVersiuneFisier).toHaveBeenCalledTimes(2);
    expect(salveazaVersiuneFisier.mock.calls[1]?.[0]).toMatchObject({ material_id: MATERIAL_ID });
    expect(pregatesteIncarcareMaterial.mock.calls[1]?.[0]).toMatchObject({
      material_id: MATERIAL_ID,
    });
  });

  it("după eșec, Callout-ul spune că materialul există și se continuă pe el, nu „nu s-a scris nimic”", async () => {
    serverulCareCreeazaSiPregateste();
    salveazaVersiuneFisier.mockResolvedValue({
      ok: false,
      error: { code: "VALIDARE", message: "Fișierul nu este un PDF.", fieldErrors: null },
    });
    panaLaPasul4();

    // Înainte de orice apăsare: ce se va întâmpla, inclusiv la eșec.
    expect(screen.getByText(/materialul rămâne creat fără conținut/u)).toBeTruthy();

    alege(campulFisier(), PDF());
    await apasaSalveaza();
    await screen.findByText("Fișierul nu este un PDF.");

    expect(screen.getByText(/„Regulament intern” a fost creat, dar fără conținut/u)).toBeTruthy();
    expect(screen.getByText(/se continuă pe el, nu se creează altul/u)).toBeTruthy();
    expect(screen.queryByText(/nu s-a scris nimic/u)).toBeNull();
  });

  it("după creare, pașii 1–3 nu se mai pot redeschide: rândul ar păstra titlul și codul vechi", async () => {
    serverulCareCreeazaSiPregateste();
    salveazaVersiuneFisier.mockResolvedValue({
      ok: false,
      error: { code: "VALIDARE", message: "Fișierul nu este un PDF.", fieldErrors: null },
    });
    panaLaPasul4();
    alege(campulFisier(), PDF());
    await apasaSalveaza();
    await screen.findByText("Fișierul nu este un PDF.");

    expect((screen.getByRole("button", { name: "Înapoi" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    // Lista pașilor nu mai oferă butoane de salt: nici cu tastatura nu se ajunge
    // la pasul 2 după ce rândul există.
    expect(screen.queryByRole("button", { name: /Cum se numește/u })).toBeNull();
    expect(screen.getByRole("heading", { name: "Conținutul" })).toBeTruthy();
  });
});
