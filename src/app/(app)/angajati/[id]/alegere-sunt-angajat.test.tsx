// src/app/(app)/angajati/[id]/alegere-sunt-angajat.test.tsx
//
// Componenta nu face nimic — nu are stare, nu cheamă nicio acțiune. Tot ce
// livrează e TEXT, iar textul e chiar reparația: până la el, un administrator
// care voia să se ponteze nu avea de unde ști nici că e blocat, nici de ce,
// nici ce să facă. Un test pe randare ar fi fost gol; astea sunt pe conținut.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlegereSuntAngajat } from "./alegere-sunt-angajat";

describe("AlegereSuntAngajat", () => {
  it("spune CE nu se poate, nu doar care e starea", () => {
    render(<AlegereSuntAngajat esteFisaProprie poateCreaContract />);
    // „E candidat" e o etichetă; „nu vă puteți ponta" e informația.
    expect(screen.getByText(/nu vă puteți/u)).toBeDefined();
    expect(screen.getByText(/ponta/u)).toBeDefined();
  });

  it("numește alegerea ca alegere, cu ambele ramuri", () => {
    render(<AlegereSuntAngajat esteFisaProprie poateCreaContract />);
    const text = document.body.textContent ?? "";
    // Ramura „da, sunt angajat" …
    expect(text).toMatch(/și angajat/u);
    // … și ramura „nu, sunt doar administrator", care trebuie să rămână
    // legitimă: un administrator pe contract de mandat NU e o eroare de date.
    expect(text).toMatch(/mandat/u);
    expect(text).toMatch(/starea corectă/u);
  });

  it("vorbește altfel despre fișa altcuiva", () => {
    render(<AlegereSuntAngajat esteFisaProprie={false} poateCreaContract />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/Acest cont/u);
    expect(text).not.toMatch(/Contul dvs\./u);
  });

  it("fără dreptul de a crea contractul, nu trimite într-un refuz", () => {
    render(<AlegereSuntAngajat esteFisaProprie poateCreaContract={false} />);
    const text = document.body.textContent ?? "";
    // Nu îndeamnă la formularul de dedesubt — care nici nu se randează.
    expect(text).not.toMatch(/completați contractul de mai jos/iu);
    expect(text).toMatch(/Cereți-i unui administrator/u);
  });

  it("nu declară pe nimeni salariat: pomenește contractul, nu un comutator", () => {
    render(<AlegereSuntAngajat esteFisaProprie poateCreaContract />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/contract/iu);
  });
});
