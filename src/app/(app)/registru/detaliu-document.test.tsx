// src/app/(app)/registru/detaliu-document.test.tsx
//
// Conținutul panoului: rubricile art. 9 cu lipsurile spuse în cuvinte, și cele
// trei legături care fac registrul folosibil — spre document, spre angajat,
// spre dosarul din nomenclator.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/registru",
  useSearchParams: () => new URLSearchParams(),
}));

import type { DetaliuDocument as Detaliu } from "@/lib/queries/registru";

import { DetaliuDocument } from "./detaliu-document";

/** happy-dom ar încărca `src`-ul cadrului ca un browser; testul verifică marcajul. */
type FereastraHappyDom = Window & {
  happyDOM?: {
    settings?: {
      disableIframePageLoading?: boolean;
      handleDisabledFileLoadingAsSuccess?: boolean;
    };
  };
};
const setari = (globalThis.window as FereastraHappyDom).happyDOM?.settings;
if (setari !== undefined) {
  setari.disableIframePageLoading = true;
  setari.handleDisabledFileLoadingAsSuccess = true;
}

const ID = "11111111-1111-4111-8111-111111111111";
const ENT = "22222222-2222-4222-8222-222222222222";
const ANG = "33333333-3333-4333-8333-333333333333";
const CONEXAT = "44444444-4444-4444-8444-444444444444";

const detaliu = (
  peste: Partial<Detaliu> = {},
  document: Partial<Detaliu["document"]> = {},
): Detaliu => ({
  document: {
    id: ID,
    numar: 46,
    numarAfisat: "46/08.10.2026",
    dataInregistrare: "2026-10-08",
    sens: "intrare",
    tipDocument: "cerere_concediu",
    continutRezumat: "Cerere de concediu — Georgescu Ioana",
    numarDocumentEmitent: null,
    dataDocumentEmitent: null,
    emitent: "Georgescu Ioana",
    destinatar: null,
    compartiment: null,
    dataExpedierii: "2026-10-08",
    modRezolvare: "aprobata",
    numarFile: null,
    numarAnexe: null,
    conexatLa: CONEXAT,
    indicativDosar: "II.5",
    rezolvatLa: "2026-10-08T10:00:00Z",
    entitateTip: "leave_requests",
    entitateId: ENT,
    angajatId: ANG,
    inregistratRetroactiv: false,
    anulatLa: null,
    motivAnulare: null,
    punctLucruId: null,
    createdAt: "2026-10-08T09:00:00Z",
    ...document,
  },
  angajat: { id: ANG, nume: "Georgescu Ioana" },
  dosar: {
    indicativ: "II.5",
    continut: "Cereri de concediu, compensări și zile libere",
    termenPastrare: "5",
  },
  conexatLa: { id: CONEXAT, numarAfisat: "12/03.02.2026" },
  conexate: [],
  parinteId: null,
  ...peste,
});

const hrefDocument = (id: string) => `/registru?an=2026&doc=${id}`;

describe("DetaliuDocument", () => {
  it("arată numărul, sensul și tipul cu cuvintele lor, și rezolvarea etichetată", () => {
    render(<DetaliuDocument detaliu={detaliu()} hrefDocument={hrefDocument} />);
    expect(screen.getByText("46/08.10.2026")).toBeDefined();
    expect(screen.getByText("Intrare")).toBeDefined();
    expect(screen.getByText("Cerere de concediu")).toBeDefined();
    expect(screen.getByText("Aprobată")).toBeDefined();
    expect(screen.queryByText("aprobata")).toBeNull();
  });

  it("leagă angajatul, dosarul, documentul conexat și documentul-sursă", () => {
    render(<DetaliuDocument detaliu={detaliu()} hrefDocument={hrefDocument} />);
    expect(screen.getByRole("link", { name: /Georgescu Ioana/u }).getAttribute("href")).toBe(
      `/angajati/${ANG}`,
    );
    expect(screen.getByRole("link", { name: /II\.5/u }).getAttribute("href")).toBe(
      "/registru/nomenclator#dosar-II.5",
    );
    expect(screen.getByRole("link", { name: /12\/03\.02\.2026/u }).getAttribute("href")).toBe(
      `/registru?an=2026&doc=${CONEXAT}`,
    );
    const deschide = screen.getByRole("link", { name: "Deschide documentul" });
    expect(deschide.getAttribute("href")).toBe(`/concedii/${ENT}`);
    expect(deschide.getAttribute("target")).toBeNull();
  });

  it("documentul emis de aplicație: PDF în filă nouă, descărcare și previzualizare la cerere", () => {
    render(
      <DetaliuDocument
        detaliu={detaliu({}, { entitateTip: "hr_issued_documents", tipDocument: "nda" })}
        hrefDocument={hrefDocument}
      />,
    );
    const pdf = screen.getByRole("link", { name: "Deschide PDF-ul" });
    expect(pdf.getAttribute("href")).toBe(`/documente/${ENT}?format=pdf`);
    expect(pdf.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: /Descarcă PDF/u }).getAttribute("href")).toBe(
      `/documente/${ENT}?format=pdf&descarca=1`,
    );
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Previzualizează PDF/u }));
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe(
      `/documente/${ENT}?format=pdf`,
    );
  });

  it("lipsurile se spun cu cuvinte: fără ecran, fără salariat, neclasat, în lucru", () => {
    render(
      <DetaliuDocument
        detaliu={detaliu(
          { angajat: null, dosar: null, conexatLa: null },
          {
            entitateTip: "manual",
            entitateId: null,
            angajatId: null,
            indicativDosar: null,
            conexatLa: null,
            modRezolvare: null,
            dataExpedierii: null,
            rezolvatLa: null,
          },
        )}
        hrefDocument={hrefDocument}
      />,
    );
    expect(screen.getByText(/nu are ecran propriu/u)).toBeDefined();
    expect(screen.getByText(/nu e legat de un salariat/u)).toBeDefined();
    expect(screen.getByText(/neclasat în nomenclator/iu)).toBeDefined();
    expect(screen.getByText("În lucru")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Deschide documentul" })).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("rândul anulat spune că e anulat și de ce", () => {
    render(
      <DetaliuDocument
        detaliu={detaliu({}, { anulatLa: "2026-10-09T08:00:00Z", motivAnulare: "Cerere retrasă" })}
        hrefDocument={hrefDocument}
      />,
    );
    expect(screen.getByText("Anulat")).toBeDefined();
    expect(screen.getByText(/Cerere retrasă/u)).toBeDefined();
  });

  it("documentele conexate la acesta se listează cu link spre fiecare", () => {
    render(
      <DetaliuDocument
        detaliu={detaliu({
          conexate: [
            {
              id: "c1",
              numarAfisat: "50/09.10.2026",
              tipDocument: "document_personal",
              continutRezumat: "Răspuns",
            },
          ],
        })}
        hrefDocument={hrefDocument}
      />,
    );
    expect(screen.getByRole("link", { name: /50\/09\.10\.2026/u }).getAttribute("href")).toBe(
      "/registru?an=2026&doc=c1",
    );
  });
});
