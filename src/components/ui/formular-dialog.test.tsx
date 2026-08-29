// src/components/ui/formular-dialog.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

const reimprospateaza = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: reimprospateaza,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  // `Formular` cheamă `useSemnalPanaLaRuta`, care citește calea curentă ca să
  // țină bara de încărcare aprinsă până se schimbă ruta. Fără export aici,
  // fiecare test care DESCHIDE caseta cade la montare.
  usePathname: () => "/departamente",
}));

import { Camp } from "./camp";
import { FormularDialog } from "./formular-dialog";
import { golesteToasturi } from "./toast";

/**
 * Regulile pe care le apără fișierul sunt cele două capcane din docblock-ul
 * componentei — amândouă tăcute, amândouă plătite deja o dată de mână în
 * `functii/formular-functie-noua.tsx`:
 *
 * 1. **Butonul de trimitere trebuie să fie ÎN `<form>`.** Pus în `subsol`-ul
 *    dialogului e frate cu formularul în DOM: nu trimite nimic și nu poate
 *    citi `stare.inCurs`, deci dispare „Se creează…" — singurul semn că
 *    apăsarea a fost înregistrată. Nu produce nicio eroare.
 * 2. **Caseta se randează la deschidere, nu se ascunde.** Un dialog permanent
 *    montează copiii de la prima randare a paginii; `CautaCor` ar ține 4422 de
 *    ocupații în memorie pentru un formular pe care nimeni nu-l deschide.
 *
 * Plus regula care costă cel mai mult când e greșită: **caseta NU se închide
 * la refuz.** React 19 resetează un `<form action={fn}>` necontrolat după orice
 * acțiune, inclusiv una eșuată; `Formular` pune valorile înapoi prin
 * `valoriTrimise`. O casetă care s-ar închide pe eroare le-ar arunca oricum.
 */

const REUSITA: ActionResult<{ id: string }> = { ok: true, data: { id: "d1" } };

function refuz(fieldErrors: Record<string, readonly string[]>): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "test",
    },
  };
}

/** `<dialog>` nativ: mediul de test nu implementează întotdeauna `showModal`. */
function asiguraDialogNativ(): void {
  const proto = globalThis.HTMLDialogElement?.prototype;
  if (proto === undefined) return;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function () {
      this.open = true;
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function () {
      this.open = false;
    };
  }
}
asiguraDialogNativ();

beforeEach(() => {
  golesteToasturi();
  reimprospateaza.mockClear();
});

function Proba({
  actiune,
  laReusita,
  laRandareaCampurilor,
}: {
  actiune: (d: FormData) => Promise<ActionResult<{ id: string }>>;
  laReusita?: (data: { id: string }) => void;
  laRandareaCampurilor?: () => void;
}) {
  return (
    <FormularDialog
      declansator={{ eticheta: "Departament nou" }}
      titlu="Departament nou"
      descriere="Codul e unic în organizație."
      actiune={actiune}
      mesajReusita="Departamentul a fost creat."
      etichetaTrimite="Creează departamentul"
      textInCurs="Se creează…"
      {...(laReusita === undefined ? {} : { laReusita })}
    >
      {(stare, idc) => {
        laRandareaCampurilor?.();
        return (
          <Camp
            nume="cod"
            id={idc("cod")}
            eticheta="Cod"
            obligatoriu
            {...(stare.erori["cod"] === undefined ? {} : { erori: stare.erori["cod"] })}
          >
            {(a) => <input {...a} defaultValue={stare.valoriTrimise["cod"] ?? ""} />}
          </Camp>
        );
      }}
    </FormularDialog>
  );
}

