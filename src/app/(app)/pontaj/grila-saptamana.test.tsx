import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configZiDin } from "@/domain/attendance/calcul-ore";
import { INTERVAL_IMPLICIT } from "@/domain/attendance/grila-orara";

import { GrilaSaptamana, type ZiGrila } from "./grila-saptamana";
import type { IntrareZiClient } from "./intrare-client";

/*
  Cele două margini ale lumii, tăiate ca să rămână în cadru grila.

  `./actions` e un modul `"use server"`: importat, trage după el `createAction` și
  deci `server-only`, care aruncă la import. Proiectul `ui` din `vitest.config.mts`
  NU are aliasul de stub pe care îl are `unit` — iar lărgirea configurației
  partajate pentru un singur test ar fi o schimbare cu mult mai mare decât testul.
  Ce se verifică aici e ce ajunge ÎN dialog, nu ce pleacă din el.

  `useRouter` cere contextul App Router, care într-un DOM simulat nu există.
*/
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./actions", () => ({
  salveazaZiPontaj: vi.fn(),
  decideZiPontaj: vi.fn(),
  stergeZiPontaj: vi.fn(),
}));

/**
 * Ce apără fișierul ăsta: că tragerea ajunge în dialog cu ORA pe care omul a
 * trasat-o, și că un bloc existent chiar are înălțime pe ecran.
 *
 * Niciuna dintre celelalte porți n-o vede. `tsc` acceptă la fel de bine un
 * procent calculat greșit; `eslint` n-are noțiunea de geometrie; testele din
 * `domain/attendance/grila-orara.test.ts` verifică aritmetica, dar nu și că
 * marcajul chiar o folosește; iar `build` nu randează nimic (paginile sunt
 * dinamice). O grilă desenată cu o oră mai sus arată perfect normal.
 *
 * ── DE CE SE FALSIFICĂ `getBoundingClientRect` ────────────────────────────
 * `happy-dom` nu calculează layout: fără falsificare, orice dreptunghi are
 * înălțimea 0, iar fracțiunea de pointer ar fi mereu 0. Dreptunghiul fals dă
 * grilei exact înălțimea ferestrei implicite în minute (960 px = un pixel pe
 * minut), deci un `clientY` se citește direct ca minutul dorit.
 */

const CONFIG = configZiDin(null);
const INALTIME = INTERVAL_IMPLICIT.pana - INTERVAL_IMPLICIT.de; // 960 px = 960 minute
const SUS = 100;

function intrare(peste: Partial<IntrareZiClient> = {}): IntrareZiClient {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    oraInceput: "08:00",
    oraSfarsit: "16:00",
    oreLucrate: 8,
    oreSuplimentare: 0,
    oreNoapte: 0,
    tipZi: "lucratoare",
    tipPrezenta: "birou",
    esteDinConcediu: false,
    aprobat: false,
    respins: false,
    motivRespingere: null,
    observatii: null,
    ...peste,
  };
}

const NUME = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"] as const;

function zile(peste: Partial<ZiGrila>[] = []): readonly ZiGrila[] {
  return NUME.map((nume, index) => ({
    data: `2026-08-${String(24 + index).padStart(2, "0")}`,
    zi: nume,
    numarZi: String(24 + index),
    etichetaLunga: `${nume}, ${String(24 + index)}.08.2026`,
    intrare: null,
    nelucratoare: null,
    editabila: true,
    motivBlocare: null,
    ...peste[index],
  }));
}

function randeaza(zileGrila: readonly ZiGrila[] = zile()) {
  return render(
    <GrilaSaptamana
      zile={zileGrila}
      interval={INTERVAL_IMPLICIT}
      config={CONFIG}
      intervalPropus={{ inceput: "09:00", sfarsit: "17:00" }}
      angajatId={null}
      eticheta="Popescu Ion"
      poateAproba={false}
      poateSterge
      azi="2026-08-26"
    />,
  );
}

