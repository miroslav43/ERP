// src/app/(app)/flota/incarcare-fisier-flota.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Încărcarea scanării și a pozei de bon (0202), cu acțiunile mimate: ce se
 * probează e ordinea celor trei pași (semnare → urcare → confirmare), ținta
 * corectă pentru fiecare fel și oprirea la primul pas care refuză. Verificarea
 * în browser nu e posibilă pe ramura asta — baza din cloud n-are 0202.
 */

const actiuni = vi.hoisted(() => ({
  pregatesteBon: vi.fn(),
  confirmaBon: vi.fn(),
  pregatesteScanareDocument: vi.fn(),
  confirmaScanareDocument: vi.fn(),
}));
const urcaPeUrlSemnat = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
// F12a: poza de bon trece prin re-encodarea în JPEG (canvas). happy-dom n-are
// canvas real, deci conversia e mimată; implicit întoarce fișierul neschimbat.
const pregatesteFotoBon = vi.hoisted(() => vi.fn());

vi.mock("./actions-fisiere", () => actiuni);
vi.mock("@/lib/storage/urca-semnat", () => ({ urcaPeUrlSemnat }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/documents/foto-bon-pregatire", async (orig) => ({
  ...(await orig<typeof import("@/lib/documents/foto-bon-pregatire")>()),
  pregatesteFotoBon,
}));

const { IncarcareFisierFlota } = await import("./incarcare-fisier-flota");

const ALIM = "11111111-1111-4111-8111-111111111111";
const FOAIE = "22222222-2222-4222-8222-222222222222";
const DOC = "33333333-3333-4333-8333-333333333333";
const VEH = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  for (const f of Object.values(actiuni)) f.mockReset();
  urcaPeUrlSemnat.mockReset();
  refresh.mockReset();
  pregatesteFotoBon.mockReset();
  pregatesteFotoBon.mockImplementation(async (f: File) => f);
});

function poza(): File {
  return new File([new Uint8Array(2048)], "bon.jpg", { type: "image/jpeg" });
}