async function trimiteFormularul(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

describe("FormularDialog", () => {
  it("nu montează câmpurile înainte de deschidere", () => {
    const laRandareaCampurilor = vi.fn();
    render(<Proba actiune={async () => REUSITA} laRandareaCampurilor={laRandareaCampurilor} />);

    expect(laRandareaCampurilor).not.toHaveBeenCalled();
    expect(document.querySelector("dialog")).toBeNull();
    expect(screen.queryByLabelText(/Cod/)).toBeNull();
  });

  it("deschide caseta din buton și randează câmpurile abia atunci", () => {
    const laRandareaCampurilor = vi.fn();
    render(<Proba actiune={async () => REUSITA} laRandareaCampurilor={laRandareaCampurilor} />);

    fireEvent.click(screen.getByRole("button", { name: "Departament nou" }));

    expect(laRandareaCampurilor).toHaveBeenCalled();
    expect(document.querySelector("dialog")).not.toBeNull();
    expect(screen.getByLabelText(/Cod/)).toBeInstanceOf(HTMLInputElement);
  });

  it("butonul de trimitere e ÎN formular, nu frate cu el", () => {
    render(<Proba actiune={async () => REUSITA} />);
    fireEvent.click(screen.getByRole("button", { name: "Departament nou" }));

    const trimite = screen.getByRole("button", { name: "Creează departamentul" });
    expect(trimite.getAttribute("type")).toBe("submit");

    // Capcana: în `subsol`-ul dialogului butonul ar fi FRATE cu `<form>`, deci
    // n-ar trimite nimic și n-ar putea citi `stare.inCurs`.
    //
    // Invariantul se verifică urcând de la buton la formular și cerând ca ACEL
    // formular să conțină câmpurile — nu comparând noduri între ele. Sub
    // happy-dom (vezi `vitest.config.mts`: jsdom ≥30 cere Node 22), `closest`
    // și `querySelector` întorc obiecte diferite pentru același nod, deci un
    // `===` ar pica pe o structură perfect corectă.
    const formularulButonului = trimite.closest("form");
    expect(formularulButonului).not.toBeNull();
    expect(formularulButonului?.querySelector('[name="cod"]')).not.toBeNull();
  });

  it("NU se închide când acțiunea e refuzată, și păstrează ce s-a scris", async () => {
    render(<Proba actiune={async () => refuz({ cod: ["Codul e deja folosit."] })} />);
    fireEvent.click(screen.getByRole("button", { name: "Departament nou" }));

    fireEvent.change(screen.getByLabelText(/Cod/), { target: { value: "IT" } });
    await trimiteFormularul();

    expect(document.querySelector("dialog")).not.toBeNull();
    await screen.findByText("Codul e deja folosit.");
    expect((screen.getByLabelText(/Cod/) as HTMLInputElement).value).toBe("IT");
    expect(reimprospateaza).not.toHaveBeenCalled();
  });

  it("se închide la reușită, reîmprospătează ruta și predă datele apelantului", async () => {
    const laReusita = vi.fn();
    render(<Proba actiune={async () => REUSITA} laReusita={laReusita} />);
    fireEvent.click(screen.getByRole("button", { name: "Departament nou" }));

    await trimiteFormularul();

    await waitFor(() => {
      expect(document.querySelector("dialog")).toBeNull();
    });
    expect(reimprospateaza).toHaveBeenCalledTimes(1);
    expect(laReusita).toHaveBeenCalledExactlyOnceWith({ id: "d1" });
  });

  it("un `laReusita` nememorat de apelant nu se execută de două ori", async () => {
    // Apelantul dă o funcție NOUĂ la fiecare randare — cazul obișnuit, dacă
    // uită `useCallback`. Fără referința din componentă, ar reporni efectul
    // din `Formular` după succes și notificarea ar apărea de două ori.
    const spion = vi.fn();
    function Instabil() {
      return <Proba actiune={async () => REUSITA} laReusita={(d) => spion(d)} />;
    }
    render(<Instabil />);
    fireEvent.click(screen.getByRole("button", { name: "Departament nou" }));

    await trimiteFormularul();

    await waitFor(() => {
      expect(spion).toHaveBeenCalledTimes(1);
    });
  });

  it("două instanțe pe aceeași pagină nu-și fură focusul prin identificatori identici", () => {
    render(
      <>
        <Proba actiune={async () => REUSITA} />
        <Proba actiune={async () => REUSITA} />
      </>,
    );
    const butoane = screen.getAllByRole("button", { name: "Departament nou" });
    fireEvent.click(butoane[0]!);
    fireEvent.click(butoane[1]!);

    const campuri = screen.getAllByLabelText(/Cod/);
    expect(campuri).toHaveLength(2);
    expect(campuri[0]!.id).not.toBe(campuri[1]!.id);
  });
});
