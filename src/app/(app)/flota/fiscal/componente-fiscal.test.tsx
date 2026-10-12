// src/app/(app)/flota/fiscal/componente-fiscal.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `../actions-fiscal` e un modul `"use server"`: se înlocuiește cu spioni. Ce se
  verifică aici e ce PLEACĂ din casete (cheile schemelor, câmpurile condiționate)
  și ce se arată după un refuz. Verificarea în browser nu e posibilă pe ramura
  asta: baza din cloud n-are încă 0202.
*/
const adaugaRegimFiscal = vi.fn();
const stergeRegimFiscal = vi.fn();
const adaugaNormaConsum = vi.fn();
const stergeNormaConsum = vi.fn();
const salveazaRegimImpozitare = vi.fn();
vi.mock("../actions-fiscal", () => ({
  adaugaRegimFiscal: (...a: unknown[]) => adaugaRegimFiscal(...a),
  stergeRegimFiscal: (...a: unknown[]) => stergeRegimFiscal(...a),
  adaugaNormaConsum: (...a: unknown[]) => adaugaNormaConsum(...a),
  stergeNormaConsum: (...a: unknown[]) => stergeNormaConsum(...a),
  salveazaRegimImpozitare: (...a: unknown[]) => salveazaRegimImpozitare(...a),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/x",
}));
vi.mock("@/components/incarcare/use-incarcare", () => ({
  useSemnalPanaLaRuta: () => () => undefined,
}));

import { golesteToasturi } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";

import { ButonStergePerioada } from "./buton-sterge-perioada";
import { DialogNormaConsum } from "./dialog-norma-consum";
import { DialogRegimFiscal } from "./dialog-regim-fiscal";
import { FormularRegimImpozitare } from "./formular-regim-impozitare";

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

const VEHICUL = "aaaaaaaa-1111-4111-8111-111111111111";
const ANA = "bbbbbbbb-1111-4111-8111-111111111111";
const AZI = "2026-10-12";

const angajati = [
  { id: ANA, full_name: "Ana Pop", marca: "A1" },
  { id: "cccccccc-1111-4111-8111-111111111111", full_name: "Bogdan Ion", marca: null },
];

function refuz(fieldErrors: Record<string, readonly string[]>): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "t",
    },
  };
}

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

function alege(eticheta: RegExp, valoare: string): void {
  fireEvent.change(screen.getByLabelText(eticheta), { target: { value: valoare } });
}

function scrie(eticheta: RegExp, valoare: string): void {
  fireEvent.change(screen.getByLabelText(eticheta), { target: { value: valoare } });
}

beforeEach(() => {
  golesteToasturi();
  for (const spion of [
    adaugaRegimFiscal,
    stergeRegimFiscal,
    adaugaNormaConsum,
    stergeNormaConsum,
    salveazaRegimImpozitare,
    refresh,
  ]) {
    spion.mockReset();
  }
  adaugaRegimFiscal.mockResolvedValue({ ok: true, data: { id: "r1" } });
  stergeRegimFiscal.mockResolvedValue({ ok: true, data: { id: "r1" } });
  adaugaNormaConsum.mockResolvedValue({ ok: true, data: { id: "n1" } });
  stergeNormaConsum.mockResolvedValue({ ok: true, data: { id: "n1" } });
  salveazaRegimImpozitare.mockResolvedValue({ ok: true, data: { id: "o1" } });
});

function deschideRegim(regimSugerat: "peste_3500_sau_9_locuri" | null = null): void {
  render(
    <DialogRegimFiscal
      vehiculId={VEHICUL}
      nrInmatriculare="B-01-ABC"
      regimSugerat={regimSugerat}
      azi={AZI}
      angajati={angajati}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Regim fiscal nou/u }));
}

