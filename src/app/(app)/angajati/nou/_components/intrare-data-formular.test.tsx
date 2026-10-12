// src/app/(app)/angajati/nou/_components/intrare-data-formular.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { InroleazaAngajatInput } from "@/schemas/employee";

import { IntrareDataFormular } from "./intrare-data-formular";

/**
 * Ce apără fișierul: câmpurile de dată ale asistentului de înrolare (ONB-033).
 *
 * Asistentul e unul dintre puținele formulare pe react-hook-form; valorile nu
 * pleacă prin `FormData`, ci din starea formularului. Un `<input type="date">`
 * înregistrat cu `register` arăta „mm/dd/yyyy” pe un browser în engleză.
 * `IntrareData` arată „zz.ll.aaaa”, dar nu se poate înregistra cu `register`
 * (caseta vizibilă n-are `name`, valoarea ISO stă în câmpul ascuns) — de aici
 * adaptorul. Trebuie să țină trei promisiuni: valoarea din formular e ISO,
 * un `setValue` din afară se vede în casetă (pasul 3 completează singur
 * „Vechime în unitate din”), iar `id`-ul dat de `<Camp>` ajunge pe caseta
 * vizibilă, ca eticheta și focusul pe eroare să nimerească ce vede omul.
 */

let formular: UseFormReturn<InroleazaAngajatInput> | null = null;

function Banc() {
  const f = useForm<InroleazaAngajatInput>();
  useEffect(() => {
    formular = f;
  }, [f]);
  return (
    <form>
      <IntrareDataFormular control={f.control} nume="hired_on" atribute={{ id: "camp-hired_on" }} />
    </form>
  );
}

function caseta(): HTMLInputElement {
  const element = screen.getByRole("textbox");
  if (!(element instanceof HTMLInputElement)) throw new Error("Caseta lipsește.");
  return element;
}

describe("IntrareDataFormular", () => {
  it("scrie în formular ziua ISO, din textul românesc", () => {
    render(<Banc />);
    fireEvent.change(caseta(), { target: { value: "05.03.2026" } });
    fireEvent.blur(caseta());
    expect(formular?.getValues("hired_on")).toBe("2026-03-05");
  });

  it("arată în casetă ce scrie `setValue` din afară", () => {
    render(<Banc />);
    act(() => {
      formular?.setValue("hired_on", "2026-01-01");
    });
    expect(caseta().value).toBe("01.01.2026");
  });

  it("`id`-ul lui `<Camp>` ajunge pe caseta vizibilă", () => {
    render(<Banc />);
    expect(caseta().id).toBe("camp-hired_on");
    expect(caseta().getAttribute("placeholder")).toBe("zz.ll.aaaa");
  });

  it("golirea casetei golește valoarea din formular", () => {
    render(<Banc />);
    act(() => {
      formular?.setValue("hired_on", "2026-01-01");
    });
    fireEvent.change(caseta(), { target: { value: "" } });
    fireEvent.blur(caseta());
    expect(formular?.getValues("hired_on")).toBe("");
  });
});
