// src/components/evaluari/campuri-evaluare.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CriteriuSablon } from "@/domain/evaluations/criterii";
import type { RaspunsCriteriu } from "@/domain/evaluations/scor";

import { CampCriteriu, RASPUNS_GOL } from "./campuri-evaluare";

/**
 * Regula pe care o apără fișierul: **necompletat nu e zero, și se poate reveni
 * la el.**
 *
 * Formularul dinainte trimitea `scor ?? 0` pentru fiecare criteriu neatins, pe
 * o scală unde zero nici măcar nu e o notă validă. Dacă starea „fără notă"
 * n-are drum înapoi din interfață, prima atingere greșită o face definitivă —
 * și, cum nu exista nicio acțiune de UPDATE, chiar era definitivă.
 */

const criteriu = (p: Partial<CriteriuSablon> = {}): CriteriuSablon => ({
  cod: "calitate",
  denumire: "Calitatea muncii",
  descriere: null,
  tip: "scala",
  scala_max: 5,
  pondere: null,
  ...p,
});

function randeaza(c: CriteriuSablon, raspuns?: RaspunsCriteriu) {
  const laSchimbare = vi.fn();
  render(
    <CampCriteriu
      criteriu={c}
      raspuns={raspuns ?? RASPUNS_GOL(c.cod)}
      prefix="proba"
      laSchimbare={laSchimbare}
    />,
  );
  return { laSchimbare };
}

describe("CampCriteriu — scala", () => {
  it("desenează exact atâtea trepte cât spune scala", () => {
    randeaza(criteriu({ scala_max: 10 }));
    expect(screen.getAllByRole("radio")).toHaveLength(10);
  });

  it("nu preselectează nimic: o notă nedată nu e „1” și nu e „0”", () => {
    randeaza(criteriu());
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLInputElement).checked).toBe(false);
    }
  });

  it("trimite nota aleasă, nu indicele ei", async () => {
    const { laSchimbare } = randeaza(criteriu());
    await userEvent.click(screen.getByRole("radio", { name: "3" }));
    expect(laSchimbare).toHaveBeenCalledWith(
      expect.objectContaining({ criteriu_cod: "calitate", scor: 3 }),
    );
  });

  it("„Șterge nota” readuce criteriul la necompletat", async () => {
    const { laSchimbare } = randeaza(criteriu(), {
      criteriu_cod: "calitate",
      scor: 4,
      raspuns_text: null,
      comentariu: null,
    });
    await userEvent.click(screen.getByRole("button", { name: /șterge nota/iu }));
    expect(laSchimbare).toHaveBeenCalledWith(expect.objectContaining({ scor: null }));
  });

  it("butonul de ștergere lipsește cât timp nu e nimic de șters", () => {
    randeaza(criteriu());
    // `hidden` scoate elementul din arborele de accesibilitate: o țintă care nu
    // face nimic e mai rea decât una absentă.
    expect(screen.queryByRole("button", { name: /șterge nota/iu })).toBeNull();
  });

  it("grupul poartă denumirea criteriului, ca la cititorul de ecran să nu fie „1, 2, 3”", () => {
    randeaza(criteriu());
    expect(screen.getByRole("group", { name: "Calitatea muncii" })).toBeTruthy();
  });
});

describe("CampCriteriu — celelalte tipuri", () => {
  it("`da_nu` are două opțiuni, codificate 1 și 0", async () => {
    const { laSchimbare } = randeaza(criteriu({ tip: "da_nu", scala_max: 1 }));
    const optiuni = screen.getAllByRole("radio");
    expect(optiuni).toHaveLength(2);
    await userEvent.click(screen.getByRole("radio", { name: "Nu" }));
    expect(laSchimbare).toHaveBeenCalledWith(expect.objectContaining({ scor: 0 }));
  });

  it("`text` nu are niciun radio și scrie în `raspuns_text`", async () => {
    const { laSchimbare } = randeaza(
      criteriu({ cod: "obs", denumire: "Observații", tip: "text", scala_max: 0 }),
    );
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    await userEvent.type(screen.getByRole("textbox", { name: "Observații" }), "a");
    expect(laSchimbare).toHaveBeenCalledWith(expect.objectContaining({ raspuns_text: "a" }));
  });

  it("ghidul de notare se afișează când există", () => {
    randeaza(criteriu({ descriere: "5 = fără reluări" }));
    expect(screen.getByText("5 = fără reluări")).toBeTruthy();
  });

  it("ponderea se arată doar când e pusă", () => {
    randeaza(criteriu({ pondere: 30 }));
    expect(screen.getByText(/30 % din punctaj/u)).toBeTruthy();
  });

  it("previzualizarea dezactivează controalele, ca să se vadă fără să se atingă", () => {
    render(
      <CampCriteriu
        criteriu={criteriu()}
        raspuns={RASPUNS_GOL("calitate")}
        prefix="previzualizare"
        dezactivat
        laSchimbare={() => {}}
      />,
    );
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLInputElement).disabled).toBe(true);
    }
  });
});
