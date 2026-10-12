// src/app/(app)/flota/amenzi/componente-amenzi.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `../actions-amenzi` e un modul `"use server"`: se înlocuiește cu spioni. Ce se
  verifică aici e ce PLEACĂ din casete (cheile schemelor), ce ofer ele (sugestia,
  stadiile permise) și unde ajunge eroarea bazei. Verificarea în browser nu e
  posibilă: baza din cloud n-are migrarea 0206, deci componentele sunt probate
  doar în happy-dom.
*/
const inregistreazaAmenda = vi.fn();
const actualizeazaAmenda = vi.fn();
const desemneazaSofer = vi.fn();
const retrageDesemnarea = vi.fn();
const trimiteRaspuns = vi.fn();
const schimbaStadiulAmenzii = vi.fn();
const stergeAmenda = vi.fn();
vi.mock("../actions-amenzi", () => ({
  inregistreazaAmenda: (...a: unknown[]) => inregistreazaAmenda(...a),
  actualizeazaAmenda: (...a: unknown[]) => actualizeazaAmenda(...a),
  desemneazaSofer: (...a: unknown[]) => desemneazaSofer(...a),
  retrageDesemnarea: (...a: unknown[]) => retrageDesemnarea(...a),
  trimiteRaspuns: (...a: unknown[]) => trimiteRaspuns(...a),
  schimbaStadiulAmenzii: (...a: unknown[]) => schimbaStadiulAmenzii(...a),
  stergeAmenda: (...a: unknown[]) => stergeAmenda(...a),
}));

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/amenzi",
}));

import { golesteToasturi } from "@/components/ui/toast";
import type { OptiuneSofer, RandAmenda } from "@/lib/queries/flota-amenzi";

import { ButoaneStadiuAmenda, DialogAnulare, DialogRaspuns } from "./actiuni-amenda";
import { DialogAmenda } from "./dialog-amenda";
import { DialogDesemnare } from "./dialog-desemnare";

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

const AMENDA_ID = "a1a1a1a1-1111-4111-8111-111111111111";
const VEHICUL = "b2b2b2b2-2222-4222-8222-222222222222";
const ANA = "c3c3c3c3-3333-4333-8333-333333333333";
const COLEG = "d4d4d4d4-4444-4444-8444-444444444444";

const SOFERI: readonly OptiuneSofer[] = [
  { id: ANA, full_name: "Popescu Ana", marca: "A1", status: "activ" },
  { id: COLEG, full_name: "Ionescu Cornel", marca: null, status: "incetat" },
];

const AMENDA: RandAmenda = {
  id: AMENDA_ID,
  vehicle_id: VEHICUL,
  numar_pv: "PV 12/A",
  data_pv: "2026-10-09",
  constatata_la: "2026-10-09T06:30:00.000Z",
  locul: "DN1, Ploiești",
  fapta: "Depășirea vitezei legale",
  autoritate: "Poliția Rutieră",
  suma: 580,
  primita_la: "2026-10-11",
  termen_raspuns: "2026-10-19",
  stadiu: "primita",
  sofer_desemnat_id: null,
  desemnat_la: null,
  raspuns_trimis_la: null,
  raspuns_numar: null,
  motiv: null,
  observatii: null,
};

function camp(eticheta: RegExp): HTMLInputElement {
  return screen.getByLabelText(eticheta) as HTMLInputElement;
}

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  for (const spion of [
    inregistreazaAmenda,
    actualizeazaAmenda,
    desemneazaSofer,
    retrageDesemnarea,
    trimiteRaspuns,
    schimbaStadiulAmenzii,
    stergeAmenda,
    refresh,
    push,
  ]) {
    spion.mockReset();
  }
  for (const spion of [
    inregistreazaAmenda,
    actualizeazaAmenda,
    desemneazaSofer,
    retrageDesemnarea,
    trimiteRaspuns,
    schimbaStadiulAmenzii,
    stergeAmenda,
  ]) {
    spion.mockResolvedValue({ ok: true, data: { id: AMENDA_ID } });
  }
});

