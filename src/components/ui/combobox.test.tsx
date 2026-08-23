// src/components/ui/combobox.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Camp } from "./camp";
import { cheieCautare } from "@/lib/text/diacritice";

import { Combobox, filtreazaOptiuni, type OptiuneCombobox, type PropsCombobox } from "./combobox";

/**
 * Ce apără fișierul ăsta: regulile pe care compilatorul nu le vede.
 *
 * Un combobox arată corect și se comportă convingător fiind, în același timp,
 * complet inutilizabil — pentru că valoarea aleasă nu ajunge în `FormData`,
 * pentru că eticheta se trimite în locul identificatorului, pentru că
 * `aria-activedescendant` arată spre un `<li>` care nu mai există după ce lista
 * s-a scurtat, sau pentru că Escape închide dialogul din jur cu formularul cu
 * tot. Niciuna dintre astea nu produce vreo eroare, nicăieri.
 *
 * Nu se testează că React randează.
 */

const ANGAJATI: readonly OptiuneCombobox[] = [
  { valoare: "", eticheta: "Nealocat" },
  { valoare: "u1", eticheta: "Ionescu Maria", secundar: "1042" },
  { valoare: "u2", eticheta: "Stănescu Andrei", secundar: "1043" },
  { valoare: "u3", eticheta: "Șerban Ioana", secundar: "1044" },
  // Sedilă turcească (`Ţ` U+0162), scrisă intenționat: exact așa arată numele
  // importate din fișierele vechi ale clienților. Restul depozitului scrie
  // virgulă dedesubt; aici e DATĂ de test, nu text de produs — vezi precedentul
  // din `src/domain/import/mapare.test.ts`.
  { valoare: "u4", eticheta: "Ţucă Vlad", secundar: "1045" },
];

const GOL = "Niciun angajat găsit.";

function campAscuns(container: HTMLElement): HTMLInputElement {
  const element = container.querySelector('input[type="hidden"]');
  if (!(element instanceof HTMLInputElement)) throw new Error("Câmpul ascuns lipsește.");
  return element;
}

function caseta(): HTMLInputElement {
  const element = screen.getByRole("combobox");
  if (!(element instanceof HTMLInputElement)) throw new Error("Caseta lipsește.");
  return element;
}

/** Restul props-urilor sunt toate opționale, deci `{}` e o randare validă. */
type Suplimentar = Omit<PropsCombobox, "name" | "optiuni" | "textFaraRezultate">;

function randeaza(suplimentar: Suplimentar = {}) {
  return render(
    <form>
      <Combobox name="employee_id" optiuni={ANGAJATI} textFaraRezultate={GOL} {...suplimentar} />
    </form>,
  );
}

