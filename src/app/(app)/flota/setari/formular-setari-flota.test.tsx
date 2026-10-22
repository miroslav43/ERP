// src/app/(app)/flota/setari/formular-setari-flota.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";
import type { CandidatResponsabil, SetariFlota } from "@/lib/queries/fleet";

/**
 * Formularul setărilor flotei (0201), cu acțiunea mimată: ce se probează e
 * drumul de la `FormData` la încărcătura acțiunii (bifele, textul pragurilor)
 * și de la `fieldErrors` înapoi la câmp. Verificarea în browser nu e posibilă
 * pe ramura asta — baza din cloud n-are 0201.
 */

const salveazaSetariFlota = vi.hoisted(() => vi.fn());
vi.mock("../actions-setari", () => ({ salveazaSetariFlota }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/components/incarcare/use-incarcare", () => ({
  useSemnalPanaLaRuta: () => () => undefined,
}));

const { FormularSetariFlota } = await import("./formular-setari-flota");

const ANA = "11111111-1111-4111-8111-111111111111";
const BOGDAN = "22222222-2222-4222-8222-222222222222";
const CRISTI = "33333333-3333-4333-8333-333333333333";

const candidati: readonly CandidatResponsabil[] = [
  { id: ANA, full_name: "Ana Pop", marca: "A1", user_id: "u-ana", status: "activ" },
  { id: BOGDAN, full_name: "Bogdan Ion", marca: null, user_id: null, status: "activ" },
  { id: CRISTI, full_name: "Cristi Dan", marca: "C3", user_id: "u-cristi", status: "inactiv" },
];

const setari: SetariFlota = {
  id: "s1",
  responsabili: [CRISTI],
  prag_salt_km: 1200,
  praguri_alerta_zile: [30, 14, 7],
};

// F12d (0216): setările rezervărilor de pool, în același formular.
const proprietati = {
  setari,
  candidati,
  rezervari: { cuAprobare: false, obligatorie: true, maxZile: 14 },
  rezervariInAsteptare: 0,
} as const;

function refuz(fieldErrors: Record<string, readonly string[]>): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "t",
    },
  };
}

beforeEach(() => {
  salveazaSetariFlota.mockReset();
});

describe("FormularSetariFlota", () => {
  it("arată valorile salvate: bifa responsabilului, pragurile ca text, pragul de salt", () => {
    render(<FormularSetariFlota {...proprietati} />);
    expect((screen.getByLabelText(/Cristi Dan/u) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Ana Pop/u) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/Alerte înainte de scadență/u) as HTMLInputElement).value).toBe(
      "30, 14, 7",
    );
    expect((screen.getByLabelText(/Prag de salt/u) as HTMLInputElement).value).toBe("1200");
  });

  it("spune pe față ce-l oprește pe un candidat să primească alerte", () => {
    render(<FormularSetariFlota {...proprietati} />);
    expect(screen.getByLabelText(/Bogdan Ion — fără cont/u)).toBeDefined();
    expect(screen.getByLabelText(/Cristi Dan \(C3\) — nu mai este activ/u)).toBeDefined();
  });

  it("trimite bifele și textul pragurilor exact cum le-a lăsat omul", async () => {
    salveazaSetariFlota.mockResolvedValue({ ok: true, data: { id: "s1" } });
    render(<FormularSetariFlota {...proprietati} />);

    await userEvent.click(screen.getByLabelText(/Ana Pop/u));
    const praguri = screen.getByLabelText(/Alerte înainte de scadență/u);
    await userEvent.clear(praguri);
    await userEvent.type(praguri, "45, 7");
    await userEvent.click(screen.getByRole("button", { name: /Salvează setările/u }));

    await waitFor(() => {
      expect(salveazaSetariFlota).toHaveBeenCalledTimes(1);
    });
    expect(salveazaSetariFlota).toHaveBeenCalledWith({
      responsabili: [ANA, CRISTI],
      prag_salt_km: "1200",
      praguri_alerta_zile: "45, 7",
      rezervari_cu_aprobare: false,
      rezervare_obligatorie: true,
      rezervari_max_zile: "14",
    });
  });

  // F12d (0216): bifele rezervărilor pleacă booleene (nebifată = `false`, nu lipsă).
  it("setările rezervărilor: valorile salvate, bifele schimbate, durata ca text", async () => {
    salveazaSetariFlota.mockResolvedValue({ ok: true, data: { id: "s1" } });
    render(<FormularSetariFlota {...proprietati} rezervariInAsteptare={3} />);

    expect(screen.getByText(/3 rezervări așteaptă decizia și rămân de decis/u)).toBeDefined();
    const aprobare = screen.getByLabelText(/Rezervările cer aprobare/u) as HTMLInputElement;
    const obligatorie = screen.getByLabelText(/doar cu rezervare/u) as HTMLInputElement;
    expect(aprobare.checked).toBe(false);
    expect(obligatorie.checked).toBe(true);

    await userEvent.click(aprobare);
    await userEvent.click(obligatorie);
    const durata = screen.getByLabelText(/Durata maximă a unei rezervări/u);
    await userEvent.clear(durata);
    await userEvent.type(durata, "7");
    await userEvent.click(screen.getByRole("button", { name: /Salvează setările/u }));

    await waitFor(() => {
      expect(salveazaSetariFlota).toHaveBeenCalledTimes(1);
    });
    expect(salveazaSetariFlota.mock.calls[0]?.[0]).toMatchObject({
      rezervari_cu_aprobare: true,
      rezervare_obligatorie: false,
      rezervari_max_zile: "7",
    });
  });

  it("fără nicio bifă pleacă lista goală (toți administratorii), nu lipsa câmpului", async () => {
    salveazaSetariFlota.mockResolvedValue({ ok: true, data: { id: "s1" } });
    render(<FormularSetariFlota {...proprietati} />);
    await userEvent.click(screen.getByLabelText(/Cristi Dan/u));
    await userEvent.click(screen.getByRole("button", { name: /Salvează setările/u }));
    await waitFor(() => {
      expect(salveazaSetariFlota).toHaveBeenCalledTimes(1);
    });
    expect(salveazaSetariFlota.mock.calls[0]?.[0]).toMatchObject({ responsabili: [] });
  });

  it("refuzul bazei pe responsabili ajunge lângă listă, ca alertă", async () => {
    const mesaj = "Responsabilul de flotă ales nu este angajat al organizației.";
    salveazaSetariFlota.mockResolvedValue(refuz({ responsabili: [mesaj] }));
    render(<FormularSetariFlota {...proprietati} />);
    await userEvent.click(screen.getByRole("button", { name: /Salvează setările/u }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(mesaj);
    });
  });

  it("eroarea pe praguri se leagă de câmp pentru cititorul de ecran", async () => {
    salveazaSetariFlota.mockResolvedValue(
      refuz({ praguri_alerta_zile: ["Fiecare prag e între 1 și 365 de zile."] }),
    );
    render(<FormularSetariFlota {...proprietati} />);
    await userEvent.click(screen.getByRole("button", { name: /Salvează setările/u }));
    await waitFor(() => {
      expect(screen.getByText("Fiecare prag e între 1 și 365 de zile.")).toBeDefined();
    });
    const camp = screen.getByLabelText(/Alerte înainte de scadență/u);
    expect(camp.getAttribute("aria-invalid")).toBe("true");
  });
});
