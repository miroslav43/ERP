// src/components/ui/intrare-data.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Camp } from "./camp";
import { IntrareData, type PropsIntrareData } from "./intrare-data";

/**
 * Ce apără fișierul ăsta: un câmp de dată arată impecabil și e complet inutil
 * dacă valoarea nu ajunge în `FormData`, dacă trimite `30.08.2026` unde baza
 * așteaptă `2026-08-30`, sau dacă panoul înghite Escape-ul dialogului din jur.
 * Niciuna dintre astea nu produce vreo eroare, nicăieri.
 *
 * Ziua de referință e injectată peste tot (`azi`), ca testele să nu înceapă să
 * pice la miezul nopții.
 */

const AZI = "2026-08-30";

function randeaza(supra: Partial<PropsIntrareData> = {}) {
  const onSchimba = vi.fn();
  const rezultat = render(
    <form>
      <IntrareData name="data_inceput" azi={AZI} onSchimba={onSchimba} {...supra} />
    </form>,
  );
  return { ...rezultat, onSchimba };
}

function caseta(): HTMLInputElement {
  const element = screen.getByRole("textbox");
  if (!(element instanceof HTMLInputElement)) throw new Error("Caseta lipsește.");
  return element;
}

function campAscuns(container: HTMLElement): HTMLInputElement {
  const element = container.querySelector('input[type="hidden"]');
  if (!(element instanceof HTMLInputElement)) throw new Error("Câmpul ascuns lipsește.");
  return element;
}

function deschideCalendarul(): void {
  fireEvent.click(screen.getByRole("button", { name: "Deschide calendarul" }));
}

describe("IntrareData — ce ajunge la server", () => {
  /**
   * Bucata fără de care primitiva ar fi decorativă. Tiparul dominant al
   * proiectului e `<form action>` + `FormData`; un câmp care ține data doar în
   * `useState` nu apare în `FormData`, deci acțiunea primește `null` și
   * răspunde „câmp obligatoriu” peste o dată chiar aleasă.
   */
  it("trimite ziua în ISO, nu în format românesc", () => {
    const { container } = randeaza({ implicit: "2026-08-30" });
    const formular = container.querySelector("form");
    if (!(formular instanceof HTMLFormElement)) throw new Error("Formularul lipsește.");
    expect(new FormData(formular).get("data_inceput")).toBe("2026-08-30");
  });

  /**
   * Dacă ar avea și caseta `name`, `FormData` ar purta sub aceeași cheie și
   * `30.08.2026`, și `2026-08-30`. `formData.get()` întoarce prima valoare,
   * deci defectul ar fi tăcut — și ar ajunge la Postgres ca `22007`.
   */
  it("caseta vizibilă nu are `name`", () => {
    randeaza({ implicit: "2026-08-30" });
    expect(caseta().hasAttribute("name")).toBe(false);
  });

  /** Un câmp dezactivat nu se trimite. Lecția e a comboboxului. */
  it("nu trimite nimic când e dezactivat", () => {
    const { container } = randeaza({ implicit: "2026-08-30", disabled: true });
    expect(campAscuns(container).disabled).toBe(true);
  });

  it("arată data în formatul românesc, nu în ISO", () => {
    randeaza({ implicit: "2026-08-30" });
    expect(caseta().value).toBe("30.08.2026");
  });

  it("pornește gol când nu primește nimic", () => {
    const { container } = randeaza();
    expect(caseta().value).toBe("");
    expect(campAscuns(container).value).toBe("");
  });
});