describe("DialogRegimFiscal", () => {
  it("pornește pe deducere 50%, ziua de azi și proprietatea firmei, fără câmpurile condiționate", async () => {
    deschideRegim();
    expect((screen.getByLabelText(/Regim de deducere/u) as HTMLSelectElement).value).toBe(
      "limitat_50",
    );
    expect(screen.queryByLabelText(/Categoria exceptată/u)).toBeNull();
    expect(screen.queryByLabelText(/Proprietarul mașinii/u)).toBeNull();
    expect(screen.queryByLabelText(/Chiria lunară/u)).toBeNull();

    scrie(/Motivul încadrării/u, "Folosit și în interes personal.");
    await trimite();

    expect(adaugaRegimFiscal).toHaveBeenCalledTimes(1);
    expect(adaugaRegimFiscal.mock.calls[0]?.[0]).toEqual({
      vehicle_id: VEHICUL,
      valabil_de_la: AZI,
      regim: "limitat_50",
      exceptie: "",
      motiv: "Folosit și în interes personal.",
      titlu_folosinta: "proprietate",
      proprietar_employee_id: "",
      chirie_lunara: "",
      contract_numar: "",
      contract_data: "",
    });
  });

  it("fișa unui vehicul greu propune regimul de peste 3.500 kg", () => {
    deschideRegim("peste_3500_sau_9_locuri");
    expect((screen.getByLabelText(/Regim de deducere/u) as HTMLSelectElement).value).toBe(
      "peste_3500_sau_9_locuri",
    );
  });

  it("„categorie exceptată” cere categoria și o trimite", async () => {
    deschideRegim();
    alege(/Regim de deducere/u, "exceptat_categorie");
    alege(/Categoria exceptată/u, "agenti_vanzari_achizitii");
    scrie(/Motivul încadrării/u, "Agenți de vânzări.");
    await trimite();
    expect(adaugaRegimFiscal.mock.calls[0]?.[0]).toMatchObject({
      regim: "exceptat_categorie",
      exceptie: "agenti_vanzari_achizitii",
    });
  });

  it("la alt regim câmpul categoriei dispare și pleacă gol, chiar dacă fusese ales", async () => {
    deschideRegim();
    alege(/Regim de deducere/u, "exceptat_categorie");
    alege(/Categoria exceptată/u, "servicii_plata");
    alege(/Regim de deducere/u, "integral_exclusiv_economic");
    expect(screen.queryByLabelText(/Categoria exceptată/u)).toBeNull();
    scrie(/Motivul încadrării/u, "Folosit exclusiv în activitatea economică.");
    await trimite();
    expect(adaugaRegimFiscal.mock.calls[0]?.[0]).toMatchObject({
      regim: "integral_exclusiv_economic",
      exceptie: "",
    });
  });

  it("mașina personală cere proprietarul, iar chiria apare doar la chirie", async () => {
    deschideRegim();
    alege(/Al cui e vehiculul/u, "comodat");
    expect(screen.getByLabelText(/Proprietarul mașinii/u)).toBeTruthy();
    expect(screen.queryByLabelText(/Chiria lunară/u)).toBeNull();

    alege(/Al cui e vehiculul/u, "chirie_persoana_fizica");
    expect(screen.getByLabelText(/Proprietarul mașinii/u)).toBeTruthy();
    expect(screen.getByLabelText(/Chiria lunară/u)).toBeTruthy();

    alege(/Proprietarul mașinii/u, ANA);
    scrie(/Chiria lunară/u, "1200");
    scrie(/Motivul încadrării/u, "Mașina personală folosită în interes de serviciu.");
    await trimite();
    expect(adaugaRegimFiscal.mock.calls[0]?.[0]).toMatchObject({
      titlu_folosinta: "chirie_persoana_fizica",
      proprietar_employee_id: ANA,
      chirie_lunara: "1200",
    });
  });

  it("vehiculul închiriat arată chiria, nu proprietarul; schimbarea înapoi pe proprietate le golește", async () => {
    deschideRegim();
    alege(/Al cui e vehiculul/u, "inchiriat");
    expect(screen.getByLabelText(/Chiria lunară/u)).toBeTruthy();
    expect(screen.queryByLabelText(/Proprietarul mașinii/u)).toBeNull();

    alege(/Al cui e vehiculul/u, "proprietate");
    scrie(/Motivul încadrării/u, "Proprietatea firmei.");
    await trimite();
    expect(adaugaRegimFiscal.mock.calls[0]?.[0]).toMatchObject({
      titlu_folosinta: "proprietate",
      proprietar_employee_id: "",
      chirie_lunara: "",
    });
  });

  it("refuzul pe regim (peste 3.500 kg pe un vehicul ușor) ajunge lângă câmp", async () => {
    const mesaj = "Regimul „peste 3.500 kg sau peste 9 locuri” nu se potrivește: fișa are 2200 kg.";
    adaugaRegimFiscal.mockResolvedValue(refuz({ regim: [mesaj] }));
    deschideRegim();
    scrie(/Motivul încadrării/u, "Test.");
    await trimite();
    expect(screen.getByText(mesaj)).toBeTruthy();
    expect(screen.getByLabelText(/Regim de deducere/u).getAttribute("aria-invalid")).toBe("true");
  });
});

