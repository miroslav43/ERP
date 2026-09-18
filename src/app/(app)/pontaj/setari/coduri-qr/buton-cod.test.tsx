// src/app/(app)/pontaj/setari/coduri-qr/buton-cod.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Butonul care face codul QR, din fila de pontaj.
 *
 * Porțile de aici păzesc trei lucruri care s-au stricat deja o dată, în forma
 * lui anterioară din „Afișele de pontare": butonul era un `<Link>` către
 * `/puncte-lucru`, adică promitea o acțiune și livra o navigare.
 */
const rotesteCodPontaj = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/puncte-lucru/actions", () => ({ rotesteCodPontaj }));

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { ButonCodQr } = await import("./buton-cod");

beforeEach(() => {
  rotesteCodPontaj.mockReset();
  rotesteCodPontaj.mockResolvedValue({ ok: true, data: { id: "pl-1", cod: "secret" } });
  refresh.mockReset();
});

describe("ButonCodQr", () => {
  it("cheamă acțiunea cu punctul de lucru al rândului, nu cu altul", async () => {
    render(<ButonCodQr punctId="pl-1" areCod={false} />);

    await userEvent.click(screen.getByRole("button", { name: /Generează codul QR/u }));

    await waitFor(() => {
      expect(rotesteCodPontaj).toHaveBeenCalledWith({ id: "pl-1" });
    });
    /*
     * Codul se desenează ca SVG pe SERVER, ca șirul să nu treacă granița. Deci
     * poza nouă vine dintr-o reîncărcare, nu din răspunsul acțiunii — deși
     * răspunsul chiar conține codul și ar fi fost la îndemână să-l folosim.
     */
    expect(refresh).toHaveBeenCalled();
  });

  it("peste un cod viu, eticheta și avertismentul spun că cel vechi moare", () => {
    render(<ButonCodQr punctId="pl-1" areCod />);

    const b = screen.getByRole("button", { name: /Generează un cod nou/u });
    // „nou" e tot ce încape în etichetă; propoziția întreagă stă în `title`,
    // fiindcă afișele deja lipite devin hârtie moartă la apăsare.
    expect(b.getAttribute("title")).toMatch(/nu vor mai funcționa/u);
  });

  it("refuzul acțiunii ajunge pe ecran, nu se pierde în tăcere", async () => {
    rotesteCodPontaj.mockResolvedValue({
      ok: false,
      error: {
        code: "REGULA",
        message: "Punctul de lucru a fost șters între timp.",
        requestId: "t",
      },
    });
    render(<ButonCodQr punctId="pl-1" areCod={false} />);

    await userEvent.click(screen.getByRole("button", { name: /Generează codul QR/u }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Punctul de lucru a fost șters între timp.",
      );
    });
    // Un refuz nu e o reușită: pagina NU se reîmprospătează, ca mesajul să
    // rămână pe ecran.
    expect(refresh).not.toHaveBeenCalled();
  });
});
