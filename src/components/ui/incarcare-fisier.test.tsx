// src/components/ui/incarcare-fisier.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IncarcareFisier, marimeCitibila, seIncadreazaInAccept } from "./incarcare-fisier";

/**
 * Ce se verifică aici sunt regulile invizibile pentru compilator, toate
 * încălcate azi în cele trei `<input type="file">` din depozit: `name` lipsă,
 * restricția scrisă dar neverificată, respingerea fără legătură cu câmpul.
 *
 * `happy-dom` nu deschide dialogul sistemului, deci alegerea se simulează
 * punând `files` pe input și declanșând `change` — exact ce face browserul.
 */

function alege(input: HTMLInputElement, fisier: File): void {
  Object.defineProperty(input, "files", { value: [fisier], configurable: true });
  fireEvent.change(input);
}

function campul(): HTMLInputElement {
  return screen.getByLabelText(/Contract semnat/) as HTMLInputElement;
}

function randeaza(suplimentare?: Readonly<{ id?: string; erori?: readonly string[] }>) {
  return render(
    <IncarcareFisier
      nume="fisier"
      eticheta="Contract semnat"
      restrictii="PDF sau JPG, până în 2 MB."
      textAlegere="Alege fișierul"
      etichetaScoate="Scoate fișierul ales"
      accept=".pdf,image/jpeg"
      maxOcteti={2 * 1024 * 1024}
      mesajPreaMare="Fișierul depășește 2 MB."
      mesajTipRespins="Se acceptă numai PDF sau JPG."
      {...suplimentare}
    />,
  );
}