describe("DialogAmenda — amendă nouă", () => {
  const vehicule = [{ id: VEHICUL, nr_inmatriculare: "PH12ABC", marca: "Dacia", model: "Logan" }];

  it("trimite EXACT cheile schemei, cu vehiculul ales", async () => {
    render(<DialogAmenda fel="noua" azi="2026-10-12" vehicule={vehicule} />);
    fireEvent.click(screen.getByRole("button", { name: /Amendă nouă/ }));

    fireEvent.change(camp(/^Vehicul/), { target: { value: VEHICUL } });
    fireEvent.change(camp(/Proces-verbal sau solicitare/), { target: { value: "PV 12/A" } });
    fireEvent.change(camp(/Momentul faptei/), { target: { value: "2026-10-09T09:30" } });
    fireEvent.change(camp(/Fapta constatată/), { target: { value: "Depășirea vitezei legale" } });
    // Caseta de dată vorbește românește (`zz.ll.aaaa`); câmpul ascuns poartă ISO.
    fireEvent.change(camp(/Termen de răspuns/), { target: { value: "19.10.2026" } });
    await trimite();

    expect(inregistreazaAmenda).toHaveBeenCalledTimes(1);
    expect(inregistreazaAmenda.mock.calls[0]?.[0]).toEqual({
      vehicle_id: VEHICUL,
      numar_pv: "PV 12/A",
      data_pv: "",
      constatata_la: "2026-10-09T09:30",
      locul: "",
      fapta: "Depășirea vitezei legale",
      autoritate: "",
      suma: "",
      primita_la: "2026-10-12",
      termen_raspuns: "2026-10-19",
      observatii: "",
    });
    expect(actualizeazaAmenda).not.toHaveBeenCalled();
  });

  it("data primirii pornește de la azi, iar termenul de răspuns NU are valoare implicită", () => {
    render(<DialogAmenda fel="noua" azi="2026-10-12" vehicule={vehicule} />);
    fireEvent.click(screen.getByRole("button", { name: /Amendă nouă/ }));
    expect(camp(/Primită de firmă la/).value).toBe("12.10.2026");
    expect(camp(/Termen de răspuns/).value).toBe("");
  });

  it("eroarea numărului duplicat ajunge sub câmpul lui", async () => {
    inregistreazaAmenda.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: {
          numar_pv: ["Amenda cu acest număr este deja înregistrată pe vehiculul ales."],
        },
        requestId: "t",
      },
    });
    render(<DialogAmenda fel="noua" azi="2026-10-12" vehicule={vehicule} />);
    fireEvent.click(screen.getByRole("button", { name: /Amendă nouă/ }));
    await trimite();
    expect(
      screen.getByText("Amenda cu acest număr este deja înregistrată pe vehiculul ales."),
    ).toBeTruthy();
  });
});

describe("DialogAmenda — corectura", () => {
  it("pornește de la amenda existentă, scrie pe același id și nu trimite vehiculul", async () => {
    render(<DialogAmenda fel="corectura" azi="2026-10-12" amenda={AMENDA} />);
    fireEvent.click(screen.getByRole("button", { name: /Corectează datele/ }));

    expect(camp(/Proces-verbal sau solicitare/).value).toBe("PV 12/A");
    expect(camp(/Suma amenzii/).value).toBe("580");
    // 06:30 UTC = 09:30 ora României (EEST).
    expect(camp(/Momentul faptei/).value).toBe("2026-10-09T09:30");
    fireEvent.change(camp(/Locul faptei/), { target: { value: "DN1, Brazi" } });
    await trimite();

    expect(actualizeazaAmenda).toHaveBeenCalledTimes(1);
    const trimis = actualizeazaAmenda.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(trimis).toMatchObject({ id: AMENDA_ID, locul: "DN1, Brazi", numar_pv: "PV 12/A" });
    expect("vehicle_id" in trimis).toBe(false);
    expect(inregistreazaAmenda).not.toHaveBeenCalled();
  });
});

