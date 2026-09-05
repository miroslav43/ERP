// src/app/(app)/pontaj/setari/formular-pontare-rapida.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfigZi } from "@/domain/attendance/calcul-ore";
import type { ConfigPontareRapida } from "@/domain/attendance/pontare-rapida";

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

function randeaza(pontare: Partial<ConfigPontareRapida> = {}) {
  const implicit: ConfigPontareRapida = {
    mod: "confirmare",
    verificare: "fara",
    programStart: "08:00",
    necesitaAprobare: true,
    ...pontare,
  };
  return render(<FormularPontareRapida pontare={implicit} afise={[]} config={CONFIG} />);
}

beforeEach(() => {
  salveazaPontareaRapida.mockReset();
  salveazaPontareaRapida.mockResolvedValue({ ok: true, data: { id: "1" } });
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
