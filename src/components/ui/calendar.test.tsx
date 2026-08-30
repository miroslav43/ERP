// src/components/ui/calendar.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Calendar, type PropsCalendar } from "./calendar";

/**
 * Ce apără fișierul ăsta: un calendar greșit nu aruncă nicio eroare — arată
 * doar zilele în coloana greșită.
 *
 * Clasele de defecte verificate aici sunt exact cele pe care nici typecheck-ul,
 * nici lint-ul, nici ochiul liber nu le prind: luna care începe în coloana
 * greșită, decembrie care trece în ianuarie ACELAȘI an, ziua stinsă de `min`
 * care totuși se poate apăsa, Escape care închide dialogul din jur în loc de
 * panou, sărbătoarea dublă din care se vede una singură.
 *
 * `azi` se injectează în toate testele. Un calendar care își citește singur
 * ceasul dă teste care încep să pice la miezul nopții — sau peste un an.
 *
 * Fără `jest-dom`: depozitul nu-l are, iar testele existente citesc DOM-ul
 * direct (`.value`, `.disabled`, `getAttribute`). Aceeași convenție aici.
 */

/** 30 august 2026 e o duminică; luna începe sâmbătă. Bun pentru marginile grilei. */
const AZI = "2026-08-30";

function randeaza(supra: Partial<PropsCalendar> = {}) {
  const onAlege = vi.fn();
  const rezultat = render(<Calendar azi={AZI} onAlege={onAlege} {...supra} />);
  return { ...rezultat, onAlege };
}

/** Butonul unei zile din luna afișată, găsit după numărul scris pe el. */
function zi(numar: number): HTMLButtonElement {
  const element = screen.getByRole("button", { name: new RegExp(`^${String(numar)} `, "u") });
  if (!(element instanceof HTMLButtonElement)) throw new Error(`Ziua ${numar} lipsește.`);
  return element;
}

function antet(): string {
  return screen.getByRole("heading", { level: 2 }).textContent ?? "";
}

function numele(buton: HTMLElement): string {
  return buton.getAttribute("aria-label") ?? "";
}

describe("Calendar — ce lună se vede", () => {
  it("deschide pe luna valorii, nu pe luna curentă", () => {
    randeaza({ valoare: "2026-02-11" });
    expect(antet()).toBe("februarie 2026");
  });

  it("deschide pe luna de azi când nu există nicio valoare", () => {
    randeaza({ valoare: null });
    expect(antet()).toBe("august 2026");
  });

  it("trece la luna următoare", () => {
    randeaza();
    fireEvent.click(screen.getByRole("button", { name: "Luna următoare" }));
    expect(antet()).toBe("septembrie 2026");
  });

  /**
   * Rostogolirea anului la trecerea peste decembrie. Scrisă separat fiindcă e
   * greșeala clasică a unui `luna + 1` fără rest: în decembrie ar apărea „luna
   * 13 2026” — sau, mai rău, „ianuarie 2026”, adică unsprezece luni înapoi.
   */
  it("din decembrie trece în ianuarie anul următor", () => {
    randeaza({ valoare: "2026-12-15" });
    fireEvent.click(screen.getByRole("button", { name: "Luna următoare" }));
    expect(antet()).toBe("ianuarie 2027");
  });

  it("din ianuarie trece înapoi în decembrie anul precedent", () => {
    randeaza({ valoare: "2026-01-15" });
    fireEvent.click(screen.getByRole("button", { name: "Luna precedentă" }));
    expect(antet()).toBe("decembrie 2025");
  });

  /**
   * Săgețile de an nu sunt un moft. `data_nasterii` din fișa angajatului cade
   * cu patruzeci de ani în urmă: fără ele, alegerea ar cere ~480 de clicuri.
   */
  it("sare un an întreg dintr-un singur clic", () => {
    randeaza();
    fireEvent.click(screen.getByRole("button", { name: "Anul precedent" }));
    expect(antet()).toBe("august 2025");
  });

  /**
   * 29 februarie 2028 există; 2027 n-are 29. Săritura de an dintr-o zi
   * inexistentă în anul-țintă nu are voie să producă „2 martie” tăcut.
   */
  it("nu inventează 29 februarie într-un an nebisect", () => {
    randeaza({ valoare: "2028-02-29" });
    fireEvent.click(screen.getByRole("button", { name: "Anul precedent" }));
    expect(antet()).toBe("februarie 2027");
  });
});

