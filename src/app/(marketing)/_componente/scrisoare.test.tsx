import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  citesteCererea,
  scrisoareaCererii,
} from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-model";
import { TIPURI_CERERE } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/variante";
import { SEMNATURA_FISIER } from "@/lib/unelte/document-tabelar";

import { ScrisoarePrevizualizata } from "./scrisoare";

/**
 * Auditul din 8 oct 2026: previzualizarea variantelor „fără plată” și
 * „eveniment” nu avea linii de semnătură, deși fișierele le aveau. Acum toate
 * variantele trec prin aceeași componentă, din același model ca fișierele.
 */
const PARAMETRI = {
  salariat: "Ilie Maria",
  angajator: "Exemplu SRL",
  de_la: "2026-11-16",
  pana_la: "2026-11-20",
  data: "2026-09-01",
  prog_de_la: "2026-11-12",
  prog_pana_la: "2026-11-25",
};

describe("previzualizarea scrisorii", () => {
  it.each(TIPURI_CERERE)(
    "%s: pe ecran sunt semnătura salariatului și rubrica angajatorului",
    (tip) => {
      const parametri =
        tip === "reprogramare"
          ? { ...PARAMETRI, tip, prog_de_la: "2026-08-03", prog_pana_la: "2026-08-07" }
          : { ...PARAMETRI, tip };
      const citita = citesteCererea(new URLSearchParams(parametri), "2026-09-01");
      expect(citita.probleme).toEqual([]);
      const { getByText, container } = render(
        <ScrisoarePrevizualizata scrisoare={scrisoareaCererii(citita)} />,
      );
      for (const t of [
        "Către: Exemplu SRL",
        "CERERE",
        "Semnătura salariatului",
        "Se completează de angajator",
        "☐ Se aprobă / ☐ Nu se aprobă",
        "Șef ierarhic",
        "Resurse umane",
        "Conducătorul unității",
      ]) {
        expect(getByText(t), `${tip}: ${t}`).toBeTruthy();
      }
      expect(container.textContent).not.toContain(SEMNATURA_FISIER);
    },
  );

  it("„Către” la dreapta și „CERERE” centrat, ca în fișiere", () => {
    const citita = citesteCererea(new URLSearchParams(PARAMETRI), "2026-09-01");
    const { getByText } = render(<ScrisoarePrevizualizata scrisoare={scrisoareaCererii(citita)} />);
    expect(getByText("Către: Exemplu SRL").className).toContain("text-right");
    expect(getByText("CERERE").className).toContain("text-center");
  });

  it("semnătura rămâne în dreapta și când la 360 px coboară sub loc și dată", () => {
    // Rândul are `flex-wrap`: pe ecran îngust, coloana semnăturii trece pe rândul
    // următor și, fără `ml-auto`, cădea la stânga (verificarea headless din F14).
    const citita = citesteCererea(new URLSearchParams(PARAMETRI), "2026-09-01");
    const { getByText } = render(<ScrisoarePrevizualizata scrisoare={scrisoareaCererii(citita)} />);
    expect(getByText("Semnătura salariatului").parentElement?.className).toContain("ml-auto");
  });
});
