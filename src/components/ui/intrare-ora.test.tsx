// src/components/ui/intrare-ora.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { IntrareDurata, IntrareOra } from "./intrare-ora";

/**
 * Ce apără fișierul ăsta: promisiunea că nicăieri în produs nu apare `AM`/`PM`
 * și nicio oră scrisă zecimal.
 *
 * Regula nu se poate verifica din tipuri — un `<input type="time">` are exact
 * aceeași semnătură și trece typecheck-ul fără să clipească, în timp ce pe un
 * Chrome în engleză scrie `05:30 PM`. Și nu se poate verifica nici privind
 * ecranul, fiindcă depinde de limba browserului fiecărui utilizator.
 *
 * Se testează, deci: că valoarea CANONICĂ e cea care ajunge la părinte și în
 * `FormData`, că zecimala e refuzată la intrare, și că un câmp controlat
 * urmează valoarea recalculată de părinte fără să piardă ce se tastează.
 */

function camp(eticheta: string): HTMLInputElement {
  const element = screen.getByLabelText(eticheta);
  if (!(element instanceof HTMLInputElement)) throw new Error("Câmpul nu e un input.");
  return element;
}

function campAscuns(container: HTMLElement): HTMLInputElement {
  const element = container.querySelector('input[type="hidden"]');
  if (!(element instanceof HTMLInputElement)) throw new Error("Câmpul ascuns lipsește.");
  return element;
}