/** Trage de la un minut la altul în coloana zilei, ca un maus. */
function trage(buton: HTMLElement, deLaMinut: number, panaLaMinut: number): void {
  const y = (minut: number): number => SUS + (minut - INTERVAL_IMPLICIT.de);
  fireEvent.pointerDown(buton, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    clientY: y(deLaMinut),
  });
  fireEvent.pointerMove(buton, { pointerId: 1, clientY: y(panaLaMinut) });
  fireEvent.pointerUp(buton, { pointerId: 1 });
  fireEvent.click(buton, { detail: 1 });
}

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: SUS,
    left: 0,
    bottom: SUS + INALTIME,
    right: 100,
    width: 100,
    height: INALTIME,
    x: 0,
    y: SUS,
    toJSON: () => ({}),
  });
  // `<dialog>` nu e implementat în happy-dom; `CelulaZi` îl deschide cu
  // `showModal()` într-un efect, iar fără el testul ar cădea în afara subiectului.
  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GrilaSaptamana", () => {
  it("dă fiecărei zile un singur buton, cu ziua în numele accesibil", () => {
    randeaza();
    const butoane = screen.getAllByRole("button");
    expect(butoane).toHaveLength(7);
    expect(butoane[0]?.getAttribute("aria-label")).toContain("Luni, 24.08.2026");
    expect(butoane[0]?.getAttribute("aria-label")).toContain("fără pontaj");
  });

  it("numele accesibil poartă ce spune culoarea: interval, ore, stare", () => {
    randeaza(zile([{ intrare: intrare({ aprobat: true }) }]));
    const eticheta = screen.getAllByRole("button")[0]?.getAttribute("aria-label") ?? "";
    expect(eticheta).toContain("08:00–16:00");
    expect(eticheta).toContain("8:00 ore");
    expect(eticheta).toContain("aprobat");
  });

  it("ziua blocată n-are buton, iar motivul rămâne citibil", () => {
    // Motivul e „perioada este blocată", nu „luna nu a fost deschisă": a doua
    // stare nu mai există de la 0132, fiindcă luna se naște deschisă la prima
    // scriere. Un test care o folosea ca exemplu ținea în viață un text pe care
    // ecranul nu-l mai poate produce.
    randeaza(zile([{ editabila: false, motivBlocare: "perioada este blocată" }]));
    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByText(/perioada este blocată/u)).toBeDefined();
  });

  it("tragerea deschide dialogul cu ORA trasă, aliniată la sfert", () => {
    /*
      Testul purtător. Se trage de la 09:00 la 17:30 pe coloana de luni; dialogul
      trebuie să se deschidă cu exact intervalul ăla, nu cu cel propus de firmă
      (09:00–17:00) și nu cu unul decalat de o eroare de aritmetică.
    */
    randeaza();
    const luni = screen.getAllByRole("button")[0];
    expect(luni).toBeDefined();
    trage(luni as HTMLElement, 9 * 60, 17 * 60 + 30);

    const deLa = screen.getByLabelText("Ora început") as HTMLInputElement;
    const panaLa = screen.getByLabelText("Ora sfârșit") as HTMLInputElement;
    expect(deLa.value).toBe("09:00");
    expect(panaLa.value).toBe("17:30");
  });

  it("tragerea de jos în sus dă același interval", () => {
    randeaza();
    const luni = screen.getAllByRole("button")[0];
    trage(luni as HTMLElement, 17 * 60 + 30, 9 * 60);

    expect((screen.getByLabelText("Ora început") as HTMLInputElement).value).toBe("09:00");
    expect((screen.getByLabelText("Ora sfârșit") as HTMLInputElement).value).toBe("17:30");
  });

  it("orele lucrate se derivă din intervalul tras, nu rămân la implicitul de 8", () => {
    randeaza();
    const luni = screen.getAllByRole("button")[0];
    trage(luni as HTMLElement, 9 * 60, 13 * 60);
    expect((screen.getByLabelText("Ore lucrate") as HTMLInputElement).value).toBe("4:00");
  });

  it("clickul simplu pe o zi goală deschide intervalul propus de firmă", () => {
    randeaza();
    const luni = screen.getAllByRole("button")[0];
    fireEvent.click(luni as HTMLElement, { detail: 1 });
    expect((screen.getByLabelText("Ora început") as HTMLInputElement).value).toBe("09:00");
    expect((screen.getByLabelText("Ora sfârșit") as HTMLInputElement).value).toBe("17:00");
  });

  it("clickul simplu pe o zi pontată deschide ORA EI, nu pe cea propusă", () => {
    // Regresia de care depinde totul: un click nevinovat n-are voie să rescrie
    // ora unei zile deja completate.
    randeaza(zile([{ intrare: intrare({ oraInceput: "07:30", oraSfarsit: "15:30" }) }]));
    const luni = screen.getAllByRole("button")[0];
    fireEvent.click(luni as HTMLElement, { detail: 1 });
    expect((screen.getByLabelText("Ora început") as HTMLInputElement).value).toBe("07:30");
    expect((screen.getByLabelText("Ora sfârșit") as HTMLInputElement).value).toBe("15:30");
  });

  it("blocul zilei chiar are înălțime — 8 ore din 16 înseamnă jumătate de coloană", () => {
    // Poziționarea în procente se prăbușește tăcut dacă părintele n-are înălțime.
    const { container } = randeaza(zile([{ intrare: intrare() }]));
    // Înălțimea în procente e semnătura blocului: containerul grilei o are în
    // `rem`, iar liniile de ceas au doar `top`. Exact unul, deci: o săptămână cu
    // o singură zi pontată n-are voie să deseneze două.
    const blocuri = [...container.querySelectorAll<HTMLElement>("[style]")].filter((el) =>
      el.style.height.endsWith("%"),
    );
    expect(blocuri).toHaveLength(1);
    expect(blocuri[0]?.style.height).toBe("50%");
    expect(blocuri[0]?.style.top).toBe("12.5%");
  });
});