describe("DialogNormaConsum", () => {
  it("propune consumul declarat și trimite cheile schemei", async () => {
    render(
      <DialogNormaConsum
        vehiculId={VEHICUL}
        nrInmatriculare="B-01-ABC"
        consumDeclarat={7.5}
        azi={AZI}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Normă nouă de consum/u }));
    expect((screen.getByLabelText(/Norma \(litri la 100 km\)/u) as HTMLInputElement).value).toBe(
      "7.5",
    );
    scrie(/Decizia internă \(număr\)/u, "DI-12");
    await trimite();

    expect(adaugaNormaConsum).toHaveBeenCalledTimes(1);
    expect(adaugaNormaConsum.mock.calls[0]?.[0]).toEqual({
      vehicle_id: VEHICUL,
      valabil_de_la: AZI,
      l_100km: "7.5",
      decizie_numar: "DI-12",
      decizie_data: "",
      observatii: "",
    });
  });

  it("fără consum declarat, norma pornește goală; refuzul pe normă ajunge lângă câmp", async () => {
    adaugaNormaConsum.mockResolvedValue(refuz({ l_100km: ["Norma e între 0,01 și 300."] }));
    render(
      <DialogNormaConsum
        vehiculId={VEHICUL}
        nrInmatriculare="B-01-ABC"
        consumDeclarat={null}
        azi={AZI}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Normă nouă de consum/u }));
    expect((screen.getByLabelText(/Norma \(litri la 100 km\)/u) as HTMLInputElement).value).toBe(
      "",
    );
    await trimite();
    expect(screen.getByText("Norma e între 0,01 și 300.")).toBeTruthy();
  });
});

describe("ButonStergePerioada", () => {
  it("regimul: confirmarea cheamă stergeRegimFiscal cu id-ul și vehiculul, apoi reîmprospătează", async () => {
    render(
      <ButonStergePerioada
        fel="regim"
        perioadaId="r1"
        vehiculId={VEHICUL}
        descriere="Deducere 50%"
        dela="de la 01.01.2026"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Șterge regimul Deducere 50%/u }));
    fireEvent.click(screen.getByRole("button", { name: "Șterge regimul" }));
    await waitFor(() => {
      expect(stergeRegimFiscal).toHaveBeenCalledWith({ id: "r1", vehicle_id: VEHICUL });
    });
    expect(stergeNormaConsum).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("norma: cheamă stergeNormaConsum, nu stergeRegimFiscal", async () => {
    render(
      <ButonStergePerioada
        fel="norma"
        perioadaId="n1"
        vehiculId={VEHICUL}
        descriere="7,5 l/100 km"
        dela="de la 01.03.2026"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Șterge norma 7,5 l\/100 km/u }));
    fireEvent.click(screen.getByRole("button", { name: "Șterge norma" }));
    await waitFor(() => {
      expect(stergeNormaConsum).toHaveBeenCalledWith({ id: "n1", vehicle_id: VEHICUL });
    });
    expect(stergeRegimFiscal).not.toHaveBeenCalled();
  });

  it("un refuz nu reîmprospătează pagina", async () => {
    stergeRegimFiscal.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "Regimul fiscal nu a fost șters.", requestId: "t" },
    });
    render(
      <ButonStergePerioada
        fel="regim"
        perioadaId="r1"
        vehiculId={VEHICUL}
        descriere="Deducere 50%"
        dela="de la 01.01.2026"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Șterge regimul Deducere 50%/u }));
    fireEvent.click(screen.getByRole("button", { name: "Șterge regimul" }));
    await waitFor(() => {
      expect(stergeRegimFiscal).toHaveBeenCalled();
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("FormularRegimImpozitare", () => {
  it("arată regimul salvat și trimite alegerea", async () => {
    render(<FormularRegimImpozitare regimCurent="profit" />);
    const camp = screen.getByLabelText(/Regimul de impozitare al firmei/u) as HTMLSelectElement;
    expect(camp.value).toBe("profit");
    fireEvent.change(camp, { target: { value: "micro" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Salvează regimul/u }));
    });
    await waitFor(() => {
      expect(salveazaRegimImpozitare).toHaveBeenCalledWith({ regim_impozitare: "micro" });
    });
  });

  it("firma fără regim pornește pe „Nestabilit”, iar golul pleacă gol", async () => {
    render(<FormularRegimImpozitare regimCurent={null} />);
    expect(
      (screen.getByLabelText(/Regimul de impozitare al firmei/u) as HTMLSelectElement).value,
    ).toBe("");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Salvează regimul/u }));
    });
    await waitFor(() => {
      expect(salveazaRegimImpozitare).toHaveBeenCalledWith({ regim_impozitare: "" });
    });
  });

  it("refuzul bazei ajunge lângă câmp", async () => {
    salveazaRegimImpozitare.mockResolvedValue(refuz({ regim_impozitare: ["Alegeți regimul."] }));
    render(<FormularRegimImpozitare regimCurent="profit" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Salvează regimul/u }));
    });
    await waitFor(() => {
      expect(screen.getByText("Alegeți regimul.")).toBeTruthy();
    });
  });
});
