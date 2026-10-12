// src/app/(onboarding)/bun-venit/asistent-firma.test.tsx
//
// Ce apără fișierul (QA 8 oct 2026, ONB-012 și ONB-018): datele completate în
// asistent supraviețuiesc unei reîncărcări (ciornă în `sessionStorage`, per
// filă), CNP-ul reprezentantului legal NU ajunge în ciornă, pasul curent stă
// în URL și în istoric, bannerul de eroare dispare la schimbarea pasului, iar
// stepperul nu mai lasă „Confirmare" să ocolească validarea pașilor săriți.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";

import { AsistentFirma } from "./asistent-firma";
import { VERSIUNE_CIORNA, cheiaCiornei } from "./ciorna";

/*
  Două margini tăiate, ca în `pontaj/celula-zi.test.tsx`: `./actions` e un modul
  `"use server"` care trage după el `server-only`, iar hook-urile de navigare
  cer contextul App Router. `useSearchParams` citește `stare.cautare`, pe care
  fiecare test o pune înainte de randare — așa se simulează „pagina deschisă
  la `?pas=3`".
*/
const stare = vi.hoisted(() => ({ cautare: "" }));
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  prefetch: vi.fn(),
}));
const { completeazaDateleFirmei } = vi.hoisted(() => ({ completeazaDateleFirmei: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/bun-venit",
  useSearchParams: () => new URLSearchParams(stare.cautare),
}));

vi.mock("./actions", () => ({ completeazaDateleFirmei }));

const CHEIE = cheiaCiornei("u-1", "o-1");

/** Un formular care trece `completeazaFirmaSchema` — copiat din `schemas/organization.test.ts`. */
const COMPLET: Partial<OnboardeazaOrganizatieInput> = {
  name: "Firma Mea",
  forma_juridica: "SRL",
  cui: "14399840",
  platitor_tva: false,
  slug: "firma-mea",
  email_contact: "contact@firma.ro",
  telefon_contact: "0721234567",
  judet: "București",
  oras: "București",
  plan: "trial",
  seats_limit: 10,
  legal_name: "SC Firma Mea SRL",
  zile_concediu_anual_implicit: 20,
  cod_caen: "6210",
  cod_caen_secundare: [],
  owner_nume: "Popescu",
  owner_prenume: "Ion",
  owner_email: "ion@firma.ro",
  owner_telefon: "0731234567",
};

/**
 * `requestAnimationFrame` înlocuit cu unul care doar REȚINE cadrul — tiparul
 * din `vitrina-leave.test.tsx`: testul îl declanșează singur, într-un `act`,
 * fără nicio cursă cu timere reale.
 */
let cadre: Array<FrameRequestCallback> = [];