describe("Combobox — trimiterea formularului", () => {
  it("alegerea ajunge în `FormData` sub `name`, nu doar în starea componentei", () => {
    // Regula pentru care există primitiva. Tiparul dominant al proiectului e
    // `<form action>` + `FormData`; un combobox care ține alegerea numai în
    // `useState` face acțiunea să răspundă „câmp obligatoriu” peste o alegere
    // pe care omul chiar a făcut-o.
    const { container } = randeaza();
    fireEvent.mouseDown(caseta());
    fireEvent.click(screen.getByText("Stănescu Andrei"));

    const formular = container.querySelector("form");
    if (!(formular instanceof HTMLFormElement)) throw new Error("Formularul lipsește.");
    expect(new FormData(formular).get("employee_id")).toBe("u2");
  });

  it("caseta vizibilă NU are `name` — altfel s-ar trimite numele omului, nu id-ul", () => {
    // `formData.get()` întoarce prima valoare. Cu `name` pe ambele câmpuri,
    // serverul care așteaptă un `uuid` ar primi „Stănescu Andrei”, tăcut.
    randeaza();
    expect(caseta().hasAttribute("name")).toBe(false);
  });

  it("opțiunea cu valoare goală e o opțiune obișnuită, nu un mecanism aparte", () => {
    // Sunt 75 de `<option value="">` în depozit („Nealocat”, „Eu însumi”, „—”).
    // Aleasă, ea golește câmpul; caseta rămâne goală, ca la `<select required>`.
    const { container } = randeaza({ valoareInitiala: "u1" });
    expect(campAscuns(container).value).toBe("u1");

    fireEvent.mouseDown(caseta());
    fireEvent.click(screen.getByText("Nealocat"));
    expect(campAscuns(container).value).toBe("");
    expect(caseta().value).toBe("");
  });

  it("`reset` pe formular întoarce valoarea la cea inițială", () => {
    // React 19 resetează formularul după o acțiune reușită. Câmpul ascuns e
    // controlat de stare, deci ar rămâne singurul câmp plin într-un formular
    // altfel golit — și s-ar retrimite la următoarea salvare.
    const { container } = randeaza({ valoareInitiala: "" });
    fireEvent.mouseDown(caseta());
    fireEvent.click(screen.getByText("Ionescu Maria"));
    expect(campAscuns(container).value).toBe("u1");

    const formular = container.querySelector("form");
    if (!(formular instanceof HTMLFormElement)) throw new Error("Formularul lipsește.");
    fireEvent.reset(formular);
    expect(campAscuns(container).value).toBe("");
  });

  it("controlat, `valoare` decide afișarea, iar `laSchimbare` primește alegerea", () => {
    // Modul dublu e o sursă clasică de defect: componenta își ține pe ascuns
    // propria valoare și o afișează pe a ei, nu pe a părintelui.
    const primite: string[] = [];
    const { container } = randeaza({
      valoare: "u1",
      laSchimbare: (v) => {
        primite.push(v);
      },
    });
    expect(caseta().value).toBe("Ionescu Maria");

    fireEvent.mouseDown(caseta());
    fireEvent.click(screen.getByText("Șerban Ioana"));
    expect(primite).toEqual(["u3"]);
    // Părintele n-a schimbat prop-ul, deci valoarea afișată și cea trimisă
    // rămân ale lui.
    expect(campAscuns(container).value).toBe("u1");
  });
});

describe("Combobox — o valoare comisă care nu e în listă", () => {
  /*
   * Cazul, probat de revizor pe cod, nu presupus: lista unui ecran de editare e
   * filtrată la angajații activi, iar înregistrarea trimite la unul inactiv.
   * Înainte, caseta arăta GOL în timp ce câmpul ascuns purta id-ul, iar cu
   * `required` formularul refuza să se trimită pe un câmp care AVEA valoare.
   */
  it("cu `optiuneAleasa`, caseta arată eticheta, nu golul", () => {
    const { container } = randeaza({
      valoareInitiala: "u9",
      optiuneAleasa: { valoare: "u9", eticheta: "Popa Elena (inactiv)" },
    });
    expect(caseta().value).toBe("Popa Elena (inactiv)");
    expect(campAscuns(container).value).toBe("u9");
  });

  it("alegerea comisă apare și în listă, deci se poate reselecta", () => {
    randeaza({
      valoareInitiala: "u9",
      optiuneAleasa: { valoare: "u9", eticheta: "Popa Elena (inactiv)" },
    });
    fireEvent.mouseDown(caseta());
    const optiuni = screen.getAllByRole("option");
    expect(optiuni[0]?.textContent).toContain("Popa Elena (inactiv)");
    expect(optiuni[0]?.getAttribute("aria-selected")).toBe("true");
  });

  it("fără `optiuneAleasa`, arată valoarea brută — urât, dar niciodată gol", () => {
    // Un identificator într-un câmp de nume se vede și se repară. Golul nu.
    const { container } = randeaza({ valoareInitiala: "u9" });
    expect(caseta().value).toBe("u9");
    expect(campAscuns(container).value).toBe("u9");
  });

  it("`required` nu mai blochează un câmp care ARE valoare", () => {
    randeaza({
      valoareInitiala: "u9",
      required: true,
      optiuneAleasa: { valoare: "u9", eticheta: "Popa Elena (inactiv)" },
    });
    expect(caseta().validity.valueMissing).toBe(false);
  });
});

describe("Combobox — dezactivat", () => {
  it("nu-și trimite valoarea, la fel ca `<select disabled>`", () => {
    // Câmpul ascuns purta `name` fără `disabled`, deci pleca oricum. Primitiva
    // se dă drept înlocuitor cap-la-cap pentru `<select>`; aici chiar e.
    const { container } = randeaza({ dezactivat: true, valoareInitiala: "u1" });
    const formular = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(formular).get("employee_id")).toBeNull();
  });

  it("activat, valoarea pleacă", () => {
    const { container } = randeaza({ valoareInitiala: "u1" });
    const formular = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(formular).get("employee_id")).toBe("u1");
  });
});