describe("IntrareOra", () => {
  it("nu randează niciodată controlul nativ de oră", () => {
    // Cu `type="time"`, formatul îl alege limba browserului — exact defectul.
    const { container } = render(<IntrareOra aria-label="Ora" />);
    expect(container.querySelector('input[type="time"]')).toBeNull();
  });

  it("pune singur două punctele, tastă cu tastă", () => {
    // Ce se cere de la om: patru cifre. Nimic altceva — nici `:`, nici Tab.
    const laSchimbare = vi.fn();
    render(<IntrareOra aria-label="Ora" onSchimba={laSchimbare} />);

    fireEvent.change(camp("Ora"), { target: { value: "8" } });
    expect(camp("Ora").value).toBe("08:");
    fireEvent.change(camp("Ora"), { target: { value: "08:3" } });
    expect(camp("Ora").value).toBe("08:3");
    fireEvent.change(camp("Ora"), { target: { value: "08:30" } });
    expect(camp("Ora").value).toBe("08:30");

    fireEvent.blur(camp("Ora"));
    expect(laSchimbare).toHaveBeenCalledWith("08:30");
  });

  it("așteaptă a doua cifră a orei când aceasta poate avea două", () => {
    render(<IntrareOra aria-label="Ora" />);
    fireEvent.change(camp("Ora"), { target: { value: "1" } });
    expect(camp("Ora").value).toBe("1");
    fireEvent.change(camp("Ora"), { target: { value: "17" } });
    expect(camp("Ora").value).toBe("17:");
  });

  it("păstrează ora de după-amiază pe 24, nu o rescrie în ceas de 12", () => {
    render(<IntrareOra aria-label="Ora" />);
    fireEvent.change(camp("Ora"), { target: { value: "1730" } });
    fireEvent.blur(camp("Ora"));
    expect(camp("Ora").value).toBe("17:30");
  });

  it("completează ora întreagă lăsată fără minute", () => {
    const laSchimbare = vi.fn();
    render(<IntrareOra aria-label="Ora" onSchimba={laSchimbare} />);
    fireEvent.change(camp("Ora"), { target: { value: "8" } });
    fireEvent.blur(camp("Ora"));
    expect(camp("Ora").value).toBe("08:00");
    expect(laSchimbare).toHaveBeenCalledWith("08:00");
  });

  it("nici nu lasă să se tasteze literele din AM/PM", () => {
    render(<IntrareOra aria-label="Ora" />);
    fireEvent.change(camp("Ora"), { target: { value: "5:30 PM" } });
    expect(camp("Ora").value).toBe("05:30");
  });

  it("ștergerea trece peste două puncte, în loc să se blocheze pe ele", () => {
    // Fără tratare, backspace pe `:` ar lăsa cifrele neatinse, iar masca l-ar
    // pune imediat la loc: tasta n-ar face nimic, oricât ai apăsa-o.
    render(<IntrareOra aria-label="Ora" />);
    fireEvent.change(camp("Ora"), { target: { value: "830" } });
    expect(camp("Ora").value).toBe("08:30");
    fireEvent.change(camp("Ora"), { target: { value: "08:3" } });
    fireEvent.change(camp("Ora"), { target: { value: "08:" } });
    expect(camp("Ora").value).toBe("08:");
    fireEvent.change(camp("Ora"), { target: { value: "08" } });
    expect(camp("Ora").value).toBe("0");
  });

  it("trimite în FormData valoarea canonică, nu ce s-a tastat", () => {
    const { container } = render(<IntrareOra aria-label="Ora" name="ora_inceput" />);
    fireEvent.change(camp("Ora"), { target: { value: "8" } });
    // Chiar înainte de blur: un Enter pe formular nu trece prin `onBlur`.
    expect(campAscuns(container).value).toBe("08:00");
  });

  it("citește secundele cu care sosește o coloană `time`", () => {
    render(<IntrareOra aria-label="Ora" implicit="08:30:00" />);
    expect(camp("Ora").value).toBe("08:30");
  });

  it("sare singur în câmpul următor când a patra cifră închide ora", () => {
    // Grila săptămânii: opt cifre la rând completează o zi, fără Tab.
    render(
      <>
        <IntrareOra aria-label="De la" />
        <IntrareOra aria-label="Până la" />
      </>,
    );
    fireEvent.change(camp("De la"), { target: { value: "0830" } });
    expect(document.activeElement).toBe(camp("Până la"));
  });

  it("predă ora COMPLETĂ la salt, nu pe cea de dinaintea ultimei cifre", () => {
    /*
      Capcana pe care o ascunde saltul: blurul declanșat de mutarea focusului
      rulează cu starea din randarea dinainte de ultima tastă — `08:3` — și,
      lăsat în pace, ar scrie peste `08:30` un `08:03`. O jumătate de oră
      pierdută din pontaj la fiecare zi completată.
    */
    const laSchimbare = vi.fn();
    render(
      <>
        <IntrareOra aria-label="De la" onSchimba={laSchimbare} />
        <IntrareOra aria-label="Până la" />
      </>,
    );
    fireEvent.change(camp("De la"), { target: { value: "0830" } });
    fireEvent.blur(camp("De la"));
    expect(laSchimbare).toHaveBeenCalledTimes(1);
    expect(laSchimbare).toHaveBeenCalledWith("08:30");
    expect(camp("De la").value).toBe("08:30");
  });

  it("selectează ce e în câmpul următor, ca următoarele cifre să-l înlocuiască", () => {
    // Zilele se copiază una peste alta: câmpul următor are deja o oră în el.
    render(
      <>
        <IntrareOra aria-label="De la" />
        <IntrareOra aria-label="Până la" implicit="17:00" />
      </>,
    );
    fireEvent.change(camp("De la"), { target: { value: "0830" } });
    expect(camp("Până la").selectionStart).toBe(0);
    expect(camp("Până la").selectionEnd).toBe("17:00".length);
  });

  it("nu sare la fiecare corecție într-o oră deja completă", () => {
    render(
      <>
        <IntrareOra aria-label="De la" implicit="08:30" />
        <IntrareOra aria-label="Până la" />
      </>,
    );
    camp("De la").focus();
    // Se schimbă minutul într-o oră care era deja plină: focusul rămâne.
    fireEvent.change(camp("De la"), { target: { value: "08:31" } });
    expect(document.activeElement).toBe(camp("De la"));
  });

  it("nu sare când ora rămâne incompletă", () => {
    render(
      <>
        <IntrareOra aria-label="De la" />
        <IntrareOra aria-label="Până la" />
      </>,
    );
    camp("De la").focus();
    fireEvent.change(camp("De la"), { target: { value: "8" } });
    expect(camp("De la").value).toBe("08:");
    expect(document.activeElement).toBe(camp("De la"));
  });

  it("ora imposibilă nici nu se poate tasta", () => {
    // `2` apoi `5`: masca deduce că `2` era ora și `5` e primul minut.
    render(<IntrareOra aria-label="Ora" />);
    fireEvent.change(camp("Ora"), { target: { value: "2500" } });
    expect(camp("Ora").value).toBe("02:50");
  });

  it("plafonează minutul peste 59 în clipa în care ora se închide", () => {
    /*
      Înainte, `17:75` rămânea pe ecran, marcat roșu, și atât. Câmpul ascuns —
      singurul care ajunge în `FormData` — rămâne gol cât timp ora nu e validă,
      deci în planul săptămânii intervalul pleca spre server ca `null`: ziua se
      salva cu zero ore, iar chenarul roșu rămânea într-o pagină pe care omul
      n-o mai privea. Ce se verifică aici e tocmai capătul acela: că valoarea
      chiar ajunge în formular.

      Plafonarea se întâmplă pe `change`, nu pe `blur`: a patra cifră închide
      ora și declanșează saltul automat, care predă valoarea pe loc.
    */
    const laSchimbare = vi.fn();
    const { container } = render(
      <IntrareOra aria-label="Ora" name="ora_inceput" onSchimba={laSchimbare} />,
    );
    fireEvent.change(camp("Ora"), { target: { value: "1775" } });

    expect(camp("Ora").value).toBe("17:59");
    expect(camp("Ora").getAttribute("aria-invalid")).toBeNull();
    expect(campAscuns(container).value).toBe("17:59");
    expect(laSchimbare).toHaveBeenCalledWith("17:59");
  });
});

