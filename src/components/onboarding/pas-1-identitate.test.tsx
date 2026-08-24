// src/components/onboarding/pas-1-identitate.test.tsx
import { act, render, screen } from "@testing-library/react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";

import { Pas1Identitate } from "./pas-1-identitate";

/**
 * Ce apără fișierul: că mesajul de validare AJUNGE la cititorul de ecran.
 *
 * Înainte, fiecare câmp avea eroarea într-un `<p id="…-eroare">` pe care nimic
 * nu-l referea: `aria-describedby` arăta spre textul de ajutor, iar la
 * câmpurile fără ajutor lipsea de tot. Marcajul arăta corect la citire —
 * identificatorul chiar era acolo — și niciun typecheck, lint sau test nu se
 * uita la legătură. Asta e exact clasa de defect pentru care există proiectul
 * ăsta de teste.
 */

function Gazda({
  laFormular,
}: {
  readonly laFormular: (f: UseFormReturn<OnboardeazaOrganizatieInput>) => void;
}) {
  const formular = useForm<OnboardeazaOrganizatieInput>({
    defaultValues: { forma_juridica: "SRL", judet: "Cluj" } as Partial<OnboardeazaOrganizatieInput>,
  });
  laFormular(formular);
  return <Pas1Identitate formular={formular} idFormular="t" />;
}

function monteaza() {
  let formular: UseFormReturn<OnboardeazaOrganizatieInput> | null = null;
  const rezultat = render(
    <form>
      <Gazda
        laFormular={(f) => {
          formular = f;
        }}
      />
    </form>,
  );
  if (formular === null) throw new Error("Formularul nu a fost expus.");
  return { ...rezultat, formular: formular as UseFormReturn<OnboardeazaOrganizatieInput> };
}

// Etichetele se caută ANCORAT, nu prin potrivire liberă: `Camp` adaugă la
// etichetă o steluță plus «(obligatoriu)» în `sr-only`, deci numele accesibil
// normalizat e «Denumire *(obligatoriu)». Un tipar neancorat pe «Denumire» ar
// prinde și «Denumire completă (statut)», iar `getByLabelText` ar arunca fiindcă
// găsește două.
//
// (Comentariul e pe linii, nu în bloc: un tipar ancorat scris în bloc ar conține
// secvența care ÎNCHIDE comentariul, iar fișierul ar înceta să compileze — s-a
// întâmplat exact aici.)

/** Textul la care trimite `aria-describedby` al unui control. */
function descrierea(control: HTMLElement, container: HTMLElement): string {
  const ids = (control.getAttribute("aria-describedby") ?? "").split(" ").filter((x) => x !== "");
  return ids
    .map((id) => container.querySelector(`#${CSS.escape(id)}`)?.textContent ?? "")
    .join(" ");
}

describe("Pasul 1 — eroarea ajunge la cititorul de ecran", () => {
  it("`aria-describedby` trimite la mesajul de eroare, nu doar la ajutor", () => {
    const { container, formular } = monteaza();
    act(() => {
      formular.setError("name", { message: "Denumirea este obligatorie." });
    });
    const camp = screen.getByLabelText(/^Denumire \*/);
    expect(camp.getAttribute("aria-invalid")).toBe("true");
    expect(descrierea(camp, container)).toContain("Denumirea este obligatorie.");
  });

  it("un câmp CU ajutor le poartă pe amândouă, eroarea prima", () => {
    // Ordinea nu e cosmetică: cine aude „format aaaa-ll-zz" după „câmpul e
    // obligatoriu" primește explicația imediat după problemă.
    const { container, formular } = monteaza();
    act(() => {
      formular.setError("legal_name", { message: "Lipsește denumirea din statut." });
    });
    const camp = screen.getByLabelText(/^Denumire completă/);
    const text = descrierea(camp, container);
    expect(text).toContain("Lipsește denumirea din statut.");
    expect(text).toContain("actul constitutiv");
    expect(text.indexOf("Lipsește")).toBeLessThan(text.indexOf("actul constitutiv"));
  });

  it("fără eroare, controlul nu se declară nevalid", () => {
    monteaza();
    expect(screen.getByLabelText(/^Denumire \*/).getAttribute("aria-invalid")).toBeNull();
  });

  it('mesajul are `role="alert"`, deci se anunță când apare', () => {
    const { formular } = monteaza();
    act(() => {
      formular.setError("oras", { message: "Localitatea este obligatorie." });
    });
    expect(screen.getByRole("alert").textContent).toContain("Localitatea este obligatorie.");
  });
});

describe("Pasul 1 — câmpurile obligatorii se anunță ca atare", () => {
  it("steluța nu e singurul semn: există și textul pentru cititorul de ecran", () => {
    // O steluță roșie e informație purtată NUMAI prin culoare și formă
    // (WCAG 1.4.1). `Camp` o dublează cu „(obligatoriu)" în `sr-only`.
    monteaza();
    expect(screen.getAllByText("(obligatoriu)").length).toBeGreaterThan(5);
  });

  it("controlul poartă `required`, nu doar eticheta", () => {
    monteaza();
    expect((screen.getByLabelText(/^Denumire \*/) as HTMLInputElement).required).toBe(true);
    expect((screen.getByLabelText(/^Cod poștal/) as HTMLInputElement).required).toBe(false);
  });
});

describe("Pasul 1 — sectorul apare doar pentru București", () => {
  it("ascuns la alt județ", () => {
    monteaza();
    expect(screen.queryByLabelText(/^Sector/)).toBeNull();
  });

  it("apare când județul e București", () => {
    const { formular } = monteaza();
    act(() => {
      formular.setValue("judet", "București");
    });
    expect(screen.getByLabelText(/^Sector/)).toBeDefined();
  });
});

// `vi` e importat ca fișierul să declare explicit că NU folosește mock-uri:
// pașii sunt componente pure peste `useForm`, deci se randează întregi.
void vi;
