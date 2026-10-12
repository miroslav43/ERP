// src/app/(app)/flota/foi/[id]/actiuni-foaie.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

/**
 * ADM-022: pe foaia de parcurs, „Adaugă o alimentare” își golea TOATE câmpurile
 * după o trimitere respinsă — și „Stație”, și „Număr bon”, completate corect.
 * Omul relua totul de la zero la fiecare greșeală.
 *
 * Mecanismul: `<form action>` brut cu câmpuri necontrolate. React 19 resetează
 * formularul după ORICE acțiune de formular, inclusiv când pre-validarea de
 * client iese sincron, fără drum la server. Formularul de închidere a cursei
 * avea exact același defect, nesemnalat de QA.
 *
 * Acțiunile sunt mimate: ce se probează e drumul de la `ActionResult` (sau de
 * la refuzul construit în client) până la caseta de lângă câmp, și faptul că
 * ce s-a tastat rămâne acolo.
 */

const { adaugaAlimentare, trimiteFoaie, redeschideFoaie, refresh, push, router } = vi.hoisted(
  () => {
    const refresh = vi.fn();
    const push = vi.fn();
    return {
      adaugaAlimentare: vi.fn(),
      trimiteFoaie: vi.fn(),
      redeschideFoaie: vi.fn(),
      refresh,
      push,
      // UN SINGUR obiect, ca în Next (`useRouter` citește contextul, stabil
      // între randări). Un `() => ({ refresh, push })` ar da un router nou la
      // fiecare randare, `useCallback([router])` ar produce un `laReusita` nou,
      // iar efectul din `<Formular>` s-ar relua: `refresh` de două ori — un
      // defect al mock-ului, nu al componentei.
      router: { refresh, push },
    };
  },
);

vi.mock("../../actions", () => ({ adaugaAlimentare, trimiteFoaie, redeschideFoaie }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// `Formular` cere semnalul de navigare din harness-ul aplicației; în test
// contează doar erorile și valorile, deci se scurtcircuitează. Tot cu o
// funcție STABILĂ — e dependență a efectului de reușită din `<Formular>`, iar
// hook-ul real o memorează.
vi.mock("@/components/incarcare/use-incarcare", () => {
  const semnal = (): undefined => undefined;
  return { useSemnalPanaLaRuta: () => semnal };
});

const { ActiuniFoaie } = await import("./actiuni-foaie");

function refuz(fieldErrors: Record<string, readonly string[]>): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "test",
    },
  };
}

/** Plecare la 06:00 UTC = 09:00 ora României (EEST), deci câmpul arată `…T09:00`. */
const PLECARE_LA = "2026-10-01T06:00:00.000Z";

function randeaza(status: "draft" | "trimis" = "draft") {
  return render(
    <ActiuniFoaie
      id="f1"
      status={status}
      kmPlecare={1000}
      plecareLa={PLECARE_LA}
      sosireLa={null}
    />,
  );
}

function camp(eticheta: RegExp | string): HTMLInputElement {
  const element = screen.getByLabelText(eticheta);
  if (!(element instanceof HTMLInputElement)) throw new Error(`Câmpul „${eticheta}” lipsește.`);
  return element;
}

function scrie(element: HTMLInputElement, valoare: string): void {
  act(() => {
    fireEvent.change(element, { target: { value: valoare } });
  });
}

async function apasa(nume: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nume }));
  });
}

beforeEach(() => {
  adaugaAlimentare.mockReset();
  trimiteFoaie.mockReset();
  redeschideFoaie.mockReset();
  refresh.mockReset();
  push.mockReset();
});

