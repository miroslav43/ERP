// src/app/(app)/flota/foi/[id]/actiuni-foaie.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { golesteToasturi } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Două lucruri apără fișierul.
 *
 * 1. ADM-022: pe foaia de parcurs, „Adaugă o alimentare” își golea TOATE
 *    câmpurile după o trimitere respinsă — și „Stație”, și „Număr bon”,
 *    completate corect. Mecanismul: `<form action>` brut cu câmpuri
 *    necontrolate; React 19 resetează formularul după ORICE acțiune de formular,
 *    inclusiv când pre-validarea de client iese sincron, fără drum la server.
 *    Formularul de trimitere avea același defect, nesemnalat de QA.
 *
 * 2. Ecranul urmează EXACT paritatea stării din 0200 §D1. Pe o foaie trimisă nu
 *    mai există alimentare și nici trimitere — doar retragerea; trimiterea nu
 *    mai cere sosirea (o dau cursele), iar refuzul bazei la trimitere se arată
 *    întreg, fiindcă câmpul lui stă în caseta cursei.
 *
 * Acțiunile sunt mimate: ce se probează e drumul de la `ActionResult` (sau de
 * la refuzul construit în client) până la caseta de lângă câmp, și faptul că
 * ce s-a tastat rămâne acolo.
 */

const {
  adaugaAlimentare,
  trimiteFoaie,
  retrageFoaie,
  redeschideFoaie,
  stergeFoaie,
  refresh,
  push,
  router,
  semnal,
} = vi.hoisted(() => {
  const refresh = vi.fn();
  const push = vi.fn();
  return {
    adaugaAlimentare: vi.fn(),
    trimiteFoaie: vi.fn(),
    retrageFoaie: vi.fn(),
    redeschideFoaie: vi.fn(),
    stergeFoaie: vi.fn(),
    refresh,
    push,
    semnal: vi.fn(),
    // UN SINGUR obiect, ca în Next (`useRouter` citește contextul, stabil
    // între randări). Un `() => ({ refresh, push })` ar da un router nou la
    // fiecare randare, `useCallback([router])` ar produce un `laReusita` nou,
    // iar efectul din `<Formular>` s-ar relua: `refresh` de două ori — un
    // defect al mock-ului, nu al componentei.
    router: { refresh, push },
  };
});

