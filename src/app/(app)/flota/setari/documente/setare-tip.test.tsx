// src/app/(app)/flota/setari/documente/setare-tip.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Setarea firmei pe un tip de platformă și caseta tipului propriu (0199), cu
 * acțiunile mimate: drumul de la bife la încărcătura acțiunii și de la refuz
 * înapoi pe ecran. Verificarea în browser nu e posibilă pe ramura asta — baza
 * din cloud n-are 0199.
 */

const actiuni = vi.hoisted(() => ({
  salveazaSetareTipDocument: vi.fn(),
  creeazaTipDocument: vi.fn(),
  actualizeazaTipDocument: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("../../actions-tipuri", () => actiuni);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/incarcare/use-incarcare", () => ({
  useSemnalPanaLaRuta: () => () => undefined,
}));

const { SetareTip } = await import("./setare-tip");
const { DialogTipPropriu } = await import("./dialog-tip-propriu");

const TIP = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  for (const f of Object.values(actiuni)) f.mockReset();
  refresh.mockReset();
});

describe("SetareTip", () => {
  it("activează un tip retras și îl face obligatoriu pentru firmă", async () => {
    actiuni.salveazaSetareTipDocument.mockResolvedValue({ ok: true, data: { id: "s" } });
    render(<SetareTip tipId={TIP} denumire="Certificat ADR" activ={false} obligatoriu={false} />);

    const obligatoriu = screen.getByLabelText("Obligatoriu") as HTMLInputElement;
    expect(obligatoriu.disabled).toBe(true);
    await userEvent.click(screen.getByLabelText("Folosit de firmă"));
    expect(obligatoriu.disabled).toBe(false);
    await userEvent.click(obligatoriu);
    await userEvent.click(
      screen.getByRole("button", { name: /Salvează setarea pentru „Certificat ADR”/u }),
    );

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(actiuni.salveazaSetareTipDocument).toHaveBeenCalledWith({
      document_type_id: TIP,
      activ: true,
      obligatoriu: true,
    });
  });

  it("retras ⇒ trimite neobligatoriu, chiar dacă bifa rămăsese pusă", async () => {
    actiuni.salveazaSetareTipDocument.mockResolvedValue({ ok: true, data: { id: "s" } });
    render(<SetareTip tipId={TIP} denumire="Asigurare RCA" activ obligatoriu />);
    await userEvent.click(screen.getByLabelText("Folosit de firmă"));
    await userEvent.click(screen.getByRole("button", { name: /Salvează/u }));
    await waitFor(() => {
      expect(actiuni.salveazaSetareTipDocument).toHaveBeenCalledWith({
        document_type_id: TIP,
        activ: false,
        obligatoriu: false,
      });
    });
  });

  it("refuzul acțiunii rămâne pe rând, fără reîmprospătare", async () => {
    actiuni.salveazaSetareTipDocument.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "Setarea a fost schimbată între timp.", requestId: "t" },
    });
    render(<SetareTip tipId={TIP} denumire="CASCO" activ obligatoriu={false} />);
    await userEvent.click(screen.getByRole("button", { name: /Salvează/u }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Setarea a fost schimbată între timp.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("DialogTipPropriu", () => {
  it("tipul nou: denumirea, bifele și categoriile ajung în `creeazaTipDocument`", async () => {
    actiuni.creeazaTipDocument.mockResolvedValue({ ok: true, data: { id: TIP } });
    render(<DialogTipPropriu />);

    await userEvent.click(screen.getByRole("button", { name: /Tip nou/u }));
    await userEvent.type(screen.getByLabelText(/Denumire/u), "Permis de acces în port");
    await userEvent.click(screen.getByLabelText("Obligatoriu"));
    await userEvent.click(screen.getByLabelText("Camion"));
    await userEvent.click(screen.getByLabelText("Semiremorcă"));
    await userEvent.click(screen.getByRole("button", { name: "Creează tipul" }));

    await waitFor(() => {
      expect(actiuni.creeazaTipDocument).toHaveBeenCalledTimes(1);
    });
    expect(actiuni.creeazaTipDocument).toHaveBeenCalledWith({
      denumire: "Permis de acces în port",
      descriere: null,
      cere_expirare: true,
      obligatoriu: true,
      categorii_aplicabile: ["camion", "semiremorca"],
      masa_max_kg: "",
    });
  });

  it("refuzul pe `denumire` (tip comun cu același nume) ajunge pe câmp", async () => {
    const mesaj = "Există deja tipul „Asigurare RCA” în nomenclatorul comun.";
    actiuni.creeazaTipDocument.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: { denumire: [mesaj] },
        requestId: "t",
      },
    });
    render(<DialogTipPropriu />);
    await userEvent.click(screen.getByRole("button", { name: /Tip nou/u }));
    await userEvent.type(screen.getByLabelText(/Denumire/u), "RCA");
    await userEvent.click(screen.getByRole("button", { name: "Creează tipul" }));
    expect(await screen.findByText(mesaj)).toBeDefined();
  });
});