describe("IntrareData — tastarea", () => {
  it("citește o dată scrisă de mână și o predă în ISO", () => {
    const { container, onSchimba } = randeaza();
    fireEvent.change(caseta(), { target: { value: "15.03.2026" } });
    fireEvent.blur(caseta());
    expect(onSchimba).toHaveBeenCalledWith("2026-03-15");
    expect(campAscuns(container).value).toBe("2026-03-15");
  });

  it("acceptă și ziua sau luna scrise cu o singură cifră", () => {
    const { container } = randeaza();
    fireEvent.change(caseta(), { target: { value: "5.3.2026" } });
    fireEvent.blur(caseta());
    expect(campAscuns(container).value).toBe("2026-03-05");
    // La ieșirea din câmp, textul se rescrie canonic.
    expect(caseta().value).toBe("05.03.2026");
  });

  /**
   * 31 februarie se poate TASTA, dar nu există. `parseDateRo` o respinge deja;
   * ce se verifică aici e că respingerea se VEDE, în loc să plece un câmp gol
   * spre server.
   */
  it("respinge o zi inexistentă în calendar", () => {
    const { container } = randeaza();
    fireEvent.change(caseta(), { target: { value: "31.02.2026" } });
    fireEvent.blur(caseta());
    expect(campAscuns(container).value).toBe("");
    expect(caseta().getAttribute("aria-invalid")).toBe("true");
  });

  it("lasă textul greșit pe ecran, ca omul să vadă CE a scris", () => {
    randeaza();
    fireEvent.change(caseta(), { target: { value: "aiurea" } });
    fireEvent.blur(caseta());
    expect(caseta().value).toBe("aiurea");
  });

  /**
   * Mesajul nativ al browserului e ancorat de caseta vizibilă, nu de câmpul
   * ascuns — altfel browserul ar refuza trimiterea arătând spre un element pe
   * care nimeni nu-l vede, și formularul ar părea blocat fără motiv.
   */
  it("refuză trimiterea cu un text care nu e o dată", () => {
    randeaza();
    fireEvent.change(caseta(), { target: { value: "31.02.2026" } });
    fireEvent.blur(caseta());
    expect(caseta().validity.valid).toBe(false);
    expect(caseta().validationMessage).toBe("Scrieți data ca zz.ll.aaaa.");
  });

  it("redevine validă după o corectură", () => {
    randeaza();
    fireEvent.change(caseta(), { target: { value: "31.02.2026" } });
    fireEvent.blur(caseta());
    fireEvent.change(caseta(), { target: { value: "28.02.2026" } });
    fireEvent.blur(caseta());
    expect(caseta().validity.valid).toBe(true);
    expect(caseta().getAttribute("aria-invalid")).toBeNull();
  });

  it("golirea casetei predă șirul gol, nu ultima valoare", () => {
    const { container, onSchimba } = randeaza({ implicit: "2026-08-30" });
    fireEvent.change(caseta(), { target: { value: "" } });
    fireEvent.blur(caseta());
    expect(onSchimba).toHaveBeenCalledWith("");
    expect(campAscuns(container).value).toBe("");
  });
});

describe("IntrareData — calendarul", () => {
  it("panoul e închis până se cere", () => {
    randeaza();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("se deschide pe luna valorii", () => {
    randeaza({ implicit: "2026-02-11" });
    deschideCalendarul();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("februarie 2026");
  });

  it("alegerea unei zile umple ambele câmpuri și închide panoul", () => {
    const { container, onSchimba } = randeaza({ implicit: "2026-08-30" });
    deschideCalendarul();
    fireEvent.click(screen.getByRole("button", { name: "7 august 2026" }));
    expect(onSchimba).toHaveBeenCalledWith("2026-08-07");
    expect(campAscuns(container).value).toBe("2026-08-07");
    expect(caseta().value).toBe("07.08.2026");
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  /** Focusul se întoarce în casetă: altfel Tab ar reporni din capul paginii. */
  it("dă focusul înapoi casetei după alegere", () => {
    randeaza({ implicit: "2026-08-30" });
    deschideCalendarul();
    fireEvent.click(screen.getByRole("button", { name: "7 august 2026" }));
    expect(document.activeElement).toBe(caseta());
  });

  it("duce `min` și `max` mai departe în panou", () => {
    randeaza({ implicit: "2026-08-30", min: "2026-08-10" });
    deschideCalendarul();
    const nouaAugust = screen.getByRole("button", { name: "9 august 2026" });
    expect((nouaAugust as HTMLButtonElement).disabled).toBe(true);
  });

  /**
   * Panoul se deschide pe ce s-a TASTAT, chiar dacă textul n-a fost încă
   * predat. Altfel omul scrie 11.02.2026, deschide calendarul ca să verifice
   * ziua din săptămână și primește luna curentă.
   */
  it("se deschide pe luna tastată, nu pe cea curentă", () => {
    randeaza();
    fireEvent.change(caseta(), { target: { value: "11.02.2026" } });
    deschideCalendarul();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("februarie 2026");
  });

  it("Escape închide panoul și lasă caseta cu focus", () => {
    randeaza({ implicit: "2026-08-30" });
    deschideCalendarul();
    fireEvent.keyDown(screen.getByRole("button", { name: "30 august 2026" }), { key: "Escape" });
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(document.activeElement).toBe(caseta());
  });

  it("un clic în afara câmpului închide panoul", () => {
    randeaza({ implicit: "2026-08-30" });
    deschideCalendarul();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

describe("IntrareData — legătura cu `Camp`", () => {
  /**
   * `Camp` dă `aria-invalid` și `aria-describedby` prin funcția de randare.
   * Dacă primitiva le-ar înghiți, mesajul de eroare al serverului ar rămâne pe
   * ecran fără nimic care să-l lege de câmpul vinovat.
   */
  it("păstrează legătura ARIA primită de la `Camp`", () => {
    render(
      <Camp nume="data_inceput" eticheta="Data de început" erori={["Data e obligatorie."]}>
        {(atribute) => <IntrareData {...atribute} azi={AZI} />}
      </Camp>,
    );
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("camp-data_inceput-eroare");
  });

  it("eticheta lui `Camp` arată spre caseta vizibilă", () => {
    render(
      <Camp nume="data_inceput" eticheta="Data de început">
        {(atribute) => <IntrareData {...atribute} azi={AZI} />}
      </Camp>,
    );
    expect(screen.getByLabelText("Data de început")).toBe(screen.getByRole("textbox"));
  });
});
