// src/components/ui/camp.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Camp } from "./camp";

/**
 * Regula pe care o apără fișierul ăsta: serverul construiește `fieldErrors` la
 * fiecare acțiune, iar doar ~7 din 99 de formulare le citesc — restul arată un
 * singur `<p>` roșu la baza formularului, la sute de pixeli de câmpul vinovat.
 * `Camp` face uitarea imposibilă: nu se poate randa un control fără să treacă
 * prin locul care leagă `aria-invalid` de `aria-describedby`.
 *
 * Testele verifică LEGĂTURA, nu prezența atributelor. Un `aria-describedby`
 * care arată spre un id inexistent trece orice `typecheck`, `lint` și `build`,
 * și nu spune nimic nimănui.
 */

describe("Camp — legătura etichetă ↔ control", () => {
  it("eticheta trimite spre id-ul controlului, deci controlul are nume accesibil", () => {
    // Fără `htmlFor` = `id`, un cititor de ecran anunță „editare text”, atât.
    render(
      <Camp nume="cnp" eticheta="CNP">
        {(a) => <input {...a} />}
      </Camp>,
    );
    const control = screen.getByLabelText("CNP");
    expect(control.id).toBe("camp-cnp");
  });

  it("`nume` ajunge ca atribut `name`, altfel `FormData` n-ar avea cheia", () => {
    // Toate formularele proiectului citesc `formData.get("...")`. Un control
    // fără `name` se trimite gol și acțiunea respinge cu „câmp obligatoriu”.
    render(
      <Camp nume="cnp" eticheta="CNP">
        {(a) => <input {...a} />}
      </Camp>,
    );
    expect(screen.getByLabelText("CNP").getAttribute("name")).toBe("cnp");
  });

  it("`id` explicit îl suprascrie pe cel derivat din `nume`", () => {
    // Cazul real: două formulare pe același ecran cu același nume de câmp.
    // Fără suprascriere, ambele etichete ar trimite spre primul control.
    render(
      <Camp nume="cnp" id="al-doilea-cnp" eticheta="CNP" erori={["Obligatoriu."]}>
        {(a) => <input {...a} />}
      </Camp>,
    );
    const control = screen.getByLabelText("CNP");
    expect(control.id).toBe("al-doilea-cnp");
    // Și identificatorii derivați îl urmează, nu rămân pe `nume`.
    expect(control.getAttribute("aria-describedby")).toBe("al-doilea-cnp-eroare");
  });
});

describe("Camp — starea de eroare", () => {
  it("fără erori nu marchează nimic invalid și nu descrie nimic", () => {
    // Un `aria-invalid="false"` permanent sau un `aria-describedby` gol face
    // cititorul de ecran să anunțe zgomot la fiecare câmp curat.
    render(
      <Camp nume="cnp" eticheta="CNP">
        {(a) => <input {...a} />}
      </Camp>,
    );
    const control = screen.getByLabelText("CNP");
    expect(control.hasAttribute("aria-invalid")).toBe(false);
    expect(control.hasAttribute("aria-describedby")).toBe(false);
  });

  it("o listă de erori goală nu e o eroare", () => {
    // `fieldErrors` vine din server ca obiect cu chei pentru toate câmpurile;
    // un `[]` înseamnă „câmpul e curat”, nu „arată chenar roșu”.
    render(
      <Camp nume="cnp" eticheta="CNP" erori={[]}>
        {(a) => <input {...a} />}
      </Camp>,
    );
    expect(screen.getByLabelText("CNP").hasAttribute("aria-invalid")).toBe(false);
  });

  it("cu erori, `aria-describedby` trimite spre un element care EXISTĂ și poartă textul", () => {
    // Asta e legătura care lipsea peste tot: se verifică pe id, nu pe prezența
    // atributului. Un id care nu rezolvă nu produce nicio eroare vizibilă.
    render(
      <Camp nume="cnp" eticheta="CNP" erori={["CNP-ul are 13 cifre."]}>
        {(a) => <input {...a} />}
      </Camp>,
    );
    const control = screen.getByLabelText("CNP");
    expect(control.getAttribute("aria-invalid")).toBe("true");

    const descrieri = control.getAttribute("aria-describedby");
    expect(descrieri).toBe("camp-cnp-eroare");

    const tinta = document.getElementById("camp-cnp-eroare");
    expect(tinta).not.toBeNull();
    expect(tinta?.textContent).toContain("CNP-ul are 13 cifre.");
  });

  it('mesajul de eroare are `role="alert"`, deci se anunță când apare', () => {
    // Mesajul se randează după trimiterea formularului, când focusul e deja pe
    // buton. Fără `role="alert"` nimeni nu află că a apărut.
    render(
      <Camp nume="cnp" eticheta="CNP" erori={["CNP-ul are 13 cifre."]}>
        {(a) => <input {...a} />}
      </Camp>,
    );
    const alerta = screen.getByRole("alert");
    expect(alerta.id).toBe("camp-cnp-eroare");
    expect(alerta.textContent).toContain("CNP-ul are 13 cifre.");
  });

  it("cu ajutor ȘI eroare, ambele id-uri sunt descrise, cu eroarea PRIMA", () => {
    // Ordinea e regula: cititorul de ecran spune întâi ce e greșit, apoi ce se
    // aștepta. Invers, omul aude explicația formatului înainte să afle că a
    // greșit ceva.
    render(
      <Camp
        nume="data"
        eticheta="Data angajării"
        ajutor="Format aaaa-ll-zz."
        erori={["Data e obligatorie."]}
      >
        {(a) => <input {...a} />}
      </Camp>,
    );
    const control = screen.getByLabelText("Data angajării");
    const ids = (control.getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids).toEqual(["camp-data-eroare", "camp-data-ajutor"]);
    // Amândouă rezolvă la elemente reale.
    expect(document.getElementById("camp-data-eroare")?.textContent).toContain(
      "Data e obligatorie.",
    );
    expect(document.getElementById("camp-data-ajutor")?.textContent).toContain(
      "Format aaaa-ll-zz.",
    );
  });
});