beforeEach(() => {
  cadre = [];
  stare.cautare = "";
  completeazaDateleFirmei.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
  vi.stubGlobal("requestAnimationFrame", (cadru: FrameRequestCallback) => {
    cadre.push(cadru);
    return cadre.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/bun-venit");
});

/**
 * „Pagina deschisă la `?pas=N`": în browser `useSearchParams` și
 * `window.location.search` sunt același lucru; aici mock-ul le ține separate,
 * deci se pun amândouă.
 */
function deschideLa(cautare: string) {
  stare.cautare = cautare;
  window.history.replaceState(null, "", `/bun-venit?${cautare}`);
}

function monteaza(valoriInitiale: Partial<OnboardeazaOrganizatieInput> = {}) {
  return render(
    <AsistentFirma numeFirma="Firma Mea" valoriInitiale={valoriInitiale} cheieCiorna={CHEIE} />,
  );
}

async function ruleazaCadrul() {
  expect(cadre.length).toBeGreaterThan(0);
  await act(async () => {
    cadre[cadre.length - 1]!(0);
  });
}

function pasulCurent(): string {
  const activ = document.querySelector('li[aria-current="step"]');
  return activ?.textContent ?? "";
}

function ciornaStocata(): { pas: number; date: Record<string, unknown> } | null {
  const brut = window.sessionStorage.getItem(CHEIE);
  return brut === null
    ? null
    : (JSON.parse(brut) as { pas: number; date: Record<string, unknown> });
}

describe("AsistentFirma — ciorna (ONB-012)", () => {
  it("recuperează câmpurile din ciornă după montare și spune că CNP-ul nu se păstrează", async () => {
    window.sessionStorage.setItem(
      CHEIE,
      JSON.stringify({
        v: VERSIUNE_CIORNA,
        pas: 1,
        date: { name: "Proba SRL", email_contact: "a@b.ro" },
      }),
    );
    monteaza();
    // Înainte de cadru, formularul arată exact ce a randat serverul.
    expect((screen.getByLabelText(/^Denumire \*/) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("status")).toBeNull();

    await ruleazaCadrul();

    expect((screen.getByLabelText(/^Denumire \*/) as HTMLInputElement).value).toBe("Proba SRL");
    expect((screen.getByLabelText(/^Email de contact/) as HTMLInputElement).value).toBe("a@b.ro");
    expect(screen.getByRole("status").textContent).toMatch(/CNP/u);
  });

  it("fără `?pas` în adresă, deschide pasul din ciornă (prin replace, nu push)", async () => {
    window.sessionStorage.setItem(
      CHEIE,
      JSON.stringify({ v: VERSIUNE_CIORNA, pas: 3, date: { name: "Proba SRL" } }),
    );
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");
    monteaza();
    expect(pasulCurent()).toContain("Date fiscale");

    await ruleazaCadrul();

    expect(pasulCurent()).toContain("Date financiare");
    expect(replaceState).toHaveBeenCalledWith(expect.anything(), "", "?pas=3");
    expect(pushState).not.toHaveBeenCalled();
  });

  it("cu `?pas` în adresă, adresa bate pasul din ciornă", async () => {
    window.sessionStorage.setItem(
      CHEIE,
      JSON.stringify({ v: VERSIUNE_CIORNA, pas: 3, date: { name: "Proba SRL" } }),
    );
    deschideLa("pas=2");
    monteaza();
    await ruleazaCadrul();
    expect(pasulCurent()).toContain("Reprezentant legal");
  });

  it("o ciornă de altă formă se ignoră, fără să rupă ecranul", async () => {
    window.sessionStorage.setItem(CHEIE, JSON.stringify({ v: 99, pas: "x" }));
    monteaza();
    await ruleazaCadrul();
    expect(screen.queryByRole("status")).toBeNull();
    expect(pasulCurent()).toContain("Date fiscale");
  });

  it("scrie ciorna la orice tastare, dar CNP-ul nu ajunge niciodată în ea", async () => {
    deschideLa("pas=2");
    monteaza();
    await ruleazaCadrul();

    fireEvent.input(screen.getByLabelText(/^Nume și prenume/), {
      target: { value: "Popescu Ion" },
    });
    fireEvent.input(screen.getByLabelText(/^CNP/), { target: { value: "1800101221144" } });

    const ciorna = ciornaStocata();
    expect(ciorna).not.toBeNull();
    expect(ciorna?.pas).toBe(2);
    expect(ciorna?.date.reprezentant_legal).toBe("Popescu Ion");
    expect(ciorna?.date).not.toHaveProperty("reprezentant_cnp");
    // Nici câmpurile proprietarului sau planul: vin de pe server la fiecare randare.
    expect(ciorna?.date).not.toHaveProperty("owner_email");
    expect(ciorna?.date).not.toHaveProperty("plan");
  });

  it("după salvarea reușită, ciorna dispare — și nu reapare din emisiile de după submit", async () => {
    deschideLa("pas=7");
    window.sessionStorage.setItem(
      CHEIE,
      JSON.stringify({ v: VERSIUNE_CIORNA, pas: 7, date: { name: "Firma Mea" } }),
    );
    completeazaDateleFirmei.mockResolvedValue({
      ok: true,
      data: { id: "11111111-1111-4111-8111-111111111111", name: "Firma Mea" },
    });
    const { container } = monteaza(COMPLET);
    await ruleazaCadrul();
    expect(ciornaStocata()).not.toBeNull();

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    expect(completeazaDateleFirmei).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CHEIE)).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/panou");
  });
});

describe("AsistentFirma — pasul în URL și în istoric (ONB-012)", () => {
  it("`?pas=3` deschide direct „Date financiare”", () => {
    deschideLa("pas=3");
    monteaza();
    expect(pasulCurent()).toContain("Date financiare");
  });

  it("`?pas=6` (pasul ascuns al proprietarului) duce la confirmare, nu la un ecran gol", () => {
    deschideLa("pas=6");
    monteaza();
    expect(pasulCurent()).toContain("Confirmare");
  });

  it("un salt înapoi din stepper împinge `?pas=N` în istoric", () => {
    deschideLa("pas=3");
    const pushState = vi.spyOn(window.history, "pushState");
    monteaza();

    fireEvent.click(screen.getByRole("button", { name: /Date fiscale/ }));

    expect(pushState).toHaveBeenCalledWith(expect.anything(), "", "?pas=1");
    expect(pasulCurent()).toContain("Date fiscale");
    expect(ciornaStocata()?.pas).toBe(1);
  });

  it("Back/Forward (popstate) readuce pasul din adresă, cu datele intacte", async () => {
    deschideLa("pas=3");
    monteaza(COMPLET);
    fireEvent.click(screen.getByRole("button", { name: /Date fiscale/ }));
    fireEvent.input(screen.getByLabelText(/^Denumire \*/), { target: { value: "Alt nume SRL" } });

    // Browserul a mutat adresa înapoi la intrarea anterioară și anunță `popstate`.
    window.history.replaceState(null, "", "/bun-venit?pas=3");
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(pasulCurent()).toContain("Date financiare");

    window.history.replaceState(null, "", "/bun-venit?pas=1");
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(pasulCurent()).toContain("Date fiscale");
    expect((screen.getByLabelText(/^Denumire \*/) as HTMLInputElement).value).toBe("Alt nume SRL");
  });

  it("valoarea tastată supraviețuiește la „Continuă” + „Înapoi” (regresie: QA a găsit-o bună)", async () => {
    monteaza(COMPLET);
    fireEvent.input(screen.getByLabelText(/^Denumire \*/), { target: { value: "Alt nume SRL" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continuă" }));
    });
    expect(pasulCurent()).toContain("Reprezentant legal");

    fireEvent.click(screen.getByRole("button", { name: "Înapoi" }));
    expect(pasulCurent()).toContain("Date fiscale");
    expect((screen.getByLabelText(/^Denumire \*/) as HTMLInputElement).value).toBe("Alt nume SRL");
  });
});

describe("AsistentFirma — bannerul și saltul din stepper (ONB-018)", () => {
  it("(a) „Finalizează” pe un formular gol deschide primul pas cu probleme și bannerul", async () => {
    deschideLa("pas=7");
    const { container } = monteaza();
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await screen.findByText(/obligatorii lipsesc|obligatoriu lipsește/)).toBeDefined();
    expect(pasulCurent()).toContain("Date fiscale");
    expect(completeazaDateleFirmei).not.toHaveBeenCalled();
  });

  it("(a) bannerul erorii de server dispare la schimbarea pasului", async () => {
    deschideLa("pas=7");
    completeazaDateleFirmei.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Verificați datele firmei.",
        fieldErrors: { banca_iban: ["IBAN-ul nu are formatul așteptat."] },
        requestId: "r-1",
      },
    });
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { container } = monteaza(COMPLET);

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    // Serverul a arătat spre pasul 3: se deschide cu `replace` (nu îngroașă
    // istoricul), iar mesajul serverului rămâne vizibil DUPĂ schimbarea pasului.
    expect(await screen.findByText("Verificați datele firmei.")).toBeDefined();
    expect(pasulCurent()).toContain("Date financiare");
    expect(replaceState).toHaveBeenCalledWith(expect.anything(), "", "?pas=3");

    fireEvent.click(screen.getByRole("button", { name: /Date fiscale/ }));
    expect(screen.queryByText("Verificați datele firmei.")).toBeNull();
    expect(pasulCurent()).toContain("Date fiscale");
  });

  it("(b) saltul la „Confirmare” de pe un pas nevalid se oprește acolo, cu câmpul marcat", async () => {
    monteaza();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmare/ }));
    });
    expect(pasulCurent()).toContain("Date fiscale");
    expect(screen.getByLabelText(/^Denumire \*/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/înainte de a sări/).textContent).toContain("Date fiscale");
  });

  it("(b) saltul înainte validează pașii săriți și se oprește la PRIMUL nevalid", async () => {
    // Pasul 1 e valid; pasul 2 e opțional în întregime; pasul 3 primește o zi
    // imposibilă — deci saltul 1 → Confirmare trebuie să se oprească la 3.
    monteaza({ ...COMPLET, ziua_plata_lichidare: 40 });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmare/ }));
    });
    expect(pasulCurent()).toContain("Date financiare");
    expect(screen.getByText(/înainte de a sări/).textContent).toContain("Date financiare");
  });

  it("(b) cu toți pașii valizi, saltul la „Confirmare” ajunge acolo", async () => {
    monteaza(COMPLET);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmare/ }));
    });
    expect(pasulCurent()).toContain("Confirmare");
    expect(screen.queryByText(/înainte de a sări/)).toBeNull();
  });
});
