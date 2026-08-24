// src/components/ui/dialog.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmareActiune, Dialog, PanouLateral } from "./dialog";

/**
 * Regula pe care o apără fișierul: **o confirmare care nu spune consecința nu e
 * o confirmare, e o formalitate.**
 *
 * Sunt ~30 de acțiuni ireversibile în aplicație — aprobarea unei perioade de
 * salarizare, blocarea lunii de pontaj, casarea unui obiect, „Marchează
 * decontată" din care nu se mai iese prin trigger — și niciuna nu întreabă
 * nimic azi. Ce oprește greșeala nu e întrebarea „Sigur?", ci propoziția care
 * spune ce se întâmplă și pe câți îi atinge.
 */

/**
 * `<dialog>` nativ: mediul de test nu implementează întotdeauna `showModal`.
 * Îl completăm cu o variantă care face exact ce ne interesează — pune `open` —
 * ca testele să verifice contractul componentei, nu al browserului.
 */
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

describe("Dialog", () => {
  it("leagă titlul și descrierea de dialog pentru cititorul de ecran", () => {
    render(
      <Dialog
        deschis
        laInchidere={() => {}}
        titlu="Blochează luna"
        descriere="Nu se mai poate scrie."
      >
        <p>Corp.</p>
      </Dialog>,
    );
    const d = document.querySelector("dialog");
    expect(d).not.toBeNull();
    const idTitlu = d?.getAttribute("aria-labelledby");
    const idDescriere = d?.getAttribute("aria-describedby");
    expect(idTitlu).toBeTruthy();
    expect(document.getElementById(idTitlu ?? "")?.textContent).toBe("Blochează luna");
    expect(document.getElementById(idDescriere ?? "")?.textContent).toBe("Nu se mai poate scrie.");
  });

  it("Escape cere închiderea prin React, nu doar în DOM", () => {
    // Fără `preventDefault` pe `cancel`, `<dialog>` s-ar închide singur, iar
    // starea din React ar rămâne „deschis": a doua deschidere n-ar mai face
    // nimic, fiindcă prop-ul nu s-ar fi schimbat.
    const inchide = vi.fn();
    render(<Dialog deschis laInchidere={inchide} titlu="Titlu" />);
    const d = document.querySelector("dialog");
    act(() => {
      fireEvent(d!, new Event("cancel", { bubbles: false, cancelable: true }));
    });
    expect(inchide).toHaveBeenCalledTimes(1);
  });

  it("clicul pe fundal închide, clicul pe conținut NU", () => {
    const inchide = vi.fn();
    render(
      <Dialog deschis laInchidere={inchide} titlu="Titlu">
        <p>Conținut.</p>
      </Dialog>,
    );
    const d = document.querySelector("dialog");
    act(() => fireEvent.click(d!));
    expect(inchide).toHaveBeenCalledTimes(1);

    act(() => fireEvent.click(screen.getByText("Conținut.")));
    expect(inchide).toHaveBeenCalledTimes(1);
  });

  it("butonul de închidere are nume accesibil", () => {
    render(<Dialog deschis laInchidere={() => {}} titlu="Titlu" />);
    expect(screen.getByRole("button", { name: "Închide" })).toBeDefined();
  });
});