describe("ActiuniFoaie — alimentarea păstrează ce s-a scris", () => {
  it("ADM-022: cu „Când/Litri/Cost” goale, erorile apar pe câmp, iar „Stație” și „Număr bon” rămân", async () => {
    randeaza("trimis");
    scrie(camp("Stație"), "OMV");
    scrie(camp("Număr bon"), "B1");

    await apasa("Adaugă alimentarea");

    await waitFor(() => {
      expect(screen.getByText("Completați data și ora alimentării.")).toBeDefined();
    });
    expect(screen.getByText("Scrieți câți litri s-au alimentat (mai mult de zero).")).toBeDefined();
    expect(screen.getByText("Scrieți costul alimentării, în lei.")).toBeDefined();
    // Pre-validarea de client a oprit drumul la server.
    expect(adaugaAlimentare).not.toHaveBeenCalled();

    expect(camp("Stație").value).toBe("OMV");
    expect(camp("Număr bon").value).toBe("B1");
  });

  it("refuzul serverului pe `numar_bon` ajunge lângă câmp, iar „Litri” și „Cost” rămân", async () => {
    adaugaAlimentare.mockResolvedValue(
      refuz({ numar_bon: ["Bonul B1 e deja trecut pe această foaie."] }),
    );
    randeaza("trimis");
    scrie(camp(/^Când/u), "2026-10-01T10:00");
    scrie(camp(/^Litri/u), "40");
    scrie(camp(/^Cost/u), "300");
    scrie(camp("Număr bon"), "B1");

    await apasa("Adaugă alimentarea");

    await waitFor(() => {
      expect(screen.getByText("Bonul B1 e deja trecut pe această foaie.")).toBeDefined();
    });
    expect(adaugaAlimentare).toHaveBeenCalledTimes(1);
    expect(adaugaAlimentare).toHaveBeenCalledWith({
      trip_sheet_id: "f1",
      litri: 40,
      cost: 300,
      statie: null,
      numar_bon: "B1",
      alimentat_la: "2026-10-01T10:00",
      plin: false,
      observatii: null,
    });
    // Mesajul e legat de caseta vinovată, nu doar afișat undeva pe ecran.
    expect(camp("Număr bon").getAttribute("aria-invalid")).toBe("true");

    expect(camp(/^Litri/u).value).toBe("40");
    expect(camp(/^Cost/u).value).toBe("300");
    expect(camp(/^Când/u).value).toBe("2026-10-01T10:00");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("după o alimentare reușită formularul se golește și pagina se reîmprospătează", async () => {
    adaugaAlimentare.mockResolvedValue({ ok: true, data: { id: "a1" } });
    randeaza("trimis");
    scrie(camp(/^Când/u), "2026-10-01T10:00");
    scrie(camp(/^Litri/u), "40");
    scrie(camp(/^Cost/u), "300");
    scrie(camp("Stație"), "OMV");

    await apasa("Adaugă alimentarea");

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    // `valoriTrimise` se păstrează DOAR cât timp ultimul răspuns a fost un
    // refuz: a doua alimentare pornește de la zero, nu de la prima.
    expect(camp("Stație").value).toBe("");
  });
});

describe("ActiuniFoaie — închiderea cursei păstrează ce s-a scris", () => {
  it("refuzul serverului pe `km_sosire` ajunge lângă câmp, iar kilometrajul rămâne", async () => {
    trimiteFoaie.mockResolvedValue(
      refuz({
        km_sosire: [
          "Kilometrajul de sosire (1500 km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (1800 km).",
        ],
      }),
    );
    randeaza("draft");
    scrie(camp(/^Sosire/u), "2026-10-01T18:00");
    scrie(camp(/^Kilometraj la sosire/u), "1500");

    await apasa("Trimite spre aprobare");

    await waitFor(() => {
      expect(screen.getByText(/Kilometrajul de sosire \(1500 km\)/u)).toBeDefined();
    });
    expect(trimiteFoaie).toHaveBeenCalledWith({
      id: "f1",
      sosire_la: "2026-10-01T18:00",
      km_sosire: 1500,
      observatii: null,
    });
    expect(camp(/^Kilometraj la sosire/u).value).toBe("1500");
    expect(camp(/^Sosire/u).value).toBe("2026-10-01T18:00");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("pre-validarea de client nu pleacă la server și nu golește sosirea", async () => {
    randeaza("draft");
    // Înainte de plecare (09:00 ora României): regula se spune pe câmp, local.
    scrie(camp(/^Sosire/u), "2026-10-01T08:00");

    await apasa("Trimite spre aprobare");

    await waitFor(() => {
      expect(screen.getByText("Sosirea trebuie să fie după plecare.")).toBeDefined();
    });
    expect(screen.getByText("Scrieți kilometrajul la sosire, în km.")).toBeDefined();
    expect(trimiteFoaie).not.toHaveBeenCalled();
    expect(camp(/^Sosire/u).value).toBe("2026-10-01T08:00");
  });

  it("saltul de kilometraj după o închidere reușită e avertisment, nu eroare", async () => {
    trimiteFoaie.mockResolvedValue({
      ok: true,
      data: { id: "f1", anomalie: "Salt de 700 km față de ultima foaie." },
    });
    randeaza("draft");
    scrie(camp(/^Sosire/u), "2026-10-01T18:00");
    scrie(camp(/^Kilometraj la sosire/u), "1500");

    await apasa("Trimite spre aprobare");

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Salt de 700 km față de ultima foaie.");
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
