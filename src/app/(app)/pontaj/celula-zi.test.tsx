import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { configZiDin } from "@/domain/attendance/calcul-ore";

import { CelulaZi } from "./celula-zi";
import type { IntrareZiClient } from "./intrare-client";

/*
  Aceleași două margini tăiate ca în `grila-saptamana.test.tsx`: `./actions` e un
  modul `"use server"` care trage după el `server-only`, iar `useRouter` cere
  contextul App Router. Ce se verifică aici e ce se DESENEAZĂ, nu ce pleacă.
*/
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./actions", () => ({
  salveazaZiPontaj: vi.fn(),
  decideZiPontaj: vi.fn(),
  stergeZiPontaj: vi.fn(),
}));

const CONFIG = configZiDin(null);

function intrare(peste: Partial<IntrareZiClient> = {}): IntrareZiClient {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    oraInceput: "08:00",
    oraSfarsit: "16:00",
    oreLucrate: 8,
    oreSuplimentare: 0,
    oreNoapte: 0,
    tipZi: "lucratoare",
    tipPrezenta: null,
    esteDinConcediu: false,
    aprobat: false,
    respins: false,
    motivRespingere: null,
    observatii: null,
    ...peste,
  };
}

function randeaza(peste: Partial<React.ComponentProps<typeof CelulaZi>> = {}) {
  return render(
    <CelulaZi
      angajatId={null}
      data="2026-09-01"
      eticheta="Marți, 1 septembrie 2026"
      intrare={null}
      poateSterge={false}
      config={CONFIG}
      poateAproba={false}
      onInchide={vi.fn()}
      {...peste}
    />,
  );
}

beforeEach(() => {
  /*
    `<dialog>` nu e implementat în happy-dom; componenta cheamă `showModal()`
    într-un efect, iar fără falsificare testul ar cădea în afara subiectului.

    Falsul CHIAR pune `open`, nu doar numără apelul. Un `<dialog>` fără atributul
    `open` e `display: none`, deci tot conținutul lui iese din arborele de
    accesibilitate: `getByRole` n-ar găsi niciun buton, iar testele de mai jos ar
    trece sau ar cădea din alt motiv decât cel pe care-l urmăresc.
  */
  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  }
});

describe("CelulaZi — centrarea casetei", () => {
  /*
    GARDĂ DE CLASĂ, nu de aspect. Testul ăsta NU poate vedea că dialogul e
    centrat: happy-dom nu calculează layout, iar `getComputedStyle` n-ar arăta
    nici măcar `margin` venit din foaia browserului, fiindcă foaia browserului nu
    există aici.

    Ce poate verifica e că nu dispare clasa care ține locul regulii UA anulate de
    preflight-ul Tailwind (`margin: 0` pe `*`). Fără `m-auto`, `<dialog>`
    deschis cu `showModal()` se lipește de colțul stânga-sus — defectul reparat
    în 0118, și același tipar cu `inset: 0` primit de `popover="manual"`.

    Dacă cineva rescrie lista de clase și pierde `m-auto`, aici e singurul loc
    din lanțul de verificare unde se aude ceva.
  */
  it("păstrează `m-auto` pe `<dialog>` — fără el, caseta cade în colț", () => {
    const { container } = randeaza();
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain("m-auto");
  });

  it("mărginește înălțimea și lasă corpul să deruleze", () => {
    const { container } = randeaza();
    const clase = container.querySelector("dialog")?.className ?? "";
    expect(clase).toContain("overflow-y-auto");
    expect(clase).toContain("max-h-[calc(100dvh-4rem)]");
  });
});

describe("CelulaZi — locul de muncă", () => {
  it("propune „La birou” pentru o zi nouă", () => {
    randeaza();
    const camp = screen.getByLabelText("Loc de muncă");
    expect((camp as HTMLSelectElement).value).toBe("birou");
  });

  /*
    O zi salvată înainte de 0118 n-a declarat niciun loc. Precompletată cu
    „birou", următorul „Salvează" ar fi scris în bază o declarație pe care n-a
    făcut-o nimeni — exact motivul pentru care coloana e nullable.
  */
  it("lasă „Nedeclarat” pentru o zi existentă fără loc declarat", () => {
    randeaza({ intrare: intrare() });
    expect((screen.getByLabelText("Loc de muncă") as HTMLSelectElement).value).toBe("");
  });

  it("arată locul salvat al unei zile pontate de acasă", () => {
    randeaza({ intrare: intrare({ tipPrezenta: "homeoffice" }) });
    expect((screen.getByLabelText("Loc de muncă") as HTMLSelectElement).value).toBe("homeoffice");
  });

  it("oferă cele patru trepte ale planului, plus „Nedeclarat”", () => {
    randeaza();
    const optiuni = [...screen.getByLabelText("Loc de muncă").querySelectorAll("option")].map(
      (o) => o.value,
    );
    expect(optiuni).toEqual(["", "birou", "homeoffice", "deplasare", "delegatie"]);
  });
});

describe("CelulaZi — secțiunea de decizie", () => {
  it("nu desenează butoanele de decizie fără drept de aprobare", () => {
    randeaza({ intrare: intrare() });
    expect(screen.queryByRole("button", { name: /Aprobă ziua/u })).toBeNull();
  });

  /*
    `poateAproba` poartă DOUĂ condiții compuse pe server (`file-pontaj.ts`):
    permisiunea și alegerea firmei de a avea un pas de aprobare. Firma care a
    stins-o îl primește `false`, deci ecranul arată exact ca pentru cineva fără
    drept — ceea ce e și înțelesul corect: nu există nimic de decis.
  */
  it("le desenează când aprobarea e activă și omul are dreptul", () => {
    randeaza({ intrare: intrare(), poateAproba: true });
    expect(screen.getByRole("button", { name: /Aprobă ziua/u })).not.toBeNull();
  });
});