describe("DialogDesemnare", () => {
  it("cu sugestie: o arată și o precompletează, dar omul poate alege altul", async () => {
    render(
      <DialogDesemnare
        amendaId={AMENDA_ID}
        soferi={SOFERI}
        sugestie={{
          employeeId: ANA,
          text: "Popescu Ana — după foaia de parcurs care acoperă momentul faptei.",
        }}
        curentId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Desemnează șoferul/ }));

    expect(screen.getByText(/după foaia de parcurs care acoperă momentul faptei/)).toBeTruthy();
    expect(camp(/^Șofer/).value).toBe(ANA);

    fireEvent.change(camp(/^Șofer/), { target: { value: COLEG } });
    await trimite();
    expect(desemneazaSofer).toHaveBeenCalledWith({ id: AMENDA_ID, employee_id: COLEG });
  });

  it("fără sugestie: o spune și nu alege nimic în locul omului", () => {
    render(
      <DialogDesemnare amendaId={AMENDA_ID} soferi={SOFERI} sugestie={null} curentId={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Desemnează șoferul/ }));
    expect(screen.getByText("Nicio sugestie")).toBeTruthy();
    expect(camp(/^Șofer/).value).toBe("");
  });

  it("un angajat plecat din firmă rămâne alegere posibilă, marcat ca atare", () => {
    render(
      <DialogDesemnare amendaId={AMENDA_ID} soferi={SOFERI} sugestie={null} curentId={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Desemnează șoferul/ }));
    expect(screen.getByRole("option", { name: /Ionescu Cornel — nu mai e activ/ })).toBeTruthy();
  });

  it("la schimbarea desemnatului pornește de la cel curent, nu de la sugestie", () => {
    render(
      <DialogDesemnare
        amendaId={AMENDA_ID}
        soferi={SOFERI}
        sugestie={{ employeeId: ANA, text: "Popescu Ana — după alocarea vehiculului." }}
        curentId={COLEG}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Schimbă șoferul desemnat/ }));
    expect(camp(/^Șofer/).value).toBe(COLEG);
  });

  it("eroarea de pe `employee_id` ajunge sub selector", async () => {
    desemneazaSofer.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: { employee_id: ["Angajatul ales nu aparține organizației dumneavoastră."] },
        requestId: "t",
      },
    });
    render(
      <DialogDesemnare amendaId={AMENDA_ID} soferi={SOFERI} sugestie={null} curentId={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Desemnează șoferul/ }));
    await trimite();
    expect(screen.getByText("Angajatul ales nu aparține organizației dumneavoastră.")).toBeTruthy();
  });
});

describe("DialogRaspuns și DialogAnulare", () => {
  it("răspunsul trimite data (azi implicit) și numărul de ieșire, cu cheile schemei", async () => {
    render(<DialogRaspuns amendaId={AMENDA_ID} azi="2026-10-12" />);
    fireEvent.click(screen.getByRole("button", { name: /Marchează răspunsul trimis/ }));
    fireEvent.change(camp(/Număr de înregistrare/), { target: { value: "IES-9" } });
    await trimite();
    expect(trimiteRaspuns).toHaveBeenCalledWith({
      id: AMENDA_ID,
      raspuns_trimis_la: "2026-10-12",
      raspuns_numar: "IES-9",
    });
  });

  it("anularea trimite motivul, cu stadiul „anulata”", async () => {
    render(<DialogAnulare amendaId={AMENDA_ID} numarPv="PV 12/A" />);
    fireEvent.click(screen.getByRole("button", { name: /Anulează amenda/ }));
    fireEvent.change(screen.getByLabelText(/Motivul anulării/), {
      target: { value: "Desființată de autoritate" },
    });
    await trimite();
    expect(schimbaStadiulAmenzii).toHaveBeenCalledWith({
      id: AMENDA_ID,
      stadiu: "anulata",
      motiv: "Desființată de autoritate",
    });
  });

  it("anularea fără motiv: eroarea de schemă ajunge sub câmp", async () => {
    schimbaStadiulAmenzii.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: { motiv: ["Scrieți motivul anulării."] },
        requestId: "t",
      },
    });
    render(<DialogAnulare amendaId={AMENDA_ID} numarPv="PV 12/A" />);
    fireEvent.click(screen.getByRole("button", { name: /Anulează amenda/ }));
    await trimite();
    expect(screen.getByText("Scrieți motivul anulării.")).toBeTruthy();
  });
});

