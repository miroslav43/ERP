// src/components/ui/formular.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

import { Camp } from "./camp";
import { Formular } from "./formular";
import { ZonaToast, golesteToasturi } from "./toast";

// Coada de notificări e la nivel de modul, deci supraviețuiește între teste.
beforeEach(() => {
  golesteToasturi();
});

/**
 * Regula pe care o apără fișierul: **mesajul serverului ajunge lângă câmpul
 * vinovat, nu sub buton.**
 *
 * `create-action.ts` construiește `fieldErrors` la fiecare acțiune, prin
 * `z.flattenError`. Din ~99 de formulare, aproximativ 7 le citeau. Cazul cel
 * mai limpede: schema de parolă produce „Parolele nu coincid." pe câmpul
 * `confirma_parola`, iar utilizatorul citea sub buton „Datele introduse nu sunt
 * valide." — mesajul exact exista și se arunca.
 */

function refuz(
  fieldErrors: Record<string, readonly string[]> | null,
  message = "Datele introduse nu sunt valide.",
): ActionResult<never> {
  return {
    ok: false,
    error: { code: "VALIDARE", message, fieldErrors, requestId: "test" },
  };
}

function FormularProba({
  actiune,
  mesajReusita,
}: {
  actiune: (d: FormData) => Promise<ActionResult<{ id: string }>>;
  mesajReusita?: string;
}) {
  return (
    <Formular actiune={actiune} {...(mesajReusita === undefined ? {} : { mesajReusita })}>
      {({ erori, inCurs, valoriTrimise }) => (
        <>
          <Camp
            nume="cnp"
            eticheta="CNP"
            {...(erori["cnp"] === undefined ? {} : { erori: erori["cnp"] })}
          >
            {(a) => <input {...a} defaultValue={valoriTrimise["cnp"] ?? ""} />}
          </Camp>
          <Camp
            nume="confirma_parola"
            eticheta="Confirmă parola"
            {...(erori["confirma_parola"] === undefined ? {} : { erori: erori["confirma_parola"] })}
          >
            {(a) => <input {...a} type="password" />}
          </Camp>
          <button type="submit" disabled={inCurs}>
            Salvează
          </button>
        </>
      )}
    </Formular>
  );
}

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

