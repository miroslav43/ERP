// src/components/incarcare/buton-descarcare.test.tsx
//
// Ce apără fișierul: antetele de control ale exporturilor ajung în notificarea
// de reușită. `d112/route.ts` trimite `x-atentionari` (atenționările ANAF
// neblocante); fără rândul din `ANTETE_CONTROL`, numărul lor nu apărea nicăieri
// pe ecran, iar contabilul afla de ele abia din DUKIntegrator.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/toast", () => ({ arataToast: vi.fn() }));

import { ButonDescarcare } from "./buton-descarcare";
import { arataToast } from "@/components/ui/toast";

const NUME = "d112-2026-07-0001.xml";

function raspunde(antete: Readonly<Record<string, string>>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("<declaratieUnica />", {
          status: 200,
          headers: { "content-disposition": `attachment; filename="${NUME}"`, ...antete },
        }),
    ),
  );
}

async function descarca(): Promise<string> {
  render(
    <ButonDescarcare href="/api/export/salarizare/d112?perioada=x" eticheta="declarația 112">
      Descarcă D112
    </ButonDescarcare>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Descarcă D112/u }));
  await waitFor(() => {
    expect(arataToast).toHaveBeenCalledTimes(1);
  });
  const [[toast]] = vi.mocked(arataToast).mock.calls as [[{ fel: string; text: string }]];
  expect(toast.fel).toBe("reusita");
  return toast.text;
}

describe("ButonDescarcare — antetele de control", () => {
  beforeEach(() => {
    vi.mocked(arataToast).mockClear();
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("D112 cu atenționări: notificarea spune câte sunt și unde se verifică", async () => {
    raspunde({ "x-atentionari": "2" });
    const text = await descarca();
    expect(text).toContain(NUME);
    // Același tipar ca `plăți: 31`: eticheta, apoi valoarea antetului.
    expect(text).toContain("atenționări de verificat în DUKIntegrator: 2");
  });

  it("fără antetul `x-atentionari`, notificarea nu pomenește atenționări", async () => {
    raspunde({});
    const text = await descarca();
    expect(text).toBe(`S-a descărcat ${NUME}.`);
  });

  it("celelalte antete de control rămân: fișierul bancar își arată cifrele", async () => {
    raspunde({ "x-plati-incluse": "31", "x-fara-iban": "0" });
    const text = await descarca();
    expect(text).toContain("plăți: 31");
    expect(text).toContain("fără IBAN: 0");
  });
});
