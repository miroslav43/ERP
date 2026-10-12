// src/app/(app)/setari/membri/membri-client.test.tsx
//
// „Dezactivează” și „Revocă” se executau la primul clic (QA oct 2026:
// ONB-029). Caseta numește PERSOANA — „Dezactivați accesul lui Ana Pop?” — nu
// întreabă „Sigur?”; „Reactivează” rămâne directă, fiindcă nu ia nimic nimănui.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Locuri } from "@/lib/invitatii/locuri";

import { PanouMembri } from "./membri-client";

const {
  invitaMembru,
  retrimiteInvitatia,
  revocaInvitatia,
  schimbaRolulMembrului,
  seteazaStareaMembrului,
} = vi.hoisted(() => ({
  invitaMembru: vi.fn(),
  retrimiteInvitatia: vi.fn(),
  revocaInvitatia: vi.fn(),
  schimbaRolulMembrului: vi.fn(),
  seteazaStareaMembrului: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/setari/membri",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./actions", () => ({
  invitaMembru,
  retrimiteInvitatia,
  revocaInvitatia,
  schimbaRolulMembrului,
  seteazaStareaMembrului,
}));

// `clientEnv` validează variabilele la import; proiectul `ui` nu le pune.
vi.mock("@/config/env", () => ({
  clientEnv: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  },
}));

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

const ANA = "11111111-1111-4111-8111-111111111111";
const ION = "22222222-2222-4222-8222-222222222222";
const INVITATIE = "33333333-3333-4333-8333-333333333333";

const dialogDeschis = (): HTMLDialogElement | null => document.querySelector("dialog[open]");

/**
 * `Tabel` randează DE DOUĂ ORI fiecare rând — tabelul de birou și cardul de
 * telefon, pe care CSS-ul le alternează — deci fiecare buton apare de două
 * ori în DOM. Se apasă primul; confirmarea se caută în caseta DESCHISĂ.
 */
async function apasa(nume: string): Promise<void> {
  const [primul] = screen.getAllByRole("button", { name: nume });
  if (primul === undefined) throw new Error(`Niciun buton „${nume}”.`);
  await act(async () => {
    fireEvent.click(primul);
  });
}

async function confirma(nume: string): Promise<void> {
  const d = dialogDeschis();
  if (d === null) throw new Error("Nicio casetă deschisă.");
  await act(async () => {
    fireEvent.click(within(d).getByRole("button", { name: nume }));
  });
}

function randeaza(locuri: Locuri | null = null): void {
  render(
    <PanouMembri
      membri={[
        {
          id: ANA,
          nume: "Ana Pop",
          email: "ana@exemplu.ro",
          role: "employee",
          status: "active",
          jobTitle: null,
          esteEu: false,
          userId: null,
          fisaId: null,
        },
        {
          id: ION,
          nume: "Ion Ionescu",
          email: "ion@exemplu.ro",
          role: "employee",
          status: "inactive",
          jobTitle: null,
          esteEu: false,
          userId: null,
          fisaId: null,
        },
      ]}
      invitatii={[
        {
          id: INVITATIE,
          email: "nou@exemplu.ro",
          role: "employee",
          expiraLa: "19.10.2026",
          fisa: null,
        },
      ]}
      locuri={locuri}
      poateInvita
      poateVedeaFise={false}
      poateAcordaPermisiuni={false}
      poateVedeaAudit={false}
    />,
  );
}

beforeEach(() => {
  seteazaStareaMembrului.mockReset();
  revocaInvitatia.mockReset();
  seteazaStareaMembrului.mockResolvedValue({ ok: true, data: null });
  revocaInvitatia.mockResolvedValue({ ok: true, data: null });
  retrimiteInvitatia.mockReset();
});

describe("PanouMembri — dezactivarea și revocarea cer confirmare", () => {
  it("„Dezactivează” deschide caseta cu numele persoanei, fără să cheme acțiunea", async () => {
    randeaza();
    await apasa("Dezactivează");
    expect(seteazaStareaMembrului).not.toHaveBeenCalled();
    const d = dialogDeschis();
    expect(d).not.toBeNull();
    expect(
      within(d as HTMLDialogElement).getByText("Dezactivați accesul lui Ana Pop?"),
    ).toBeDefined();
  });

  it("confirmarea dezactivează exact acel membru", async () => {
    randeaza();
    await apasa("Dezactivează");
    await confirma("Dezactivează accesul");
    expect(seteazaStareaMembrului).toHaveBeenCalledTimes(1);
    expect(seteazaStareaMembrului).toHaveBeenCalledWith({ memberId: ANA, status: "inactive" });
  });

  it("„Revocă” numește e-mailul invitației și revocă doar după confirmare", async () => {
    randeaza();
    await apasa("Revocă");
    expect(revocaInvitatia).not.toHaveBeenCalled();
    expect(screen.getByText("Revocați invitația pentru nou@exemplu.ro?")).toBeDefined();
    await confirma("Revocă invitația");
    expect(revocaInvitatia).toHaveBeenCalledWith({ invitationId: INVITATIE });
  });

  it("„Reactivează” rămâne directă: reversibilă și fără pierdere", async () => {
    randeaza();
    await apasa("Reactivează");
    expect(seteazaStareaMembrului).toHaveBeenCalledWith({ memberId: ION, status: "active" });
    expect(dialogDeschis()).toBeNull();
  });
});

// ONB-026 / ONB-027: linkul invitației se arată o singură dată, deci pe rând
// există „Retrimite" (token nou, linkul vechi moare); iar sub „Membri" stă
// numărătoarea locurilor din contract, aceeași cu cea a refuzului.
describe("PanouMembri — retrimiterea invitației și locurile", () => {
  it("„Retrimite” cheamă acțiunea pe invitația rândului și arată linkul NOU", async () => {
    retrimiteInvitatia.mockResolvedValue({
      ok: true,
      data: {
        id: INVITATIE,
        email: "nou@exemplu.ro",
        token: "token-nou",
        emailTrimis: true,
        retrimisa: true,
      },
    });
    randeaza();
    await apasa("Retrimite");
    expect(retrimiteInvitatia).toHaveBeenCalledWith({ invitationId: INVITATIE });
    expect(screen.getByText("http://localhost:3000/invitatie/token-nou")).toBeDefined();
    expect(
      screen.getAllByText("Link nou generat pentru nou@exemplu.ro; cel vechi nu mai funcționează.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Linkul se afișează o singură dată/)).toBeDefined();
  });

  it("refuzul retrimiterii se spune și nu afișează niciun link", async () => {
    retrimiteInvitatia.mockResolvedValue({
      ok: false,
      error: { code: "NEGASIT", message: "Invitația nu mai există sau a fost deja folosită." },
    });
    randeaza();
    await apasa("Retrimite");
    expect(
      screen.getAllByText("Invitația nu mai există sau a fost deja folosită.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/\/invitatie\//)).toBeNull();
  });

  it("locurile: folosite din plafon, cu invitațiile în așteptare numărate", () => {
    randeaza({ folosite: 6, limita: 10, ramase: 4, plin: false });
    expect(
      screen.getByText("6 din 10 locuri folosite (inclusiv 1 invitație în așteptare)."),
    ).toBeDefined();
  });

  it("locurile pline: spune ce e de făcut", () => {
    randeaza({ folosite: 10, limita: 10, ramase: 0, plin: true });
    expect(
      screen.getByText(
        "Toate locurile sunt ocupate: dezactivați un membru sau extindeți contractul.",
      ),
    ).toBeDefined();
  });
});
