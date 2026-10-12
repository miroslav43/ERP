// src/app/(app)/angajati/[id]/invitatie-angajat.test.tsx
//
// Invitația se emitea la un singur clic, iar data expirării se formata în
// fusul serverului — „15.10” pentru un link valabil până pe „16.10 00:05” ora
// României (QA oct 2026: HR-034). Caseta spune DINAINTE pe ce adresă pleacă
// e-mailul sau că fișa n-are una și se va tipări o foaie.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvitatieAngajat } from "./invitatie-angajat";

const { invitaAngajatul } = vi.hoisted(() => ({ invitaAngajatul: vi.fn() }));

vi.mock("@/app/(app)/angajati/actions", () => ({ invitaAngajatul }));

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

const EMPLOYEE_ID = "55555555-5555-4555-8555-555555555555";

const dialogDeschis = (): HTMLDialogElement | null => document.querySelector("dialog[open]");

/** Textul casetei deschise — nu al întregii pagini, care are și rândul de ajutor. */
function textulCasetei(): string {
  const d = dialogDeschis();
  if (d === null) throw new Error("Nicio casetă deschisă.");
  return d.textContent ?? "";
}

async function apasa(nume: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nume }));
  });
}

beforeEach(() => {
  invitaAngajatul.mockReset();
});

describe("InvitatieAngajat — invitarea cere confirmare", () => {
  it("„Invită în aplicație” nu emite nimic până la confirmare; caseta spune adresa de e-mail", async () => {
    render(
      <InvitatieAngajat
        employeeId={EMPLOYEE_ID}
        numeAngajat="Ana Pop"
        numeFirma="Firma Test"
        pendinte={null}
        adresaPrevazuta={{ adresa: "ana@exemplu.ro", fel: "personala" }}
      />,
    );
    await apasa("Invită în aplicație");
    expect(invitaAngajatul).not.toHaveBeenCalled();
    expect(dialogDeschis()).not.toBeNull();
    expect(screen.getByText("Invitați Ana Pop în aplicație?")).toBeDefined();
    expect(textulCasetei()).toMatch(/e-mail .*ana@exemplu\.ro/u);
    expect(textulCasetei()).not.toMatch(/fișă de tipărit/u);
  });

  it("fără e-mail pe fișă, caseta anunță utilizatorul sintetic și fișa de tipărit", async () => {
    render(
      <InvitatieAngajat
        employeeId={EMPLOYEE_ID}
        numeAngajat="Ana Pop"
        numeFirma="Firma Test"
        pendinte={null}
        adresaPrevazuta={{ adresa: "marca-0007@firma-test.intern", fel: "sintetica" }}
      />,
    );
    await apasa("Invită în aplicație");
    expect(textulCasetei()).toMatch(/marca-0007@firma-test\.intern/u);
    expect(textulCasetei()).toMatch(/fișă de tipărit/u);
  });

  it("confirmarea cheamă `invitaAngajatul({ id })` o singură dată", async () => {
    invitaAngajatul.mockResolvedValue({
      ok: true,
      data: {
        adresa: "ana@exemplu.ro",
        fel: "personala",
        emailTrimis: true,
        retrimisa: false,
        link: "http://localhost:3000/invitatie/abc",
        qr: "<svg></svg>",
        expiraLa: "2026-10-19T09:00:00Z",
      },
    });
    render(
      <InvitatieAngajat
        employeeId={EMPLOYEE_ID}
        numeAngajat="Ana Pop"
        numeFirma="Firma Test"
        pendinte={null}
        adresaPrevazuta={{ adresa: "ana@exemplu.ro", fel: "personala" }}
      />,
    );
    await apasa("Invită în aplicație");
    await apasa("Invită");
    expect(invitaAngajatul).toHaveBeenCalledTimes(1);
    expect(invitaAngajatul).toHaveBeenCalledWith({ id: EMPLOYEE_ID });
    expect(screen.getByText("Invitația a plecat")).toBeDefined();
  });

  it("cu invitație pendinte: „Retrimite invitația”, linkul vechi moare, expirarea e în ora României", async () => {
    render(
      <InvitatieAngajat
        employeeId={EMPLOYEE_ID}
        numeAngajat="Ana Pop"
        numeFirma="Firma Test"
        // 15.10 21:05 UTC = 16.10 00:05 ora României.
        pendinte={{ adresa: "ana@exemplu.ro", expiraLa: "2026-10-15T21:05:00Z" }}
        adresaPrevazuta={{ adresa: "ana@exemplu.ro", fel: "personala" }}
      />,
    );
    expect(document.body.textContent).toMatch(/16\.10\.2026/u);
    expect(document.body.textContent).not.toMatch(/15\.10\.2026/u);
    await apasa("Retrimite invitația");
    expect(invitaAngajatul).not.toHaveBeenCalled();
    expect(screen.getByText("Retrimiteți invitația?")).toBeDefined();
    expect(textulCasetei()).toMatch(/nu va mai funcționa/u);
  });
});