describe("Combobox — `required` păzește ALEGEREA, nu textul tastat", () => {
  it("text scris fără alegere = formular invalid", () => {
    // Fără asta, `validity` se uită la caseta de căutare: omul scrie „zzz”,
    // validarea nativă e mulțumită, iar acțiunea primește un șir gol.
    randeaza({ required: true, textAlegereObligatorie: "Alegeți din listă." });
    fireEvent.change(caseta(), { target: { value: "zzz" } });
    expect(caseta().validity.valid).toBe(false);
    expect(caseta().validationMessage).toBe("Alegeți din listă.");
  });

  it("după o alegere reală, formularul redevine valid", () => {
    randeaza({ required: true, textAlegereObligatorie: "Alegeți din listă." });
    fireEvent.mouseDown(caseta());
    fireEvent.click(screen.getByRole("option", { name: /Ionescu Maria/ }));
    expect(caseta().validity.valid).toBe(true);
  });
});

describe("Combobox — filtrarea fără diacritice", () => {
  function etichete(): string[] {
    return screen.getAllByRole("option").map((o) => o.textContent ?? "");
  }

  it("cine scrie „stanescu” găsește „Stănescu”", () => {
    randeaza();
    fireEvent.change(caseta(), { target: { value: "stanescu" } });
    expect(etichete()).toEqual(["Stănescu Andrei1043"]);
  });

  it("găsește la fel numele scrise cu sedilă și pe cele cu virgulă dedesubt", () => {
    // Datele importate din fișiere vechi au sedilă (U+0162/U+0163); interfața scrie
    // virgulă (U+021B). Ambele se descompun în NFD la aceeași literă de bază,
    // deci o singură normalizare acoperă ambele forme.
    randeaza();
    fireEvent.change(caseta(), { target: { value: "tuca" } });
    expect(etichete()).toEqual(["Ţucă Vlad1045"]);

    fireEvent.change(caseta(), { target: { value: "serban" } });
    expect(etichete()).toEqual(["Șerban Ioana1044"]);
  });

  it("cuvintele se caută în orice ordine", () => {
    // `full_name` nu are ordine uniformă prin depozit. Un `includes` pe șirul
    // întreg ar cere omului să ghicească dacă e „Nume Prenume” sau invers.
    randeaza();
    fireEvent.change(caseta(), { target: { value: "maria ionescu" } });
    expect(etichete()).toEqual(["Ionescu Maria1042"]);
  });

  it("caută și în textul secundar — marca, nu doar numele", () => {
    randeaza();
    fireEvent.change(caseta(), { target: { value: "1044" } });
    expect(etichete()).toEqual(["Șerban Ioana1044"]);
  });

  it("nu taie lista la un număr de rezultate", () => {
    // Trunchierea tăcută e defectul pe care proiectul îl are deja o dată
    // (`max_rows = 1000` în stratul de citiri): omul caută pe cineva care
    // există în listă și nu-l găsește niciodată.
    const multi: OptiuneCombobox[] = Array.from({ length: 400 }, (_, i) => ({
      valoare: `u${i}`,
      eticheta: `Angajat ${i}`,
    }));
    render(<Combobox name="employee_id" optiuni={multi} textFaraRezultate={GOL} />);
    fireEvent.mouseDown(caseta());
    expect(screen.getAllByRole("option").length).toBe(400);
  });

  it("`faraDiacritice` și `filtreazaOptiuni` sunt pure și verificabile fără DOM", () => {
    expect(cheieCautare("Șerban Ţucă Ăsta Îmi Ârde")).toBe("serban tuca asta imi arde");
    expect(filtreazaOptiuni(ANGAJATI, "   ").length).toBe(ANGAJATI.length);
    expect(filtreazaOptiuni(ANGAJATI, "zzz").length).toBe(0);
  });
});