describe("IncarcareFisier — inputul nativ rămâne sursa adevărului", () => {
  it("păstrează `name`, deci formularul se trimite și fără JavaScript", () => {
    // `angajati/[id]/documente/formular-document.tsx:128` n-are `name`: citește
    // fișierul din `ref` și îl trimite manual. Fără JavaScript nu pleacă nimic.
    randeaza();
    expect(campul().getAttribute("name")).toBe("fisier");
    expect(campul().type).toBe("file");
  });

  it("nu ascunde inputul cu `hidden`/`display:none` — ar ieși din tabulare", () => {
    randeaza();
    const input = campul();
    expect(input.className).toContain("sr-only");
    expect(input.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(input.hasAttribute("hidden")).toBe(false);
    expect(input.getAttribute("tabindex")).toBeNull();
  });

  it("eticheta-buton deschide dialogul din HTML curat, prin `htmlFor`", () => {
    // Un `<button onClick={ref.current.click()}>` ar cere JavaScript ca să
    // poți alege — și atunci `name` pe input n-ar mai folosi la nimic.
    randeaza();
    const etichete = Array.from(document.querySelectorAll("label"));
    expect(etichete.length).toBe(2);
    for (const eticheta of etichete) expect(eticheta.getAttribute("for")).toBe("camp-fisier");
    // Inputul e ÎN eticheta-buton: releul inelului de focus cere descendență.
    const buton = etichete[1] as HTMLLabelElement;
    expect(buton.textContent).toContain("Alege fișierul");
    expect(buton.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("releul de focus nu rescrie inelul global", () => {
    randeaza();
    const buton = Array.from(document.querySelectorAll("label"))[1] as HTMLLabelElement;
    expect(buton.className).toContain("has-[:focus-visible]:outline-2");
    // Regula interzisă e varianta nudă `focus-visible:outline-*`.
    expect(buton.className).not.toMatch(/(^|\s)focus-visible:/);
    expect(buton.className).not.toMatch(/outline-none/);
  });

  it("`id` explicit îl suprascrie pe cel derivat din `nume`", () => {
    randeaza({ id: "al-doilea-fisier" });
    expect(campul().id).toBe("al-doilea-fisier");
    expect(campul().getAttribute("aria-describedby")).toBe("al-doilea-fisier-restrictii");
  });
});

describe("IncarcareFisier — restricțiile se văd înainte de alegere", () => {
  it("textul restricțiilor e randat și legat de câmp de la prima randare", () => {
    // WCAG 3.3.2: instrucțiunea stă la câmp, nu în mesajul de eroare de după.
    randeaza();
    const descrieri = campul().getAttribute("aria-describedby") ?? "";
    expect(descrieri).toBe("camp-fisier-restrictii");
    const tinta = document.getElementById("camp-fisier-restrictii");
    expect(tinta).not.toBeNull();
    expect(tinta?.textContent).toBe("PDF sau JPG, până în 2 MB.");
  });

  it("nu marchează nimic invalid cât timp nu s-a respins nimic", () => {
    randeaza();
    expect(campul().hasAttribute("aria-invalid")).toBe(false);
  });
});

describe("IncarcareFisier — fișierul ales", () => {
  it("se vede cu numele și mărimea lui", () => {
    const { container } = randeaza();
    alege(campul(), new File(["x".repeat(2048)], "contract.pdf", { type: "application/pdf" }));
    expect(screen.getByText("contract.pdf")).toBeDefined();
    expect(container.textContent).toContain("2 kB");
  });

  it("se poate scoate, iar inputul nativ se golește odată cu afișajul", () => {
    // Altfel formularul ar pleca la server cu un fișier pe care ecranul îl
    // arată deja ca șters.
    randeaza();
    const input = campul();
    alege(input, new File(["x"], "contract.pdf", { type: "application/pdf" }));
    expect(screen.getByText("contract.pdf")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Scoate fișierul ales" }));
    expect(screen.queryByText("contract.pdf")).toBeNull();
    expect(input.value).toBe("");
  });

  it("regiunea care anunță fișierul există în DOM și când e goală", () => {
    // O regiune `aria-live` inserată ODATĂ cu conținutul ei nu se anunță în
    // majoritatea cititoarelor de ecran.
    const { container } = randeaza();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

describe("IncarcareFisier — respingerea", () => {
  it("prea mare: mesaj legat prin `aria-describedby`, cu `aria-invalid` pe input", () => {
    randeaza();
    const input = campul();
    const prea = new File([new Uint8Array(3 * 1024 * 1024)], "scan.pdf", {
      type: "application/pdf",
    });
    alege(input, prea);

    expect(input.getAttribute("aria-invalid")).toBe("true");
    const descrieri = (input.getAttribute("aria-describedby") ?? "").split(" ");
    expect(descrieri).toContain("camp-fisier-eroare");
    // Legătura, nu doar atributul: un `aria-describedby` spre un id inexistent
    // trece orice typecheck și nu spune nimic nimănui.
    const mesaj = document.getElementById("camp-fisier-eroare");
    expect(mesaj).not.toBeNull();
    expect(mesaj?.textContent).toContain("Fișierul depășește 2 MB.");
    expect(mesaj?.getAttribute("role")).toBe("alert");
  });

  it("fișierul respins nu rămâne în input", () => {
    randeaza();
    const input = campul();
    alege(
      input,
      new File([new Uint8Array(3 * 1024 * 1024)], "scan.pdf", { type: "application/pdf" }),
    );
    expect(input.value).toBe("");
    expect(screen.queryByText("scan.pdf")).toBeNull();
  });

  it("tip greșit: același drum, dacă i s-a dat un mesaj", () => {
    randeaza();
    alege(campul(), new File(["x"], "arhiva.zip", { type: "application/zip" }));
    expect(document.getElementById("camp-fisier-eroare")?.textContent).toContain(
      "Se acceptă numai PDF sau JPG.",
    );
  });

  it("erorile de la server ajung în același loc cu respingerea din browser", () => {
    randeaza({ erori: ["Documentul există deja."] });
    const input = campul();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("camp-fisier-eroare")?.textContent).toContain(
      "Documentul există deja.",
    );
  });

  it("un fișier acceptat șterge respingerea anterioară", () => {
    randeaza();
    const input = campul();
    alege(input, new File(["x"], "arhiva.zip", { type: "application/zip" }));
    expect(document.getElementById("camp-fisier-eroare")).not.toBeNull();

    alege(input, new File(["x"], "contract.pdf", { type: "application/pdf" }));
    expect(document.getElementById("camp-fisier-eroare")).toBeNull();
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });
});

describe("seIncadreazaInAccept — aceleași reguli ca browserul", () => {
  it("acceptă după extensie chiar dacă sistemul n-a dat niciun tip MIME", () => {
    // Windows raportează des `type` gol pentru `.xlsx`, iar `angajati/import`
    // acceptă exact `.xlsx,.xlsm`: o verificare doar pe MIME ar respinge
    // tocmai fișierul pentru care există ecranul.
    const fisier = new File(["x"], "Angajati.XLSX", { type: "" });
    expect(seIncadreazaInAccept(fisier, ".xlsx,.xlsm")).toBe(true);
  });

  it("familia `image/*` prinde subtipurile, dar nu un tip gol", () => {
    expect(seIncadreazaInAccept(new File(["x"], "a.png", { type: "image/png" }), "image/*")).toBe(
      true,
    );
    expect(seIncadreazaInAccept(new File(["x"], "a.png", { type: "" }), "image/*")).toBe(false);
  });

  it("tipul exact se compară întreg, nu ca prefix", () => {
    const jpeg = new File(["x"], "a.jpg", { type: "image/jpeg" });
    expect(seIncadreazaInAccept(jpeg, "image/jpeg")).toBe(true);
    expect(seIncadreazaInAccept(jpeg, "image/jp")).toBe(false);
  });

  it("un `accept` gol nu respinge nimic", () => {
    expect(seIncadreazaInAccept(new File(["x"], "a.bin", { type: "" }), "  ,  ")).toBe(true);
  });
});

describe("marimeCitibila — cifra pe care o citește omul", () => {
  it("folosește aceeași bază ca limitele scrise în ecrane (1024)", () => {
    expect(marimeCitibila(1024)).toBe("1 kB");
    expect(marimeCitibila(2 * 1024 * 1024)).toBe("2 MB");
  });

  it("dă o zecimală doar sub 10, cu virgulă românească", () => {
    expect(marimeCitibila(Math.round(2.4 * 1024 * 1024))).toBe("2,4 MB");
    expect(marimeCitibila(Math.round(12.4 * 1024 * 1024))).toBe("12 MB");
  });

  it("octeții rămân întregi, fără zecimale", () => {
    expect(marimeCitibila(0)).toBe("0 B");
    expect(marimeCitibila(999)).toBe("999 B");
  });
});
