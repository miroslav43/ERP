// src/app/(app)/mentenanta/interventii/campuri-interventie.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StareFormular } from "@/components/ui/formular";

import { CampuriInterventie } from "./campuri-interventie";

/**
 * Câmpurile intervenției în caseta de CORECTARE (M6): pornesc de la valorile
 * existente, iar costul pieselor e doar de citit cât există linii de piese
 * (cazul 32 — liniile câștigă, deci o sumă tastată ar fi o minciună).
 */
function stare(valoriTrimise: Record<string, string> = {}): StareFormular<unknown> {
  return { inCurs: false, erori: {}, eroareGenerala: null, valoriTrimise, data: null };
}

const EXISTENTA = {
  tip: "preventiva",
  data: "2026-09-15",
  descriere: "Revizie anuală.",
  executant_extern: "Service SRL",
  cost_piese: "135",
  cost_manopera: "200",
  rezultat: "reusita",
  numar_document_furnizor: "DEV-7",
  garantie_lucrare_pana: "2027-03-15",
  acoperit_de_garantie: "on",
};

describe("CampuriInterventie — corectarea", () => {
  it("pornește de la valorile intervenției existente, inclusiv garanția", () => {
    render(
      <CampuriInterventie
        stare={stare()}
        idc={(s) => `t-${s}`}
        angajati={[]}
        existenta={EXISTENTA}
      />,
    );
    expect((screen.getByLabelText(/Ce s-a făcut/u) as HTMLTextAreaElement).value).toBe(
      "Revizie anuală.",
    );
    expect((screen.getByLabelText(/Nr. document furnizor/u) as HTMLInputElement).value).toBe(
      "DEV-7",
    );
    expect((screen.getByLabelText(/Garanția lucrării/u) as HTMLInputElement).value).toBe(
      "2027-03-15",
    );
    expect((screen.getByLabelText(/acoperit de garanție/u) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/^Tip/u) as HTMLSelectElement).value).toBe("preventiva");
  });

  it("după o trimitere refuzată, ce a trimis omul bate valoarea existentă; bifa lipsă = nebifată", () => {
    render(
      <CampuriInterventie
        stare={stare({ descriere: "Revizie corectată.", data: "2026-09-16" })}
        idc={(s) => `t-${s}`}
        angajati={[]}
        existenta={EXISTENTA}
      />,
    );
    expect((screen.getByLabelText(/Ce s-a făcut/u) as HTMLTextAreaElement).value).toBe(
      "Revizie corectată.",
    );
    expect((screen.getByLabelText(/acoperit de garanție/u) as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("cu linii de piese: costul pieselor e doar de citit și spune de unde vine", () => {
    render(
      <CampuriInterventie
        stare={stare()}
        idc={(s) => `t-${s}`}
        angajati={[]}
        existenta={EXISTENTA}
        costPieseDinLinii
      />,
    );
    const cost = screen.getByLabelText(/Cost piese/u) as HTMLInputElement;
    expect(cost.readOnly).toBe(true);
    expect(cost.value).toBe("135");
    expect(screen.getByText(/Calculat din piese/u)).toBeTruthy();
  });

  it("fără `document`, câmpul de fișier lipsește; cu el, apare", () => {
    const { container, rerender } = render(
      <CampuriInterventie stare={stare()} idc={(s) => `t-${s}`} angajati={[]} />,
    );
    expect(container.querySelector('input[type="file"]')).toBeNull();
    rerender(
      <CampuriInterventie
        stare={stare()}
        idc={(s) => `t-${s}`}
        angajati={[]}
        document={{ obligatoriu: true }}
      />,
    );
    expect(container.querySelector('input[type="file"][name="document"]')).not.toBeNull();
  });
});