describe("Formular — erorile ajung pe câmp", () => {
  it("mesajul serverului apare lângă câmpul lui, legat prin aria-describedby", async () => {
    render(
      <FormularProba actiune={async () => refuz({ confirma_parola: ["Parolele nu coincid."] })} />,
    );
    await trimite();

    await waitFor(() => {
      expect(screen.getByText("Parolele nu coincid.")).toBeDefined();
    });

    const camp = screen.getByLabelText("Confirmă parola");
    expect(camp.getAttribute("aria-invalid")).toBe("true");
    const idEroare = camp.getAttribute("aria-describedby");
    expect(idEroare).toBeTruthy();
    expect(document.getElementById(idEroare ?? "")?.textContent).toContain("Parolele nu coincid.");
  });

  it("mesajul general NU se mai repetă când eroarea e deja pe un câmp", async () => {
    // Altfel omul citește aceeași propoziție de două ori — o dată lângă câmp și
    // o dată sub buton — iar cea de sub buton e mereu cea mai vagă.
    render(
      <FormularProba
        actiune={async () => refuz({ cnp: ["Cifra de control nu se potrivește."] })}
      />,
    );
    await trimite();

    await waitFor(() => {
      expect(screen.getByText("Cifra de control nu se potrivește.")).toBeDefined();
    });
    expect(screen.queryByText("Datele introduse nu sunt valide.")).toBeNull();
  });

  it("mesajul general apare când eroarea NU aparține niciunui câmp", async () => {
    render(<FormularProba actiune={async () => refuz(null, "Perioada este blocată.")} />);
    await trimite();

    await waitFor(() => {
      expect(screen.getByText("Perioada este blocată.")).toBeDefined();
    });
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("câmpurile fără eroare rămân curate", async () => {
    render(<FormularProba actiune={async () => refuz({ cnp: ["Greșit."] })} />);
    await trimite();

    await waitFor(() => expect(screen.getByText("Greșit.")).toBeDefined());
    const curat = screen.getByLabelText("Confirmă parola");
    expect(curat.hasAttribute("aria-invalid")).toBe(false);
    expect(curat.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("Formular — ce se întâmplă cu ce s-a scris", () => {
  it("valorile trimise se întorc, ca formularul să nu se golească la eroare", async () => {
    // Cu `<form action>` și câmpuri necontrolate, React 19 RESETEAZĂ formularul
    // după acțiune. Fără `valoriTrimise`, omul pierdea tot ce a scris fiindcă a
    // greșit un singur câmp — defect real, observat în nomenclatoare.
    render(<FormularProba actiune={async () => refuz({ cnp: ["Greșit."] })} />);
    const cnp = screen.getByLabelText("CNP") as HTMLInputElement;
    act(() => fireEvent.change(cnp, { target: { value: "1790212345678" } }));
    await trimite();

    await waitFor(() => expect(screen.getByText("Greșit.")).toBeDefined());
    expect((screen.getByLabelText("CNP") as HTMLInputElement).defaultValue).toBe("1790212345678");
  });

  /**
   * Selecturile NU urmează tiparul de mai sus de la sine: react-dom aplică
   * `defaultValue` pe `<select>` doar la montare, iar un select CONTROLAT
   * primește de la React doar `selected`, nu și `defaultSelected`, deci
   * `form.reset()` de după acțiune îl duce pe PRIMA opțiune. Găsit de QA
   * (ADM-036) pe un formular deja migrat pe `<Formular>`.
   */
  function FormularSelecturi({
    actiune,
  }: {
    actiune: (d: FormData) => Promise<ActionResult<{ id: string }>>;
  }) {
    const [tara, setTara] = useState("ro");
    return (
      <Formular actiune={actiune}>
        {({ erori, valoriTrimise }) => (
          <>
            <Camp nume="scop" eticheta="Scop" erori={erori["scop"] ?? []}>
              {(a) => <input {...a} defaultValue={valoriTrimise["scop"] ?? ""} />}
            </Camp>
            <Camp nume="employee_id" eticheta="Angajat" fel="select">
              {(a) => (
                <select {...a} defaultValue={valoriTrimise["employee_id"] ?? ""}>
                  <option value="">Eu însumi</option>
                  <option value="e1">Ana</option>
                  <option value="e2">Bianca</option>
                </select>
              )}
            </Camp>
            <Camp nume="country_id" eticheta="Țara" fel="select">
              {(a) => (
                <select
                  {...a}
                  value={tara}
                  onChange={(e) => {
                    setTara(e.target.value);
                  }}
                >
                  <option value="at">Austria</option>
                  <option value="de">Germania</option>
                  <option value="ro">România</option>
                </select>
              )}
            </Camp>
            <button type="submit">Salvează</button>
          </>
        )}
      </Formular>
    );
  }

  it("un <select> necontrolat cu defaultValue din valoriTrimise rămâne pe opțiunea aleasă", async () => {
    render(<FormularSelecturi actiune={async () => refuz({ scop: ["Greșit."] })} />);
    const angajat = screen.getByLabelText("Angajat") as HTMLSelectElement;
    act(() => fireEvent.change(angajat, { target: { value: "e2" } }));
    expect(angajat.value).toBe("e2");
    await trimite();

    await waitFor(() => expect(screen.getByText("Greșit.")).toBeDefined());
    expect((screen.getByLabelText("Angajat") as HTMLSelectElement).value).toBe("e2");
  });

  it("un <select> controlat rămâne pe opțiunea aleasă, nu cade pe prima", async () => {
    render(<FormularSelecturi actiune={async () => refuz({ scop: ["Greșit."] })} />);
    const tara = screen.getByLabelText("Țara") as HTMLSelectElement;
    act(() => fireEvent.change(tara, { target: { value: "de" } }));
    expect(tara.value).toBe("de");
    await trimite();

    await waitFor(() => expect(screen.getByText("Greșit.")).toBeDefined());
    expect((screen.getByLabelText("Țara") as HTMLSelectElement).value).toBe("de");
  });
});

describe("Formular — confirmarea reușitei", () => {
  it("scoate o notificare când i se dă un mesaj", async () => {
    render(
      <>
        <ZonaToast />
        <FormularProba
          actiune={async () => ({ ok: true, data: { id: "x" } })}
          mesajReusita="Angajat înregistrat."
        />
      </>,
    );
    await trimite();
    await waitFor(() => {
      expect(screen.getByText("Angajat înregistrat.")).toBeDefined();
    });
  });

  it("tace când nu i se dă niciun mesaj", async () => {
    render(
      <>
        <ZonaToast />
        <FormularProba actiune={async () => ({ ok: true, data: { id: "x" } })} />
      </>,
    );
    await trimite();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Formular — forma HTML", () => {
  it("randează un <form action> real, deci Enter trimite", () => {
    // Tiparul vechi punea `type="button"` pe ambele butoane și citea
    // `e.currentTarget.form` — Enter nu făcea nimic.
    render(<FormularProba actiune={async () => refuz(null)} />);
    const f = document.querySelector("form");
    expect(f).not.toBeNull();
    expect(screen.getByRole("button", { name: "Salvează" }).getAttribute("type")).toBe("submit");
  });

  it("dezactivează validarea nativă a browserului", () => {
    // Bulele native sunt în engleză, cu texte pe care nu le controlăm, și
    // opresc trimiterea înainte ca Zod să spună ceva mai bun în română.
    render(<FormularProba actiune={async () => refuz(null)} />);
    expect(document.querySelector("form")?.hasAttribute("novalidate")).toBe(true);
  });
});