describe("ConfirmareActiune", () => {
  const bazaProps = {
    deschis: true,
    laInchidere: () => {},
    titlu: "Aprobă perioada de salarizare",
    consecinta: "Perioada se închide definitiv și fluturașii devin vizibili angajaților.",
    etichetaConfirmare: "Aprobă",
    laConfirmare: () => {},
  } as const;

  it("consecința e vizibilă, nu ascunsă într-un titlu generic", () => {
    render(<ConfirmareActiune {...bazaProps} />);
    expect(screen.getByText(bazaProps.consecinta)).toBeDefined();
  });

  it("arată cifrele afectate, ca frână înainte de clic", () => {
    render(
      <ConfirmareActiune
        {...bazaProps}
        cifre={[
          { eticheta: "Angajați", valoare: "48" },
          { eticheta: "Total brut", valoare: "612.400 lei" },
        ]}
      />,
    );
    expect(screen.getByText("Angajați")).toBeDefined();
    expect(screen.getByText("48")).toBeDefined();
    expect(screen.getByText("612.400 lei")).toBeDefined();
  });

  it("distructivul folosește butonul conturat, niciodată cel plin", () => {
    render(<ConfirmareActiune {...bazaProps} distructiv etichetaConfirmare="Casează" />);
    const b = screen.getByRole("button", { name: "Casează" });
    expect(b.className).toContain("border-danger");
    expect(b.className).toContain("hover:bg-danger");
    expect(b.className).not.toMatch(/(^|\s)bg-danger(\s|$)/);
  });

  it("`cereTastare` ține butonul blocat până se scrie cuvântul exact", () => {
    render(<ConfirmareActiune {...bazaProps} cereTastare="APROB" />);
    const b = screen.getByRole("button", { name: "Aprobă" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);

    const camp = screen.getByLabelText(/Scrieți/) as HTMLInputElement;
    act(() => fireEvent.change(camp, { target: { value: "aprob" } }));
    expect((screen.getByRole("button", { name: "Aprobă" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    act(() => fireEvent.change(camp, { target: { value: "APROB" } }));
    expect((screen.getByRole("button", { name: "Aprobă" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("cuvântul tastat NU rămâne de la o deschidere la alta", () => {
    // Altfel a doua confirmare ar porni deja deblocată, adică exact frâna
    // scoasă tocmai când e mai nevoie de ea.
    const { rerender } = render(<ConfirmareActiune {...bazaProps} cereTastare="APROB" />);
    act(() => fireEvent.change(screen.getByLabelText(/Scrieți/), { target: { value: "APROB" } }));
    expect((screen.getByRole("button", { name: "Aprobă" }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    rerender(<ConfirmareActiune {...bazaProps} deschis={false} cereTastare="APROB" />);
    rerender(<ConfirmareActiune {...bazaProps} deschis cereTastare="APROB" />);
    expect((screen.getByRole("button", { name: "Aprobă" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("«Renunță» există întotdeauna și e prima ieșire", () => {
    const inchide = vi.fn();
    render(<ConfirmareActiune {...bazaProps} laInchidere={inchide} />);
    act(() => screen.getByRole("button", { name: "Renunță" }).click());
    expect(inchide).toHaveBeenCalled();
  });

  it("cât timp lucrează, ambele butoane sunt blocate", () => {
    render(<ConfirmareActiune {...bazaProps} inCurs />);
    expect((screen.getByRole("button", { name: "Renunță" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const confirma = screen.getByRole("button", { name: /Se execută/ }) as HTMLButtonElement;
    expect(confirma.disabled).toBe(true);
    expect(confirma.getAttribute("aria-busy")).toBe("true");
  });
});

/**
 * ── DE CE SE VERIFICĂ NIȘTE CLASE ─────────────────────────────────────────
 * jsdom nu așază nimic: n-are înălțime de fereastră, nu calculează `dvh` și nu
 * știe ce e o zonă de derulare. Un test „butonul Salvează e vizibil" ar trece
 * și pe varianta stricată, fiindcă acolo nimic nu era ascuns logic — doar
 * desenat în afara ecranului.
 *
 * Ce se poate verifica deci e CONTRACTUL structural, cel care produce
 * comportamentul în browser: caseta e o coloană cu înălțime mărginită, corpul e
 * singura parte care se micșorează și derulează, antetul și subsolul nu. Cele
 * trei clase de mai jos sunt exact cele a căror lipsă făcea butonul de neatins
 * pe telefon.
 */
describe("Dialog — înălțime mărginită și derulare", () => {
  it("mărginește înălțimea casetei, ca să nu crească în afara ecranului", () => {
    render(
      <Dialog deschis laInchidere={() => {}} titlu="Funcție nouă">
        <p>Corp.</p>
      </Dialog>,
    );
    const clase = document.querySelector("dialog")?.className ?? "";
    expect(clase).toContain("flex-col");
    expect(clase).toMatch(/max-h-\[92dvh\]/u);
    expect(clase).toMatch(/md:max-h-\[calc\(100dvh-4rem\)\]/u);
  });

  it("corpul derulează, antetul și subsolul rămân pe loc", () => {
    render(
      <Dialog
        deschis
        laInchidere={() => {}}
        titlu="Funcție nouă"
        subsol={<button type="button">Salvează</button>}
      >
        <p>Corp.</p>
      </Dialog>,
    );

    const corp = screen.getByText("Corp.").parentElement;
    expect(corp?.className).toContain("overflow-y-auto");
    // Fără `min-h-0`, implicitul flexbox `min-height: auto` refuză micșorarea,
    // iar corpul împinge subsolul în afara casetei în loc să deruleze.
    expect(corp?.className).toContain("min-h-0");
    expect(corp?.className).toContain("flex-1");

    const subsol = screen.getByRole("button", { name: "Salvează" }).parentElement;
    expect(subsol?.className).toContain("shrink-0");
  });

  it("pe telefon e foaie lipită jos, pe desktop rămâne casetă centrată", () => {
    render(
      <Dialog deschis laInchidere={() => {}} titlu="Funcție nouă">
        <p>Corp.</p>
      </Dialog>,
    );
    const clase = document.querySelector("dialog")?.className ?? "";
    // `mb-0` anulează doar marginea automată de jos: caseta cade la baza
    // ecranului fără poziționare absolută.
    expect(clase).toContain("mb-0");
    expect(clase).toContain("rounded-b-none");
    expect(clase).toContain("md:m-auto");
    expect(clase).toContain("md:rounded-panou");
  });
});

/**
 * ── DE CE SE VERIFICĂ MĂRIMEA ȘI CÂRLIGUL DE DIRECȚIE ─────────────────────
 * `LATIME` e o hartă: o mărime adăugată acolo fără să ajungă pe element ar
 * trece neobservată, fiindcă dialogul s-ar randa oricum, doar îngust. Iar
 * `data-panou="lateral"` e singura legătură dintre `PanouLateral` și regula din
 * `globals.css` care îi dă direcția de intrare; ștearsă, panoul ar continua să
 * funcționeze și ar intra de jos, ca o casetă — o regresie pe care niciun alt
 * test n-ar prinde-o.
 */
describe("Dialog — mărimi și cârligul de mișcare", () => {
  it("mărimea „lucru” pune lățimea de atelier pe element", () => {
    render(
      <Dialog deschis laInchidere={() => {}} titlu="Constructor" marime="lucru">
        <p>Corp.</p>
      </Dialog>,
    );
    expect(document.querySelector("dialog")?.className).toContain("max-w-5xl");
  });

  it("mărimea implicită rămâne cea medie", () => {
    render(
      <Dialog deschis laInchidere={() => {}} titlu="Ceva">
        <p>Corp.</p>
      </Dialog>,
    );
    expect(document.querySelector("dialog")?.className).toContain("max-w-lg");
  });

  it("panoul lateral se declară ca lateral, ca să intre dinspre marginea lui", () => {
    render(
      <PanouLateral deschis laInchidere={() => {}} titlu="Evaluare nouă">
        <p>Corp.</p>
      </PanouLateral>,
    );
    expect(document.querySelector("dialog")?.getAttribute("data-panou")).toBe("lateral");
  });

  it("caseta obișnuită NU e marcată ca panou", () => {
    render(
      <Dialog deschis laInchidere={() => {}} titlu="Ceva">
        <p>Corp.</p>
      </Dialog>,
    );
    expect(document.querySelector("dialog")?.hasAttribute("data-panou")).toBe(false);
  });
});
