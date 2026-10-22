// src/app/(app)/angajati/nou/_components/program-saptamanal.test.tsx
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { InroleazaAngajatInput } from "@/schemas/employee";

import { ProgramSaptamanal } from "./program-saptamanal";

/**
 * Ce apără fișierul: garda „L4”. Formularul de contract arată zilele pe
 * săptămână pe care salarizarea le va deduce din cele două norme, ca un
 * „8 h/zi, 20 h/săpt.” să nu treacă neobservat drept 2,5 zile.
 */

let formular: UseFormReturn<InroleazaAngajatInput> | null = null;

function Banc({ saptamana, zi }: Readonly<{ saptamana: number; zi: number }>) {
  const f = useForm<InroleazaAngajatInput>({
    defaultValues: { norma_ore_saptamana: saptamana, norma_ore_zi: zi },
  });
  useEffect(() => {
    formular = f;
  }, [f]);
  return <ProgramSaptamanal control={f.control} />;
}

const schimba = (camp: "norma_ore_saptamana" | "norma_ore_zi", valoare: string) => {
  act(() => {
    // Câmpurile sunt `type="number"` cu `register`: valoarea sosește ca șir.
    formular?.setValue(camp, valoare as unknown as number);
  });
};

describe("zilele pe săptămână sub normele contractului", () => {
  it("40 h și 8 h: 5 zile, fără atenționare", () => {
    render(<Banc saptamana={40} zi={8} />);
    expect(screen.getByText(/Program:/u).textContent).toBe("Program: 5 zile pe săptămână.");
  });

  it("se schimbă doar săptămâna, la 20: 2,5 zile, cu norma pe zi pentru cinci zile", () => {
    render(<Banc saptamana={40} zi={8} />);
    schimba("norma_ore_saptamana", "20");
    const text = screen.getByText(/Program:/u).textContent ?? "";
    expect(text).toContain("2,5 zile pe săptămână");
    expect(text).toContain("mai puțin de cinci");
    expect(text).toContain("norma pe zi este 4 ore");
  });

  it("20 h și 4 h: tot cinci zile", () => {
    render(<Banc saptamana={20} zi={4} />);
    expect(screen.getByText(/Program:/u).textContent).toBe("Program: 5 zile pe săptămână.");
  });

  it("24 h și 8 h: 3 zile, spuse pe față", () => {
    render(<Banc saptamana={24} zi={8} />);
    expect(screen.getByText(/Program:/u).textContent).toContain("3 zile pe săptămână");
  });

  it("o normă ștearsă: nicio cifră inventată", () => {
    render(<Banc saptamana={40} zi={8} />);
    schimba("norma_ore_zi", "");
    expect(screen.getByText(/se deduc după ce completați ambele norme/u)).toBeTruthy();
  });
});
