// src/app/(auth)/inregistrare/formular-inregistrare.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

import type { ActionResult } from "@/lib/actions/types";

/*
 * Regulile pe care le apără fișierul (ONB-001, ONB-002, ONB-003):
 *
 *   1. Greșelile evidente — CUI cu cifră de control greșită, bifă lipsă — se
 *      prind PE CLIENT, în română, lângă câmp, fără nicio cerere la server și
 *      deci fără să ardă un slot din limita de 3/oră.
 *   2. Validarea nativă a browserului e oprită (`noValidate`): baloanele ei
 *      vin în limba browserului, nu a paginii.
 *   3. La orice eroare — de client sau de server — câmpurile păstrează ce s-a
 *      tastat, inclusiv bifa.
 *
 * Mesajele vin din ACEEAȘI schemă Zod pe care o rulează serverul
 * (`schemaInregistrare`), deci textul de aici e textul pe care l-ar fi dat și
 * `createPublicAction`.
 */
const { inregistreazaFirma } = vi.hoisted(() => ({ inregistreazaFirma: vi.fn() }));

vi.mock("./actions", () => ({ inregistreazaFirma }));

/** Ca în `continua-in-aplicatie.test.tsx`: `<Link>` devine un `<a>` simplu. */
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) =>
      createElement("a", { href: props["href"] as string }, props["children"] as ReactNode),
  };
});

import { FormularInregistrare } from "./formular-inregistrare";

type Date = Readonly<{ email: string; prinEmail: boolean }>;

const VALIDE = {
  firma: "Firma Test SRL",
  cui: "14399840",
  prenume: "Ana",
  nume: "Pop",
  email: "ana@example.com",
  telefon: "",
} as const;

/** `55676851`: cifra de control nu corespunde (ONB-001, pasul 1). */
const CUI_GRESIT = "55676851";

function camp(nume: string): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>(`[name="${nume}"]`);
  if (el === null) throw new Error(`lipsește câmpul ${nume}`);
  return el;
}

function completeaza(valori: Readonly<Record<string, string>>, bifa = true): void {
  for (const [nume, valoare] of Object.entries(valori)) {
    act(() => {
      fireEvent.change(camp(nume), { target: { value: valoare } });
    });
  }
  if (bifa) {
    act(() => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
  }
}

async function trimite(): Promise<void> {
  await act(async () => {
    const formular = document.querySelector("form");
    if (formular === null) throw new Error("lipsește formularul");
    fireEvent.submit(formular);
  });
}

function refuz(message: string, fieldErrors: Record<string, readonly string[]> | null) {
  return {
    ok: false,
    error: { code: "CONFLICT", message, fieldErrors, requestId: "test" },
  } satisfies ActionResult<Date>;
}

beforeEach(() => {
  inregistreazaFirma.mockReset();
  inregistreazaFirma.mockResolvedValue({
    ok: true,
    data: { email: "ana@example.com", prinEmail: true },
  } satisfies ActionResult<Date>);
});

describe("FormularInregistrare — validarea pe client", () => {
  it("un CUI cu cifra de control greșită e respins lângă câmp, fără cerere la server", async () => {
    render(<FormularInregistrare />);
    completeaza({ ...VALIDE, cui: CUI_GRESIT });
    await trimite();

    await waitFor(() => {
      expect(screen.getByText(/cifra de control nu corespunde/)).toBeDefined();
    });
    expect(inregistreazaFirma).not.toHaveBeenCalled();

    const cui = camp("cui");
    expect(cui.getAttribute("aria-invalid")).toBe("true");
    // `Camp` leagă și eroarea, și indiciul: întâi ce e greșit, apoi ce se aștepta.
    const descrieri = (cui.getAttribute("aria-describedby") ?? "").split(/\s+/);
    const texte = descrieri.map((id) => document.getElementById(id)?.textContent ?? "");
    expect(texte.join(" ")).toContain("cifra de control nu corespunde");

    // Celelalte câmpuri păstrează ce s-a tastat — și ca valoare, și ca
    // `defaultValue`, forma pe care React o reia după resetul formularului.
    expect(camp("firma").value).toBe(VALIDE.firma);
    expect(camp("firma").defaultValue).toBe(VALIDE.firma);
    expect(camp("email").value).toBe(VALIDE.email);
    expect(camp("cui").value).toBe(CUI_GRESIT);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("bifa lipsă e o eroare de accept, nu de tip, și nu pleacă nicio cerere", async () => {
    render(<FormularInregistrare />);
    completeaza(VALIDE, false);
    await trimite();

    await waitFor(() => {
      expect(
        screen.getByText("Trebuie să accepți termenii ca să putem crea contul."),
      ).toBeDefined();
    });
    expect(inregistreazaFirma).not.toHaveBeenCalled();
    const bifa = screen.getByRole("checkbox");
    expect(bifa.getAttribute("aria-invalid")).toBe("true");
  });

  it("formularul gol: mesaje românești pe fiecare câmp, nu baloane native", async () => {
    render(<FormularInregistrare />);
    await trimite();

    await waitFor(() => {
      expect(screen.getByText("Scrie denumirea firmei.")).toBeDefined();
    });
    expect(screen.getByText("Scrie-ți prenumele.")).toBeDefined();
    expect(screen.getByText("Scrie-ți numele de familie.")).toBeDefined();
    expect(inregistreazaFirma).not.toHaveBeenCalled();
  });

  it("focusul ajunge pe primul câmp invalid", async () => {
    render(<FormularInregistrare />);
    completeaza({ ...VALIDE, cui: CUI_GRESIT, email: "abc@" });
    await trimite();

    await waitFor(() => {
      expect(document.activeElement).toBe(camp("cui"));
    });
  });

  it("dezactivează validarea nativă a browserului", () => {
    render(<FormularInregistrare />);
    expect(document.querySelector("form")?.hasAttribute("novalidate")).toBe(true);
  });
});

describe("FormularInregistrare — răspunsul serverului", () => {
  it("o intrare validă pleacă la server, cu bifa convertită și cu sursa", async () => {
    render(<FormularInregistrare sursa="foaie-de-pontaj" />);
    completeaza({ ...VALIDE, telefon: "0722 000 000" });
    await trimite();

    await waitFor(() => expect(inregistreazaFirma).toHaveBeenCalledTimes(1));
    expect(inregistreazaFirma).toHaveBeenCalledWith({
      ...VALIDE,
      telefon: "0722 000 000",
      acceptTermeni: true,
      sursa: "foaie-de-pontaj",
    });
  });

  it("la un refuz general (CUI duplicat) mesajul apare ca alertă și câmpurile rămân", async () => {
    inregistreazaFirma.mockResolvedValue(refuz("Există deja o firmă cu acest CUI.", null));
    render(<FormularInregistrare />);
    completeaza(VALIDE);
    await trimite();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Există deja o firmă cu acest CUI.");
    });
    expect(camp("firma").value).toBe(VALIDE.firma);
    expect(camp("firma").defaultValue).toBe(VALIDE.firma);
    expect(camp("cui").value).toBe(VALIDE.cui);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    // Formularul e încă aici: se poate corecta și retrimite.
    expect(document.querySelector("form")).not.toBeNull();
  });

  it("la reușită formularul dispare și ecranul spune unde a plecat e-mailul", async () => {
    render(<FormularInregistrare />);
    completeaza(VALIDE);
    await trimite();

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("ana@example.com");
    });
    expect(document.querySelector("form")).toBeNull();
  });
});
