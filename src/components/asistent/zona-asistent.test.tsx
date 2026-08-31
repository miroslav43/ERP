// src/components/asistent/zona-asistent.test.tsx
/**
 * Testul apără două clase care par redundante și nu sunt.
 *
 * `h-full w-full` lângă `inset-0` arată ca un dublaj — și e singurul lucru care
 * ține învelișul deschis. Foaia de stil a browserului dă oricărui popover
 * deschis `width: fit-content; height: fit-content`, care bat un `inset-0` fără
 * dimensiune explicită: învelișul se strânge la 0×0 în colțul din stânga-sus,
 * cu bulă cu tot. Măsurat în headless_shell la 360×780: `inset-0` singur ⇒
 * `0×0`; cu `h-full w-full` ⇒ `360×780`.
 *
 * De ce e nevoie de test și nu de comentariu: în happy-dom nu există foaia de
 * stil a browserului, deci randarea pare corectă oricum ai scrie clasele.
 * Defectul se vede DOAR deschizând pagina, iar cine șterge clasa peste șase
 * luni n-o să deschidă pagina.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { reseteazaAsistent } from "@/lib/asistent/depozit";

import { ZonaAsistent } from "./zona-asistent";

afterEach(() => {
  // Depozitul e la nivel de modul: fără golire, starea trece între teste.
  reseteazaAsistent();
});

function radacina(zona: "app" | "portal"): HTMLElement {
  const { container } = render(<ZonaAsistent zona={zona} />);
  const el = container.querySelector("[popover]");
  if (el === null) throw new Error("zona asistentului nu s-a randat");
  return el as HTMLElement;
}

describe("învelișul flotant", () => {
  it("își declară dimensiunea explicit, nu doar prin inset", () => {
    const clase = radacina("app").className;
    expect(clase).toContain("inset-0");
    expect(clase).toContain("h-full");
    expect(clase).toContain("w-full");
  });

  it("urcă în top layer, ca să nu dispară sub un dialog deschis", () => {
    expect(radacina("app").getAttribute("popover")).toBe("manual");
  });

  it("nu apare la tipărire", () => {
    expect(radacina("app").getAttribute("data-tipar")).toBe("ascunde");
  });

  it("lasă clicurile să treacă pe unde nu e nimic de apăsat", () => {
    // Învelișul acoperă tot ecranul. Fără asta, jumătate din aplicație ar
    // deveni neapăsabilă.
    expect(radacina("app").className).toContain("pointer-events-none");
  });

  it("ridică bula peste bara de jos, în portal", () => {
    // `BaraPortal` are 3.5rem plus zona sigură a telefonului; bula stă peste ea.
    // Cifra trebuie să rămână corelată cu decalajul benzii de notificări din
    // `toast.tsx`, altfel una o acoperă pe cealaltă.
    expect(radacina("portal").innerHTML).toContain("4.25rem");
    expect(radacina("app").innerHTML).not.toContain("4.25rem");
  });
});

describe("bula", () => {
  it("se prezintă închisă și își spune starea", () => {
    render(<ZonaAsistent zona="app" />);
    const buton = screen.getByRole("button", { name: "Deschide asistentul" });
    expect(buton.getAttribute("aria-expanded")).toBe("false");
  });

  it("nu randează panoul cât timp e închisă", () => {
    render(<ZonaAsistent zona="app" />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