vi.mock("../../actions", () => ({
  adaugaAlimentare,
  trimiteFoaie,
  retrageFoaie,
  redeschideFoaie,
  stergeFoaie,
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// Citirea bonului (F12a): acțiunile din `flota/bon/actions` (și urcarea) sunt
// mimate, ca restul. Același modul îl importă și poza, și butonul de citire.
const bon = vi.hoisted(() => ({
  pregatesteBonNou: vi.fn(),
  citesteBonul: vi.fn(),
  urcaPeUrlSemnat: vi.fn(),
  pregatesteFotoBon: vi.fn(),
}));
vi.mock("../../bon/actions", () => ({
  pregatesteBonNou: bon.pregatesteBonNou,
  citesteBonul: bon.citesteBonul,
}));
vi.mock("@/lib/storage/urca-semnat", () => ({ urcaPeUrlSemnat: bon.urcaPeUrlSemnat }));
vi.mock("@/lib/documents/foto-bon-pregatire", async (orig) => ({
  ...(await orig<typeof import("@/lib/documents/foto-bon-pregatire")>()),
  pregatesteFotoBon: bon.pregatesteFotoBon,
}));
// Semnalul de navigare al lui `<Formular>` e un SPION: aprinde voalul global,
// care se stinge DOAR la schimbarea căii sau la demontare. Funcția e stabilă —
// e dependență a efectului de reușită din `<Formular>`, iar hook-ul real o
// memorează.
vi.mock("@/components/incarcare/use-incarcare", () => ({ useSemnalPanaLaRuta: () => semnal }));

const { ActiuniFoaie } = await import("./actiuni-foaie");

/* `<ConfirmareActiune>` e un `<dialog>` nativ; happy-dom nu are `showModal`. */
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

function refuz(
  fieldErrors: Record<string, readonly string[]> | null,
  message = "Datele introduse nu sunt valide.",
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message,
      fieldErrors,
      requestId: "test",
    },
  };
}

/** Plecare la 06:00 UTC = 09:00 ora României (EEST), deci câmpul arată `…T09:00`. */
const PLECARE_LA = "2026-10-01T06:00:00.000Z";

function randeaza(
  status: "draft" | "trimis" | "respins" = "draft",
  {
    areCurse = true,
    poateCitiBonul = false,
  }: { readonly areCurse?: boolean; readonly poateCitiBonul?: boolean } = {},
) {
  return render(
    <ActiuniFoaie
      id="f1"
      status={status}
      plecareLa={PLECARE_LA}
      sosireLa={null}
      areCurse={areCurse}
      bazaFoi="/flota/foi"
      poateCitiBonul={poateCitiBonul}
    />,
  );
}

function camp(eticheta: RegExp | string): HTMLInputElement {
  const element = screen.getByLabelText(eticheta);
  if (!(element instanceof HTMLInputElement)) throw new Error(`Câmpul „${eticheta}” lipsește.`);
  return element;
}

/** Observațiile foii (textarea), nu cele ale alimentării (input). */
function observatiiFoii(): HTMLTextAreaElement {
  const element = screen.getByLabelText(/^Observații/u, { selector: "textarea" });
  if (!(element instanceof HTMLTextAreaElement)) throw new Error("Observațiile foii lipsesc.");
  return element;
}

function scrie(element: HTMLInputElement | HTMLTextAreaElement, valoare: string): void {
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
  golesteToasturi();
  for (const f of [
    adaugaAlimentare,
    trimiteFoaie,
    retrageFoaie,
    redeschideFoaie,
    stergeFoaie,
    refresh,
    push,
    semnal,
    ...Object.values(bon),
  ]) {
    f.mockReset();
  }
});

describe("ActiuniFoaie — alimentarea păstrează ce s-a scris", () => {
  it("ADM-022: cu „Când/Litri/Cost” goale, erorile apar pe câmp, iar „Stație” și „Număr bon” rămân", async () => {
    randeaza("draft");
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
    randeaza("draft");
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
      cui_statie: null,
      alimentat_la: "2026-10-01T10:00",
      plin: false,
      observatii: null,
      fisier_bon_path: null,
      ocr_jeton: null,
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
    randeaza("draft");
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
    await waitFor(() => {
      expect(camp("Stație").value).toBe("");
    });
  });

  it("după o alimentare reușită voalul global de încărcare NU se aprinde", async () => {
    // Semnalul lui `<Formular>` se stinge doar la schimbarea căii sau la
    // demontare. După o alimentare, `router.refresh()` nu schimbă calea, iar
    // formularul rămâne montat (foaia e tot `draft`): voalul ar sta aprins,
    // înghițind clicurile, până la plafonul de 30 s.
    adaugaAlimentare.mockResolvedValue({ ok: true, data: { id: "a1" } });
    randeaza("draft");
    scrie(camp(/^Când/u), "2026-10-01T10:00");
    scrie(camp(/^Litri/u), "40");
    scrie(camp(/^Cost/u), "300");

    await apasa("Adaugă alimentarea");

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(semnal).not.toHaveBeenCalled();
  });

  it("un refuz pe un câmp care NU e în formular (`vehicle_id`) apare ca mesaj general", async () => {
    const mesaj = "Vehiculul nu mai este activ în organizație.";
    adaugaAlimentare.mockResolvedValue(refuz({ vehicle_id: [mesaj] }, mesaj));
    randeaza("draft");
    scrie(camp(/^Când/u), "2026-10-01T10:00");
    scrie(camp(/^Litri/u), "40");
    scrie(camp(/^Cost/u), "300");

    await apasa("Adaugă alimentarea");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(mesaj);
    });
    expect(camp(/^Litri/u).value).toBe("40");
  });
});

