// src/app/(app)/pontaj/setari/formular-pontare-rapida.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfigZi } from "@/domain/attendance/calcul-ore";
import type { ConfigPontareRapida } from "@/domain/attendance/pontare-rapida";
import type { AfisPontare } from "@/lib/queries/attendance";

/**
 * Fila „Pontarea" are o singură casetă — ora de început a programului — și
 * exact ea era cea fără eroare clară.
 *
 * Ecranul nu e un `<form>`: alegerile sunt carduri, iar salvarea e un
 * `onClick`, deci nu poate folosi `Formular`. Până acum consecința era că
 * refuzul schemei („Completați ora de început…", pus pe câmpul `program_start`
 * de un `.refine`) ajungea la om ca `error.message`, adică propoziția de
 * rezervă. Butonul se și stingea, fără să spună de ce.
 */

const salveazaPontareaRapida = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ salveazaPontareaRapida }));

/** Acțiunea modulului vecin: secțiunea „Afișele de pontare" o cheamă direct. */
const rotesteCodPontaj = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/puncte-lucru/actions", () => ({ rotesteCodPontaj }));

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { FormularPontareRapida } = await import("./formular-pontare-rapida");

/** Norma și pauza în vigoare azi — hrănesc doar intervalul propus de sub casetă. */
const CONFIG: ConfigZi = {
  orePeZi: 8,
  noapteStart: "22:00",
  noapteSfarsit: "06:00",
  pauzaMinute: 0,
  pauzaInclusaInProgram: false,
  pauzaObligatoriePesteOre: 6,
};

function randeaza(
  pontare: Partial<ConfigPontareRapida> = {},
  extra: { afise?: AfisPontare[]; poateGeneraCod?: boolean } = {},
) {
  const implicit: ConfigPontareRapida = {
    mod: "confirmare",
    verificare: "fara",
    programStart: "08:00",
    necesitaAprobare: true,
    ...pontare,
  };
  return render(
    <FormularPontareRapida
      pontare={implicit}
      afise={extra.afise ?? []}
      config={CONFIG}
      poateGeneraCod={extra.poateGeneraCod ?? true}
    />,
  );
}

const PUNCT_FARA_COD: AfisPontare = {
  id: "pl-1",
  denumire: "Sediu Mare",
  activ: true,
  areCod: false,
};

beforeEach(() => {
  salveazaPontareaRapida.mockReset();
  salveazaPontareaRapida.mockResolvedValue({ ok: true, data: { id: "1" } });
  rotesteCodPontaj.mockReset();
  rotesteCodPontaj.mockResolvedValue({ ok: true, data: { id: "pl-1", cod: "secret" } });
  refresh.mockReset();
});

describe("FormularPontareRapida — ora de început", () => {
  it("e marcată ca obligatorie când modul chiar o cere", () => {
    randeaza({ mod: "confirmare" });
    const ora = screen.getByLabelText(/Ora de început a programului/u);
    expect(ora.getAttribute("required")).not.toBeNull();
  });

  it("golită, spune CE lipsește — lângă casetă, nu sub buton", async () => {
    randeaza({ mod: "confirmare", programStart: "08:00" });

    const ora = screen.getByLabelText(/Ora de început a programului/u);
    await userEvent.clear(ora);
    await userEvent.tab();
    await userEvent.click(screen.getByRole("button", { name: /^Salvează$/u }));

    await waitFor(() => {
      expect(screen.getByText(/Completați ora de început a programului/u)).toBeDefined();
    });
    expect(ora.getAttribute("aria-invalid")).toBe("true");
    // Refuzul e cunoscut pe client: nu se mai plătește un drum la server.
    expect(salveazaPontareaRapida).not.toHaveBeenCalled();
  });

  it("modul „ceas” nu cere ora deloc: caseta nici nu se desenează", () => {
    randeaza({ mod: "ceas", programStart: null });
    expect(screen.queryByLabelText(/Ora de început a programului/u)).toBeNull();
  });

  it("cu ora completată, salvarea chiar pleacă", async () => {
    randeaza({ mod: "confirmare", programStart: "08:00" });
    await userEvent.click(screen.getByRole("button", { name: /^Salvează$/u }));

    await waitFor(() => {
      expect(salveazaPontareaRapida).toHaveBeenCalledTimes(1);
    });
    expect(salveazaPontareaRapida.mock.calls[0]?.[0]).toMatchObject({
      mod_pontare_rapida: "confirmare",
      program_start: "08:00",
    });
  });

  it("erorile venite de la server ajung tot pe câmp", async () => {
    salveazaPontareaRapida.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: { program_start: ["Ora trebuie să fie HH:MM."] },
        requestId: "test",
      },
    });

    randeaza({ mod: "confirmare", programStart: "08:00" });
    await userEvent.click(screen.getByRole("button", { name: /^Salvează$/u }));

    await waitFor(() => {
      expect(screen.getByText("Ora trebuie să fie HH:MM.")).toBeDefined();
    });
    // Propoziția generală nu se mai repetă când mesajul e deja lângă câmp.
    expect(screen.queryByText("Datele introduse nu sunt valide.")).toBeNull();
  });
});

describe("FormularPontareRapida — afișele de pontare", () => {
  /*
   * Secțiunea asta e puntea dintre pontaj și punctele de lucru. Butonul ei a
   * fost mult timp un `<Link>` către `/puncte-lucru`: promitea o acțiune și
   * livra o navigare, adică te lăsa în listă să cauți singur punctul de lucru.
   * Poarta de aici cere să CHEME acțiunea, cu identificatorul potrivit.
   */
  it("„Generează codul QR” cheamă acțiunea pentru punctul de lucru din rând", async () => {
    randeaza({}, { afise: [PUNCT_FARA_COD] });

    await userEvent.click(screen.getByRole("button", { name: /Generează codul QR/u }));

    await waitFor(() => {
      expect(rotesteCodPontaj).toHaveBeenCalledWith({ id: "pl-1" });
    });
    // Rândul trece pe „Tipărește afișul" fiindcă `areCod` se RECITEȘTE de pe
    // server; dacă s-ar ghici aici, ecranul ar minți la un refuz parțial.
    expect(refresh).toHaveBeenCalled();
  });

  it("refuzul acțiunii ajunge pe ecran, nu se pierde", async () => {
    rotesteCodPontaj.mockResolvedValue({
      ok: false,
      error: {
        code: "REGULA",
        message: "Punctul de lucru a fost șters între timp.",
        requestId: "t",
      },
    });
    randeaza({}, { afise: [PUNCT_FARA_COD] });

    await userEvent.click(screen.getByRole("button", { name: /Generează codul QR/u }));

    await waitFor(() => {
      expect(screen.getByText("Punctul de lucru a fost șters între timp.")).toBeDefined();
    });
  });

  it("fără `departments:update` nu se oferă butonul, ci se spune unde se face", () => {
    // Un buton care se apasă și nu scrie nimic e mai rău decât absența lui:
    // politica refuză cu ZERO rânduri și fără eroare. — capcana #17
    randeaza({}, { afise: [PUNCT_FARA_COD], poateGeneraCod: false });

    expect(screen.queryByRole("button", { name: /Generează codul QR/u })).toBeNull();
    expect(screen.getByRole("link", { name: /Puncte de lucru/u })).toBeDefined();
  });
});