describe("Camp — obligatoriu", () => {
  it("pune `required` pe control și un text pentru cititorul de ecran, nu doar un asterisc", () => {
    // Un `*` roșu e informație pur vizuală: aria-hidden pentru cine ascultă,
    // invizibil pentru cine nu distinge roșul. Cuvântul îl dublează.
    render(
      <Camp nume="cnp" eticheta="CNP" obligatoriu>
        {(a) => <input {...a} />}
      </Camp>,
    );
    const control = screen.getByLabelText(/CNP/) as HTMLInputElement;
    expect(control.required).toBe(true);
    expect(screen.getByText("(obligatoriu)")).toBeDefined();
  });

  it("fără `obligatoriu` nu pune `required` și nu inventează textul", () => {
    render(
      <Camp nume="cnp" eticheta="CNP">
        {(a) => <input {...a} />}
      </Camp>,
    );
    expect((screen.getByLabelText("CNP") as HTMLInputElement).required).toBe(false);
    expect(screen.queryByText("(obligatoriu)")).toBeNull();
  });
});

describe("Camp — clasele controlului", () => {
  it('`fel="select"` desenează o săgeată proprie și o ascunde pe cea nativă', () => {
    // Săgeata nativă a browserului nu se poate colora. Dacă nu se ascunde
    // (`appearance-none`), ecranul are două săgeți suprapuse.
    const { container } = render(
      <Camp nume="judet" eticheta="Județ" fel="select">
        {(a) => (
          <select {...a}>
            <option value="B">București</option>
          </select>
        )}
      </Camp>,
    );
    const control = screen.getByLabelText("Județ");
    expect(control.className).toContain("appearance-none");
    // Săgeata desenată din paletă, lângă control.
    const sageata = container.querySelector("svg");
    expect(sageata).not.toBeNull();
    expect(sageata?.getAttribute("aria-hidden")).toBe("true");
  });

  it('`fel="input"` nu randează nicio săgeată', () => {
    const { container } = render(
      <Camp nume="cnp" eticheta="CNP">
        {(a) => <input {...a} />}
      </Camp>,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("nu-și scrie propriul inel de focus", () => {
    // Regula globală `:focus-visible` din globals.css acoperă tot. Suprascrierile
    // locale nu doar că se dublează — unele îl ANULAU prin `outline-none`.
    render(
      <Camp nume="cnp" eticheta="CNP">
        {(a) => <input {...a} />}
      </Camp>,
    );
    const c = screen.getByLabelText("CNP").className;
    expect(c).not.toMatch(/focus-visible:/);
    expect(c).not.toMatch(/outline-none/);
  });

  it("chenarul e `border-foreground/60`, nu `border-border`", () => {
    // `border-border` pe crem dă 1,29:1 și pică WCAG 1.4.11 pentru un control
    // interactiv. Se acceptă doar sub variante de stare — `disabled:` și
    // `read-only:` —, unde controlul nu mai e operabil.
    render(
      <Camp nume="cnp" eticheta="CNP">
        {(a) => <input {...a} />}
      </Camp>,
    );
    const c = screen.getByLabelText("CNP").className;
    expect(c).toContain("border-foreground/60");
    expect(c).not.toMatch(/(^|\s)border-border(\s|$)/);
  });
});

describe("Camp — compunerea cu react-hook-form", () => {
  it("atributele care nu vin din `register()` supraviețuiesc împrăștierii de după", () => {
    // `register()` întoarce `{ name, onChange, onBlur, ref }` și se împrăștie
    // DUPĂ atributele lui `Camp`, ca ref-ul să ajungă la element. Dacă
    // `className`, `aria-invalid` sau `aria-describedby` ar apărea în ce
    // întoarce `register()`, legătura s-ar rupe tăcut exact în cele 4 formulare
    // care folosesc react-hook-form.
    render(
      <Camp nume="cnp" eticheta="CNP" ajutor="13 cifre." erori={["CNP invalid."]}>
        {(a) => <input {...a} {...{ name: "altul", ref: () => {} }} />}
      </Camp>,
    );
    const control = screen.getByLabelText("CNP");
    expect(control.className).toContain("border-foreground/60");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBe("camp-cnp-eroare camp-cnp-ajutor");
    // Ce ESTE în `register()` are voie să câștige: numele vine de la el.
    expect(control.getAttribute("name")).toBe("altul");
  });
});