describe("ButoaneStadiuAmenda — doar tranzițiile pe care baza le acceptă", () => {
  /** Butoanele vizibile ale rândului; casetele de confirmare (în `<dialog>`) nu contează. */
  function butoane(stadiu: RandAmenda["stadiu"]): string[] {
    const { container } = render(
      <ButoaneStadiuAmenda amendaId={AMENDA_ID} numarPv="PV 12/A" stadiu={stadiu} />,
    );
    return [...container.querySelectorAll("button")]
      .filter((b) => b.closest("dialog") === null)
      .map((b) => b.textContent?.trim() ?? "");
  }

  /** Butonul de confirmare din caseta deschisă, nu cel care a deschis-o. */
  function inCaseta(nume: string): HTMLElement {
    const gasit = screen
      .getAllByRole("button", { name: nume, hidden: true })
      .find((b) => b.closest("dialog") !== null);
    if (gasit === undefined) throw new Error(`Niciun buton „${nume}” într-o casetă.`);
    return gasit;
  }

  it("primită: contestată, plătită, anulează, șterge — nu și retragerea", () => {
    expect(butoane("primita")).toEqual([
      "Marchează contestată",
      "Marchează plătită",
      "Anulează amenda",
      "Șterge",
    ]);
  });

  it("șofer desemnat: retragerea apare, ștergerea dispare", () => {
    const b = butoane("sofer_desemnat");
    expect(b).toContain("Retrage desemnarea");
    expect(b).not.toContain("Șterge");
  });

  it("răspuns trimis: nici retragere, nici ștergere", () => {
    const b = butoane("raspuns_trimis");
    expect(b).not.toContain("Retrage desemnarea");
    expect(b).not.toContain("Șterge");
    expect(b).toContain("Marchează plătită");
  });

  it("contestată: doar plătită și anulată", () => {
    expect(butoane("contestata")).toEqual(["Marchează plătită", "Anulează amenda"]);
  });

  it("plătită și anulată: niciun buton", () => {
    expect(butoane("platita")).toEqual([]);
    expect(butoane("anulata")).toEqual([]);
  });

  it("„Marchează plătită” cere confirmare, apoi trimite stadiul și reîncarcă pagina", async () => {
    render(<ButoaneStadiuAmenda amendaId={AMENDA_ID} numarPv="PV 12/A" stadiu="primita" />);
    fireEvent.click(screen.getAllByRole("button", { name: /Marchează plătită/ })[0]!);
    expect(schimbaStadiulAmenzii).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(inCaseta("Marchează plătită"));
    });
    expect(schimbaStadiulAmenzii).toHaveBeenCalledWith({ id: AMENDA_ID, stadiu: "platita" });
    expect(refresh).toHaveBeenCalled();
  });

  it("ștergerea reușită duce înapoi pe listă; eroarea o lasă pe fișă", async () => {
    render(<ButoaneStadiuAmenda amendaId={AMENDA_ID} numarPv="PV 12/A" stadiu="primita" />);
    fireEvent.click(screen.getByRole("button", { name: "Șterge" }));
    await act(async () => {
      fireEvent.click(inCaseta("Șterge amenda"));
    });
    expect(stergeAmenda).toHaveBeenCalledWith({ id: AMENDA_ID });
    expect(push).toHaveBeenCalledWith("/flota/amenzi");
  });

  it("o eroare a acțiunii nu reîncarcă și nu navighează", async () => {
    stergeAmenda.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Amenda nu a fost ștearsă.",
        fieldErrors: null,
        requestId: "t",
      },
    });
    render(<ButoaneStadiuAmenda amendaId={AMENDA_ID} numarPv="PV 12/A" stadiu="primita" />);
    fireEvent.click(screen.getByRole("button", { name: "Șterge" }));
    await act(async () => {
      fireEvent.click(inCaseta("Șterge amenda"));
    });
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
