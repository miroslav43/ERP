// src/components/evaluari/evaluarile-mele.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EvaluareAngajat } from "@/lib/queries/evaluari";

import { EvaluarileMele } from "./evaluarile-mele";

const CRITERII = [
  {
    cod: "calitate",
    denumire: "Calitatea muncii",
    descriere: null,
    tip: "scala",
    scala_max: 5,
    pondere: null,
  },
  {
    cod: "punctual",
    denumire: "Punctualitate",
    descriere: null,
    tip: "da_nu",
    scala_max: 1,
    pondere: null,
  },
  { cod: "obs", denumire: "Observații", descriere: null, tip: "text", scala_max: 0, pondere: null },
] as const;

const evaluare = (
  id: string,
  data: string,
  scor: number | null,
  procent: number | null,
  extra: Partial<EvaluareAngajat> = {},
): EvaluareAngajat => ({
  id,
  data_evaluarii: data,
  status: "finalizat",
  concluzie: null,
  sablon: "Evaluare anuală standard",
  versiune_sablon: 1,
  criterii: CRITERII,
  raspunsuri: [
    { criteriu_cod: "calitate", scor, raspuns_text: null, comentariu: null },
    { criteriu_cod: "punctual", scor: 1, raspuns_text: null, comentariu: null },
    { criteriu_cod: "obs", scor: null, raspuns_text: "Foarte implicat", comentariu: null },
  ],
  punctaj: {
    procent,
    punctaj: 0,
    din: 0,
    completate: 2,
    necompletate: 0,
    ponderat: false,
  },
  ...extra,
});

describe("EvaluarileMele", () => {
  it("fără evaluări: spune când vor apărea, nu o listă goală", () => {
    render(<EvaluarileMele evaluari={[]} />);
    expect(screen.getByText("Nicio evaluare finalizată încă")).toBeTruthy();
  });

  it("fiecare evaluare are ancoră, notele în cuvinte, comentariul și concluzia", () => {
    const { container } = render(
      <EvaluarileMele
        evaluari={[
          evaluare("e2", "2026-10-20", 4, 90, {
            concluzie: "Un an foarte bun.",
            raspunsuri: [
              {
                criteriu_cod: "calitate",
                scor: 4,
                raspuns_text: null,
                comentariu: "Atent la detalii",
              },
              { criteriu_cod: "punctual", scor: 1, raspuns_text: null, comentariu: null },
              {
                criteriu_cod: "obs",
                scor: null,
                raspuns_text: "Foarte implicat",
                comentariu: null,
              },
            ],
          }),
        ]}
      />,
    );
    // Notificarea duce la `#evaluare-<id>`.
    const card = container.querySelector("#evaluare-e2") as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getByText("4 din 5")).toBeTruthy();
    expect(within(card).getByText("Da")).toBeTruthy();
    expect(within(card).getByText("Foarte implicat")).toBeTruthy();
    expect(within(card).getByText("Atent la detalii")).toBeTruthy();
    expect(within(card).getByText("Un an foarte bun.")).toBeTruthy();
    // O singură evaluare nu are „evoluție”.
    expect(screen.queryByText("Evoluția în timp")).toBeNull();
  });

  it("evoluția: cronologic, cu diferența doar între evaluări pe același șablon", () => {
    render(
      <EvaluarileMele
        evaluari={[
          // Cele mai noi întâi, cum vin din `evaluariAngajat`.
          evaluare("e3", "2027-10-20", 5, 70, { sablon: "Alt șablon" }),
          evaluare("e2", "2026-10-20", 4, 90),
          evaluare("e1", "2025-10-20", 3, 80),
        ]}
      />,
    );
    const evolutie = screen.getByRole("region", { name: "Evoluția în timp" });
    const randuri = within(evolutie).getAllByRole("listitem");
    expect(randuri.map((r) => r.querySelector("a")?.textContent)).toEqual([
      "20.10.2025",
      "20.10.2026",
      "20.10.2027",
    ]);
    expect(
      within(randuri[1] as HTMLElement).getByText("+10 puncte față de data trecută"),
    ).toBeTruthy();
    // 70 % pe alt șablon nu se scade din 90 % — nicio diferență afișată.
    expect(within(randuri[2] as HTMLElement).queryByText(/față de data trecută/u)).toBeNull();
  });
});