describe("IncarcareFisierFlota", () => {
  it("bonul: semnează pe foaie, urcă, confirmă cu calea semnată, apoi reîmprospătează", async () => {
    actiuni.pregatesteBon.mockResolvedValue({
      ok: true,
      data: { cale: `org/trip_sheets/${FOAIE}/x-bon.jpg`, urlSemnat: "https://s/u" },
    });
    urcaPeUrlSemnat.mockResolvedValue(true);
    actiuni.confirmaBon.mockResolvedValue({ ok: true, data: { id: ALIM } });

    render(
      <IncarcareFisierFlota
        tinta={{ fel: "bon", alimentareId: ALIM, foaieId: FOAIE }}
        descriere="25 l"
        areFisier={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Atașează poza bonului: 25 l/u }));
    await userEvent.upload(screen.getByLabelText(/Poza bonului/u), poza());

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(actiuni.pregatesteBon).toHaveBeenCalledWith({
      alimentare_id: ALIM,
      trip_sheet_id: FOAIE,
      numeFisier: "bon.jpg",
      dimensiune: 2048,
      mime: "image/jpeg",
    });
    expect(urcaPeUrlSemnat).toHaveBeenCalledWith("https://s/u", expect.any(File));
    expect(actiuni.confirmaBon).toHaveBeenCalledWith({
      alimentare_id: ALIM,
      trip_sheet_id: FOAIE,
      cale: `org/trip_sheets/${FOAIE}/x-bon.jpg`,
    });
    expect(actiuni.pregatesteScanareDocument).not.toHaveBeenCalled();
  });

  it("scanarea: ținta e documentul vehiculului; cu fișier existent, butonul spune „Înlocuiește”", async () => {
    actiuni.pregatesteScanareDocument.mockResolvedValue({
      ok: true,
      data: { cale: `org/vehicles/${VEH}/x.pdf`, urlSemnat: "https://s/v" },
    });
    urcaPeUrlSemnat.mockResolvedValue(true);
    actiuni.confirmaScanareDocument.mockResolvedValue({ ok: true, data: { id: DOC } });

    render(
      <IncarcareFisierFlota
        tinta={{ fel: "scanare", documentId: DOC, vehiculId: VEH }}
        descriere="Asigurare RCA"
        areFisier
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Înlocuiește scanarea: Asigurare RCA/u }),
    );
    const pdf = new File([new Uint8Array(4096)], "polita.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/Fișierul scanat/u), pdf);

    await waitFor(() => {
      expect(actiuni.confirmaScanareDocument).toHaveBeenCalledWith({
        document_id: DOC,
        vehicle_id: VEH,
        cale: `org/vehicles/${VEH}/x.pdf`,
        numeFisier: "polita.pdf",
      });
    });
    expect(actiuni.pregatesteBon).not.toHaveBeenCalled();
  });

  it("la înlocuire nu promite o arhivă pe care niciun ecran n-o arată", async () => {
    // Confirmarea rescrie `fisier_path`; obiectul vechi rămâne orfan în
    // bucket, fără niciun link spre el. „Rămâne în arhivă” era o promisiune.
    render(
      <IncarcareFisierFlota
        tinta={{ fel: "scanare", documentId: DOC, vehiculId: VEH }}
        descriere="Asigurare RCA"
        areFisier
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Înlocuiește scanarea: Asigurare RCA/u }),
    );
    expect(screen.getByText(/înlocuiește pe cel de acum/u).textContent).not.toMatch(/arhiv/u);
  });

  it("refuzul de la semnare se arată în casetă, fără urcare și fără confirmare", async () => {
    actiuni.pregatesteBon.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Bonul se atașează doar cât foaia e ciornă.",
        requestId: "t",
      },
    });

    render(
      <IncarcareFisierFlota
        tinta={{ fel: "bon", alimentareId: ALIM, foaieId: FOAIE }}
        descriere="25 l"
        areFisier={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Atașează poza bonului/u }));
    await userEvent.upload(screen.getByLabelText(/Poza bonului/u), poza());

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Bonul se atașează doar cât foaia e ciornă.",
    );
    expect(urcaPeUrlSemnat).not.toHaveBeenCalled();
    expect(actiuni.confirmaBon).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("urcarea eșuată nu ajunge la confirmare", async () => {
    actiuni.pregatesteBon.mockResolvedValue({
      ok: true,
      data: { cale: "c", urlSemnat: "https://s/u" },
    });
    urcaPeUrlSemnat.mockResolvedValue(false);

    render(
      <IncarcareFisierFlota
        tinta={{ fel: "bon", alimentareId: ALIM, foaieId: FOAIE }}
        descriere="25 l"
        areFisier={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Atașează poza bonului/u }));
    await userEvent.upload(screen.getByLabelText(/Poza bonului/u), poza());

    expect((await screen.findByRole("alert")).textContent).toMatch(/conexiunea/u);
    expect(actiuni.confirmaBon).not.toHaveBeenCalled();
  });

  it("F12a: poza bonului se re-encodează în JPEG înainte de urcare (fără EXIF)", async () => {
    const jpeg = new File([new Uint8Array(512)], "IMG_1.jpg", { type: "image/jpeg" });
    pregatesteFotoBon.mockResolvedValue(jpeg);
    actiuni.pregatesteBon.mockResolvedValue({
      ok: true,
      data: { cale: `org/trip_sheets/${FOAIE}/x-IMG_1.jpg`, urlSemnat: "https://s/u" },
    });
    urcaPeUrlSemnat.mockResolvedValue(true);
    actiuni.confirmaBon.mockResolvedValue({ ok: true, data: { id: ALIM } });

    render(
      <IncarcareFisierFlota
        tinta={{ fel: "bon", alimentareId: ALIM, foaieId: FOAIE }}
        descriere="25 l"
        areFisier={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Atașează poza bonului/u }));
    const png = new File([new Uint8Array(4096)], "IMG_1.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/Poza bonului/u), png);

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(pregatesteFotoBon).toHaveBeenCalledWith(png);
    expect(actiuni.pregatesteBon).toHaveBeenCalledWith(
      expect.objectContaining({ numeFisier: "IMG_1.jpg", dimensiune: 512, mime: "image/jpeg" }),
    );
    expect(urcaPeUrlSemnat).toHaveBeenCalledWith("https://s/u", jpeg);
  });

  it("F12a: o poză pe care browserul n-o decodează se urcă originală, ca înainte", async () => {
    pregatesteFotoBon.mockRejectedValue(new Error("HEIC"));
    actiuni.pregatesteBon.mockResolvedValue({
      ok: true,
      data: { cale: `org/trip_sheets/${FOAIE}/x.heic`, urlSemnat: "https://s/u" },
    });
    urcaPeUrlSemnat.mockResolvedValue(true);
    actiuni.confirmaBon.mockResolvedValue({ ok: true, data: { id: ALIM } });

    render(
      <IncarcareFisierFlota
        tinta={{ fel: "bon", alimentareId: ALIM, foaieId: FOAIE }}
        descriere="25 l"
        areFisier={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Atașează poza bonului/u }));
    const heic = new File([new Uint8Array(2048)], "IMG_2.heic", { type: "image/heic" });
    await userEvent.upload(screen.getByLabelText(/Poza bonului/u), heic);

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(urcaPeUrlSemnat).toHaveBeenCalledWith("https://s/u", heic);
  });

  it("F12a: scanarea (PDF) nu trece prin conversie", async () => {
    actiuni.pregatesteScanareDocument.mockResolvedValue({
      ok: true,
      data: { cale: `org/vehicles/${VEH}/x.pdf`, urlSemnat: "https://s/v" },
    });
    urcaPeUrlSemnat.mockResolvedValue(true);
    actiuni.confirmaScanareDocument.mockResolvedValue({ ok: true, data: { id: DOC } });
    render(
      <IncarcareFisierFlota
        tinta={{ fel: "scanare", documentId: DOC, vehiculId: VEH }}
        descriere="RCA"
        areFisier={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Atașează scanarea: RCA/u }));
    const pdf = new File([new Uint8Array(4096)], "rca.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/Fișierul scanat/u), pdf);
    await waitFor(() => {
      expect(actiuni.confirmaScanareDocument).toHaveBeenCalled();
    });
    expect(pregatesteFotoBon).not.toHaveBeenCalled();
  });
});