describe("Combobox — tiparul ARIA", () => {
  it("săgeata mută `aria-activedescendant`, NU focusul", () => {
    // Dacă focusul ar sări pe `<li>`, caseta l-ar pierde la prima săgeată și
    // tastarea următoare n-ar mai ajunge nicăieri.
    randeaza();
    const input = caseta();
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(document.activeElement).toBe(input);
    const activ = input.getAttribute("aria-activedescendant");
    expect(activ).not.toBeNull();
    // Și id-ul chiar rezolvă: un `aria-activedescendant` care arată spre nimic
    // trece typecheck, lint și build fără să spună nimic nimănui.
    expect(document.getElementById(activ ?? "")?.getAttribute("role")).toBe("option");
  });

  it("`aria-controls` apare doar cât timp lista există și arată spre listbox", () => {
    randeaza();
    const input = caseta();
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-controls")).toBe(false);

    fireEvent.mouseDown(input);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const idLista = input.getAttribute("aria-controls");
    expect(document.getElementById(idLista ?? "")).toBe(screen.getByRole("listbox"));
  });

  it("`aria-selected` marchează alegerea comisă, nu rândul de sub cursor", () => {
    // Două informații diferite: „ce e ales acum” și „unde e cursorul”. Dacă
    // `aria-selected` ar urma cursorul, cititorul de ecran ar anunța ca
    // selectat fiecare rând peste care trece săgeata.
    randeaza({ valoareInitiala: "u2" });
    const input = caseta();
    fireEvent.mouseDown(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const selectate = screen
      .getAllByRole("option")
      .filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selectate.length).toBe(1);
    expect(selectate[0]?.textContent).toBe("Stănescu Andrei1043");
    // Cursorul s-a mutat mai jos, pe alt rând decât cel selectat.
    expect(input.getAttribute("aria-activedescendant")).not.toBe(selectate[0]?.id);
  });

  it("cât timp lista e închisă, indicele activ nu arată spre nimic", () => {
    randeaza();
    expect(caseta().hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("`required` ajunge pe caseta vizibilă, singura supusă validării native", () => {
    // Câmpul ascuns e scos din validare prin definiție (`type=hidden`), deci
    // `required` pus acolo n-ar face nimic.
    randeaza({ required: true });
    expect(caseta().required).toBe(true);
  });

  it("`dezactivat` blochează caseta prin `disabled`, nu prin opacitate", () => {
    randeaza({ dezactivat: true });
    const input = caseta();
    expect(input.disabled).toBe(true);
    expect(input.className).not.toContain("opacity");
    fireEvent.mouseDown(input);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Combobox — tastatura", () => {
  it("Enter alege rândul activ", () => {
    const { container } = randeaza();
    const input = caseta();
    fireEvent.keyDown(input, { key: "ArrowDown" }); // deschide, pe „Nealocat”
    fireEvent.keyDown(input, { key: "ArrowDown" }); // „Ionescu Maria”
    fireEvent.keyDown(input, { key: "Enter" });

    expect(campAscuns(container).value).toBe("u1");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Tab NU alege — pleacă din câmp și lasă valoarea neatinsă", () => {
    // Greșeala clasică: „selecția urmează cursorul”, care face ca simpla
    // trecere prin formular cu Tab să schimbe date.
    const { container } = randeaza({ valoareInitiala: "u1" });
    const input = caseta();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Tab" });
    fireEvent.blur(input);

    expect(campAscuns(container).value).toBe("u1");
    // Și caseta se așază înapoi pe eticheta alegerii comise.
    expect(caseta().value).toBe("Ionescu Maria");
  });

  it("Escape închide lista ȘI anulează evenimentul, ca să nu se închidă dialogul din jur", () => {
    // `Dialog` și `PanouLateral` stau pe `<dialog>` nativ: Escape e o cerere de
    // închidere pe care browserul o abandonează dacă `keydown` a fost anulat.
    // Fără asta, prima apăsare ar arunca tot formularul completat.
    const { container } = randeaza({ valoareInitiala: "u1" });
    const input = caseta();
    fireEvent.mouseDown(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(campAscuns(container).value).toBe("u1");

    // Cu lista deja închisă, Escape trece mai departe: acolo chiar înseamnă
    // „renunț la dialog”.
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
  });

  it("Home și End sar la capetele listei filtrate, nu ale listei întregi", () => {
    randeaza();
    const input = caseta();
    fireEvent.change(caseta(), { target: { value: "a" } }); // toate au un „a”
    const optiuni = screen.getAllByRole("option");

    fireEvent.keyDown(input, { key: "End" });
    expect(input.getAttribute("aria-activedescendant")).toBe(optiuni[optiuni.length - 1]?.id);

    fireEvent.keyDown(input, { key: "Home" });
    expect(input.getAttribute("aria-activedescendant")).toBe(optiuni[0]?.id);
  });

  it("lista se scurtează sub deget fără ca indicele activ să rămână în afara ei", () => {
    // Cazul real: cursorul e pe rândul 5, iar părintele reîncarcă lista filtrată
    // pe alt departament și rămân două nume. Un indice păstrat ca atare ar face
    // ca `aria-activedescendant` să arate spre un `<li>` care nu mai există —
    // fără nicio eroare, în niciun strat.
    const { rerender } = render(
      <Combobox name="employee_id" optiuni={ANGAJATI} textFaraRezultate={GOL} />,
    );
    const input = caseta();
    fireEvent.mouseDown(input);
    fireEvent.keyDown(input, { key: "End" });
    expect(input.getAttribute("aria-activedescendant")).not.toBeNull();

    rerender(
      <Combobox name="employee_id" optiuni={ANGAJATI.slice(0, 2)} textFaraRezultate={GOL} />,
    );
    const activ = input.getAttribute("aria-activedescendant");
    expect(screen.getAllByRole("option").length).toBe(2);
    expect(document.getElementById(activ ?? "")?.getAttribute("role")).toBe("option");
  });
});

describe("Combobox — zero rezultate", () => {
  it("golul are text din prop și e anunțat, nu doar o listă goală", () => {
    randeaza();
    fireEvent.change(caseta(), { target: { value: "qqq" } });

    expect(screen.queryAllByRole("option").length).toBe(0);
    // Regiunea vie e montată permanent: dacă ar apărea odată cu mesajul, o
    // parte dintre cititoarele de ecran n-ar anunța niciodată nimic.
    expect(screen.getByRole("status").textContent).toBe(GOL);
    // Vizibil o dată, anunțat o dată — copia văzută e `aria-hidden`.
    expect(screen.getAllByText(GOL).length).toBe(2);
  });

  it("Enter pe zero rezultate nu inventează o alegere", () => {
    const { container } = randeaza({ valoareInitiala: "u1" });
    const input = caseta();
    fireEvent.change(input, { target: { value: "qqq" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(campAscuns(container).value).toBe("u1");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Combobox — legătura cu `Camp`", () => {
  it("o singură împrăștiere aduce id-ul, numele și toată legătura ARIA", () => {
    // Dacă `Combobox` n-ar accepta exact forma dată de `Camp`, fiecare ecran
    // și-ar lega singur `aria-describedby` — adică n-ar lega-o.
    const { container } = render(
      <Camp nume="employee_id" eticheta="Angajat" erori={["Selectați angajatul."]}>
        {(a) => <Combobox {...a} optiuni={ANGAJATI} textFaraRezultate={GOL} />}
      </Camp>,
    );

    const control = screen.getByLabelText("Angajat");
    expect(control.getAttribute("role")).toBe("combobox");
    expect(control.id).toBe("camp-employee_id");
    expect(control.getAttribute("aria-invalid")).toBe("true");

    const descrieri = control.getAttribute("aria-describedby");
    expect(descrieri).toBe("camp-employee_id-eroare");
    expect(document.getElementById(descrieri ?? "")?.textContent).toBe("Selectați angajatul.");

    // Iar `name` ajunge pe câmpul ascuns, singurul care se trimite.
    expect(campAscuns(container).name).toBe("employee_id");
  });

  it("clasele de la `Camp` supraviețuiesc, cu loc rezervat pentru săgeată", () => {
    // `cn` trebuie să lase `pr-9` să bată `px-3` din clasa de control; altfel
    // textul lung ar trece pe sub săgeată.
    render(
      <Camp nume="employee_id" eticheta="Angajat">
        {(a) => <Combobox {...a} optiuni={ANGAJATI} textFaraRezultate={GOL} />}
      </Camp>,
    );
    const clase = screen.getByLabelText("Angajat").className;
    expect(clase).toContain("pr-9");
    expect(clase).toContain("rounded-control");
  });
});
