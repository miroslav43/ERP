import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormularPolitica } from "./formular-politica";

/*
  `../actions` e un modul `"use server"` care trage după el `server-only`, iar
  `useRouter` cere contextul App Router. Aici se verifică ce se DESENEAZĂ.
*/
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const creeazaPolitica = vi.fn();
vi.mock("../actions", () => ({
  creeazaPolitica: (...argumente: unknown[]) => creeazaPolitica(...argumente) as unknown,
}));

const TARI = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    cod_alpha2: "RO",
    denumire: "România",
    moneda: "RON",
    este_ue: true,
  },
];

const LEGE = [
  {
    valabil_de_la: "2018-07-01",
    diurna_baza_legala_interna: 20,
    multiplu_plafon_neimpozabil: 2.5,
    plafon_salarii_baza_luna: 3,
    sursa: "HG 714/2018",
  },
  {
    valabil_de_la: "2023-04-01",
    diurna_baza_legala_interna: 23,
    multiplu_plafon_neimpozabil: 2.5,
    plafon_salarii_baza_luna: 3,
    sursa: "Ordinul 1235/2023",
  },
];

function randeaza() {
  return render(
    <FormularPolitica tari={TARI} valoriLegale={LEGE} baremuri={[]} dateOcupate={["2026-01-01"]} />,
  );
}

function scrieData(text: string): void {
  const camp = screen.getByLabelText("Valabilă de la");
  fireEvent.change(camp, { target: { value: text } });
  fireEvent.blur(camp);
}

function salveaza(): void {
  fireEvent.click(screen.getByRole("button", { name: "Salvează versiunea nouă" }));
}

describe("FormularPolitica — erorile stau lângă câmp", () => {
  it("trimis gol: fiecare câmp obligatoriu e marcat și își spune eroarea", () => {
    randeaza();
    salveaza();

    expect(screen.getByLabelText("Denumire").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Valabilă de la").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/Alegeți data de la care se aplică politica/u)).toBeTruthy();
    expect(screen.getByText("Completați suma pe zi pentru deplasările în țară.")).toBeTruthy();
    expect(creeazaPolitica).not.toHaveBeenCalled();
  });

  it("o dată din trecut e primită; eroarea de dată dispare", () => {
    randeaza();
    scrieData("01.02.2025");
    salveaza();
    expect(screen.getByLabelText("Valabilă de la").getAttribute("aria-invalid")).toBeNull();
  });

  it("înainte de prima lege încărcată: spune de la ce dată se poate", () => {
    randeaza();
    scrieData("01.01.2017");
    salveaza();
    expect(
      screen.getByText(/Valorile legale ale diurnei sunt încărcate de la 01\.07\.2018/u),
    ).toBeTruthy();
  });

  it("o zi în care începe deja o versiune: o spune, nu trimite", () => {
    randeaza();
    scrieData("01.01.2026");
    salveaza();
    expect(screen.getByText(/Există deja o versiune care începe la 01\.01\.2026/u)).toBeTruthy();
    expect(creeazaPolitica).not.toHaveBeenCalled();
  });
});