describe("ActiuniFoaie — trimiterea foii", () => {
  it("pe ciornă: trimiterea pleacă fără sosire, doar cu observațiile", async () => {
    trimiteFoaie.mockResolvedValue({ ok: true, data: { id: "f1", anomalie: null } });
    randeaza("draft");
    expect(screen.queryByLabelText(/^Sosire/u)).toBeNull();
    scrie(observatiiFoii(), "Drum închis la Câmpina.");

    await apasa("Trimite spre aprobare");

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(trimiteFoaie).toHaveBeenCalledWith({ id: "f1", observatii: "Drum închis la Câmpina." });
  });

  it("pe ciornă fără curse: spune ce lipsește și nu trimite nimic", async () => {
    randeaza("draft", { areCurse: false });
    scrie(observatiiFoii(), "Ceva scris deja.");

    await apasa("Trimite spre aprobare");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/Adăugați cursele zilei/u);
    });
    expect(trimiteFoaie).not.toHaveBeenCalled();
    // ADM-022 și aici: refuzul din client nu golește ce s-a scris.
    expect(observatiiFoii().value).toBe("Ceva scris deja.");
  });

  it("refuzul bazei la trimitere se arată întreg, nu „Corectați câmpurile marcate”", async () => {
    // `flota/erori.ts` pune „Kilometrajul de plecare …” pe `km_plecare`, iar
    // `<Formular>` ascunde mesajul general când există erori pe câmp. Fără
    // caseta `km_plecare` în formular, mesajul nu apărea nicăieri.
    const mesaj =
      "Kilometrajul de plecare (9000 km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (10000 km).";
    trimiteFoaie.mockResolvedValue(refuz({ km_plecare: [mesaj] }, mesaj));
    randeaza("draft");
    scrie(observatiiFoii(), "Fără probleme pe drum.");

    await apasa("Trimite spre aprobare");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(mesaj);
    });
    expect(trimiteFoaie).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    // ADM-022: observațiile rămân după refuz.
    expect(observatiiFoii().value).toBe("Fără probleme pe drum.");
  });

  it("refuzul fără câmp („Încheiați toate cursele”) apare ca mesaj general", async () => {
    const mesaj = "Încheiați toate cursele foii înainte de a o trimite spre aprobare.";
    trimiteFoaie.mockResolvedValue(refuz(null, mesaj));
    randeaza("draft");

    await apasa("Trimite spre aprobare");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(mesaj);
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("saltul de kilometraj după o trimitere reușită e avertisment, nu eroare", async () => {
    trimiteFoaie.mockResolvedValue({
      ok: true,
      data: { id: "f1", anomalie: "Salt de 700 km față de ultima foaie." },
    });
    randeaza("draft");

    await apasa("Trimite spre aprobare");

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Salt de 700 km față de ultima foaie.");
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("ActiuniFoaie — ce arată fiecare stare (0200 §D1)", () => {
  it("pe foaia trimisă: doar retragerea; fără alimentare, fără trimitere", async () => {
    retrageFoaie.mockResolvedValue({ ok: true, data: { id: "f1" } });
    randeaza("trimis");
    expect(screen.queryByRole("button", { name: "Trimite spre aprobare" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Adaugă alimentarea" })).toBeNull();

    await apasa("Retrage în ciornă");

    expect(retrageFoaie).toHaveBeenCalledWith({ id: "f1" });
    expect(redeschideFoaie).not.toHaveBeenCalled();
  });

  it("pe foaia respinsă: redeschiderea, nu retragerea", async () => {
    redeschideFoaie.mockResolvedValue({ ok: true, data: { id: "f1" } });
    randeaza("respins");
    expect(screen.queryByRole("button", { name: "Adaugă alimentarea" })).toBeNull();

    await apasa("Redeschide foaia");

    expect(redeschideFoaie).toHaveBeenCalledWith({ id: "f1" });
    expect(retrageFoaie).not.toHaveBeenCalled();
  });

  it("pe ciornă: alimentarea se poate adăuga", () => {
    randeaza("draft");
    expect(screen.getByRole("button", { name: "Adaugă alimentarea" })).toBeTruthy();
  });
});

describe("ActiuniFoaie — poza bonului și citirea lui (F12a)", () => {
  const CALE = "org/trip_sheets/f1/x-bon.jpg";
  const PROPUNERE = {
    alimentat_la: "2026-10-01T10:15",
    litri: 45.32,
    cost: 312.5,
    statie: "OMV Pitești",
    numar_bon: "0042",
    cui_statie: "14399840",
  };

  function pozaUrcata(): void {
    bon.pregatesteFotoBon.mockImplementation(async (f: File) => f);
    bon.pregatesteBonNou.mockResolvedValue({
      ok: true,
      data: { cale: CALE, urlSemnat: "https://s/u" },
    });
    bon.urcaPeUrlSemnat.mockResolvedValue(true);
  }

  async function urcaPoza(): Promise<void> {
    const poza = new File([new Uint8Array(1024)], "bon.jpg", { type: "image/jpeg" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^Poza bonului/u), { target: { files: [poza] } });
    });
    await waitFor(() => {
      expect(bon.urcaPeUrlSemnat).toHaveBeenCalledTimes(1);
    });
  }

  it("fără `poateCitiBonul`, butonul „Citește bonul” nu apare nici cu poza urcată", async () => {
    pozaUrcata();
    randeaza("draft");
    await urcaPoza();
    expect(screen.queryByRole("button", { name: /Citește bonul/u })).toBeNull();
  });

  it("D10: citirea completează DOAR câmpurile goale, cu „din bon”; jetonul și poza pleacă la salvare", async () => {
    pozaUrcata();
    bon.citesteBonul.mockResolvedValue({
      ok: true,
      data: { propunere: PROPUNERE, avertismente: [], jeton: "jeton.semnat" },
    });
    adaugaAlimentare.mockResolvedValue({ ok: true, data: { id: "a1" } });
    randeaza("draft", { poateCitiBonul: true });
    // Omul a scris deja litrii: citirea nu-i suprascrie.
    scrie(camp(/^Litri/u), "50");
    await urcaPoza();

    await apasa("Citește bonul");

    await waitFor(() => {
      expect(camp("Stație (din bon)").value).toBe("OMV Pitești");
    });
    expect(camp(/^Litri/u).value).toBe("50");
    expect(screen.queryByLabelText(/Litri \(din bon\)/u)).toBeNull();
    expect(camp(/^Cost \(lei\) \(din bon\)/u).value).toBe("312.5");
    expect(camp(/^Când \(din bon\)/u).value).toBe("2026-10-01T10:15");
    expect(camp(/^CUI stație \(din bon\)/u).value).toBe("14399840");

    await apasa("Adaugă alimentarea");

    await waitFor(() => {
      expect(adaugaAlimentare).toHaveBeenCalledTimes(1);
    });
    expect(adaugaAlimentare).toHaveBeenCalledWith(
      expect.objectContaining({
        litri: 50,
        cost: 312.5,
        statie: "OMV Pitești",
        numar_bon: "0042",
        cui_statie: "14399840",
        alimentat_la: "2026-10-01T10:15",
        fisier_bon_path: CALE,
        ocr_jeton: "jeton.semnat",
      }),
    );
  });

  it("conversia HEIC eșuată: mesajul cu pașii, poza nu se urcă", async () => {
    const { FotoBonNecitibila, MESAJ_HEIC } = await import("@/lib/documents/foto-bon-pregatire");
    bon.pregatesteFotoBon.mockRejectedValue(new FotoBonNecitibila(MESAJ_HEIC));
    randeaza("draft", { poateCitiBonul: true });
    const poza = new File([new Uint8Array(1024)], "IMG_1.HEIC", { type: "image/heic" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^Poza bonului/u), { target: { files: [poza] } });
    });
    await waitFor(() => {
      expect(screen.getByText(MESAJ_HEIC)).toBeDefined();
    });
    expect(bon.pregatesteBonNou).not.toHaveBeenCalled();
    expect(bon.urcaPeUrlSemnat).not.toHaveBeenCalled();
  });
});