describe("IntrareDurata", () => {
  it("scrie jumătatea de oră ca 8:30, nu ca 8,5", () => {
    render(<IntrareDurata aria-label="Ore" implicit={8.5} />);
    expect(camp("Ore").value).toBe("8:30");
  });

  it("trimite mai departe zecimala, fiindcă baza înmulțește cu tariful orar", () => {
    const laSchimbare = vi.fn();
    const { container } = render(
      <IntrareDurata aria-label="Ore" name="ore_lucrate" onSchimba={laSchimbare} />,
    );
    fireEvent.change(camp("Ore"), { target: { value: "7:45" } });
    fireEvent.blur(camp("Ore"));
    expect(laSchimbare).toHaveBeenCalledWith(7.75);
    expect(campAscuns(container).value).toBe("7.75");
  });

  it("refuză zecimala tastată, în loc s-o citească drept altceva", () => {
    // Dacă virgula ar fi tăiată din câmp, `8,5` ar deveni `85` — optzeci și
    // cinci de ore, plauzibile într-un total și imposibil de observat.
    const laSchimbare = vi.fn();
    render(<IntrareDurata aria-label="Ore" onSchimba={laSchimbare} />);
    fireEvent.change(camp("Ore"), { target: { value: "8,5" } });
    fireEvent.blur(camp("Ore"));
    expect(camp("Ore").value).toBe("8,5");
    expect(laSchimbare).not.toHaveBeenCalled();
    expect(camp("Ore").getAttribute("aria-invalid")).toBe("true");
  });

  it("golirea câmpului raportează null, nu zero", () => {
    // Zero ore lucrate și „nu s-a completat" nu sunt același lucru pe un pontaj.
    const laSchimbare = vi.fn();
    render(<IntrareDurata aria-label="Ore" implicit={8} onSchimba={laSchimbare} />);
    fireEvent.change(camp("Ore"), { target: { value: "" } });
    fireEvent.blur(camp("Ore"));
    expect(laSchimbare).toHaveBeenCalledWith(null);
  });

  it("urmează valoarea recalculată de părinte, fără efect de sincronizare", () => {
    // Tiparul din `celula-zi.tsx`: se schimbă intervalul, iar orele derivate
    // trebuie să apară în câmp fără ca cineva să-l atingă.
    function Gazda() {
      const [ore, setOre] = useState<number | null>(8);
      return (
        <>
          <IntrareDurata aria-label="Ore" valoare={ore} />
          <button
            type="button"
            onClick={() => {
              setOre(8.5);
            }}
          >
            Recalculează
          </button>
        </>
      );
    }
    render(<Gazda />);
    expect(camp("Ore").value).toBe("8:00");
    fireEvent.click(screen.getByRole("button", { name: "Recalculează" }));
    expect(camp("Ore").value).toBe("8:30");
  });
});