describe("Calendar — grila", () => {
  it("începe săptămâna luni, nu duminică", () => {
    randeaza();
    const capete = screen.getAllByRole("columnheader");
    expect(capete).toHaveLength(7);
    expect(capete[0]?.textContent).toContain("luni");
    expect(capete[6]?.textContent).toContain("duminică");
  });

  /**
   * August 2026 începe sâmbătă: prima săptămână are cinci căsuțe goale, apoi 1
   * și 2. Dacă ziua 1 ar ateriza în prima coloană, tot restul lunii ar fi
   * deplasat cu cinci zile — și nimic nu s-ar plânge.
   */
  it("așază ziua 1 în coloana zilei ei reale de săptămână", () => {
    randeaza();
    const celule = screen.getAllByRole("cell");
    expect(celule[0]?.textContent).toBe("");
    expect(celule[5]?.textContent).toBe("1");
  });

  it("dă fiecărei zile un nume citibil, nu doar cifra", () => {
    randeaza();
    expect(numele(zi(30))).toBe("30 august 2026");
  });

  it("marchează ziua de azi", () => {
    randeaza();
    expect(zi(30).getAttribute("data-azi")).toBe("true");
    expect(zi(29).hasAttribute("data-azi")).toBe(false);
  });

  it("marchează ziua aleasă cu `aria-pressed`, nu doar cu o culoare", () => {
    randeaza({ valoare: "2026-08-12" });
    expect(zi(12).getAttribute("aria-pressed")).toBe("true");
    expect(zi(13).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("Calendar — weekend și sărbători", () => {
  it("hașurează sâmbăta și duminica", () => {
    randeaza();
    // 1 august 2026 e sâmbătă, 3 august e luni.
    expect(zi(1).className).toContain("hasura");
    expect(zi(3).className).not.toContain("hasura");
  });

  it("spune în numele zilei ce sărbătoare e", () => {
    randeaza({ valoare: "2026-12-01" });
    expect(numele(zi(1))).toBe("1 decembrie 2026, Ziua Națională a României");
  });

  /**
   * Perechea de componentă a testului din `sarbatori.test.ts`: 1 iunie 2026 e
   * și Ziua Copilului, și a doua zi de Rusalii. Dacă harta pierde una, se vede
   * abia aici — în ce citește omul.
   */
  it("arată ambele sărbători ale unei zile duble", () => {
    randeaza({ valoare: "2026-06-01" });
    expect(numele(zi(1))).toBe("1 iunie 2026, Ziua Copilului · A doua zi de Rusalii");
  });

  it("nu marchează ca sărbătoare o zi obișnuită", () => {
    randeaza();
    expect(numele(zi(20))).toBe("20 august 2026");
  });
});

describe("Calendar — alegerea", () => {
  it("trimite ziua în ISO, nu în format românesc", () => {
    const { onAlege } = randeaza();
    fireEvent.click(zi(7));
    expect(onAlege).toHaveBeenCalledWith("2026-08-07");
  });

  it("stinge zilele dinaintea lui `min` și nu le lasă apăsate", () => {
    const { onAlege } = randeaza({ min: "2026-08-10" });
    expect(zi(9).disabled).toBe(true);
    expect(zi(10).disabled).toBe(false);
    fireEvent.click(zi(9));
    expect(onAlege).not.toHaveBeenCalled();
  });

  it("stinge zilele de după `max`", () => {
    randeaza({ max: "2026-08-10" });
    expect(zi(11).disabled).toBe(true);
    expect(zi(10).disabled).toBe(false);
  });
});

describe("Calendar — tastatura", () => {
  it("mută focusul cu o zi la dreapta", () => {
    randeaza({ valoare: "2026-08-12" });
    zi(12).focus();
    fireEvent.keyDown(zi(12), { key: "ArrowRight" });
    expect(document.activeElement).toBe(zi(13));
  });

  it("mută focusul cu o săptămână în sus, peste marginea de rând", () => {
    randeaza({ valoare: "2026-08-12" });
    zi(12).focus();
    fireEvent.keyDown(zi(12), { key: "ArrowUp" });
    expect(document.activeElement).toBe(zi(5));
  });

  /**
   * Săgeata care iese din lună schimbă luna. Fără asta, capătul grilei e un zid
   * și primele zile ale lunii următoare nu se pot atinge de la tastatură.
   */
  it("săgeata care iese din lună aduce luna următoare", () => {
    randeaza({ valoare: "2026-08-31" });
    zi(31).focus();
    fireEvent.keyDown(zi(31), { key: "ArrowRight" });
    expect(antet()).toBe("septembrie 2026");
  });

  /**
   * Panoul ajunge în `dialog-cerere-noua.tsx`, care e un `<dialog>` deschis cu
   * `showModal()`. Escape acolo e o „cerere de închidere” a browserului, iar
   * specificația spune că NU se procesează dacă `keydown` a fost anulat. Fără
   * `preventDefault()`, prima apăsare ar închide dialogul cu formularul cu tot.
   * Exact capcana plătită o dată în `combobox.tsx`.
   */
  it("Escape închide panoul și oprește evenimentul, ca să nu cadă dialogul din jur", () => {
    const onInchide = vi.fn();
    randeaza({ valoare: "2026-08-12", onInchide });
    const eveniment = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    zi(12).dispatchEvent(eveniment);
    expect(onInchide).toHaveBeenCalledTimes(1);
    expect(eveniment.defaultPrevented).toBe(true);
  });

  /**
   * Tabindex rulant: din tot panoul, o singură zi e în ordinea de tabulare.
   * Altfel Tab ar parcurge 31 de butoane înainte să iasă din calendar.
   */
  it("ține o singură zi în ordinea de tabulare", () => {
    randeaza({ valoare: "2026-08-12" });
    const inTabulare = screen
      .getAllByRole("button")
      .filter((buton) => buton.getAttribute("tabindex") === "0");
    expect(inTabulare).toHaveLength(1);
    expect(numele(inTabulare[0] as HTMLElement)).toBe("12 august 2026");
  });
});
