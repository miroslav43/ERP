// src/lib/pdf/dosar-control.test.ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";

import { genereazaDosarControl, type RandDosarControl } from "./dosar-control";

/**
 * Dosarul de control (M7) ca PDF. Se apără: diacriticele cu virgulă și „⚠” din
 * temeiurile neverificate trec prin fontul încorporat fără să arunce; listele
 * goale dau un document valid; o listă lungă se paginează, nu iese din pagină.
 */
const ORGANIZATIE: AntetOrganizatie = {
  denumire: "Exemplu Mentenanță S.R.L.",
  formaJuridica: "S.R.L.",
  cui: "RO12345678",
  regCom: "J12/345/2020",
  adresa: "Str. Exemplu 1, Cluj-Napoca, Cluj",
  capitalSocial: 200,
  capitalVarsat: null,
  sistemDualist: false,
  telefon: null,
  email: null,
  pozitie: "antet",
  sigla: null,
};

const rand = (p: Partial<RandDosarControl> = {}): RandDosarControl => ({
  echipament: "MAC-1 — Macara capră, hala de producție",
  ce: "Autorizație ISCIR",
  categorie: "Macara",
  temei: "PT R1-2010, art. 51 alin. (1): următoarea verificare tehnică periodică la maximum 2 ani",
  numar: "ISCIR-77",
  emisa: "2025-10-01",
  valabilaPana: "2027-10-01",
  urmatoareaVerificare: "2026-10-20",
  stare: "Expiră curând",
  rosu: false,
  observatii: "Emitent: ISCIR · Condiții: sarcina maximă 5 t, exploatare doar în hală",
  ...p,
});

const parametri = (
  autorizatii: readonly RandDosarControl[],
  verificari: readonly RandDosarControl[],
): Parameters<typeof genereazaDosarControl>[0] => ({
  organizatie: ORGANIZATIE,
  azi: "2026-10-12",
  autorizatii,
  verificari,
  rezumat: "1 autorizație ISCIR · 1 verificare legală · 1 de rezolvat",
  intocmitDe: "Ana Ștefănescu",
  generatLa: "12.10.2026 09:30",
});

describe("genereazaDosarControl", () => {
  it("scrie diacriticele și ⚠ fără să arunce, cu titlul în metadate", async () => {
    const octeti = await genereazaDosarControl(
      parametri(
        [
          rand({
            stare: "Suspendată",
            rosu: true,
            observatii: "Suspendată la 2026-10-05: frână uzată",
          }),
        ],
        [
          rand({
            ce: "Verificare legală: PRAM anual",
            categorie: "PRAM — măsurarea prizei de pământ",
            temei: "⚠ Normativul I7/2011 și reglementările ANRE (de confirmat)",
            numar: "",
            valabilaPana: "",
          }),
        ],
      ),
    );
    const doc = await PDFDocument.load(octeti);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Dosar de control — verificări legale, 12.10.2026");
  });

  it("listele goale dau tot un document valid", async () => {
    const doc = await PDFDocument.load(await genereazaDosarControl(parametri([], [])));
    expect(doc.getPageCount()).toBe(1);
  });

  it("o listă lungă trece pe pagini noi", async () => {
    const multe = Array.from({ length: 60 }, (_, i) => rand({ numar: `ISCIR-${String(i)}` }));
    const doc = await PDFDocument.load(await genereazaDosarControl(parametri(multe, [])));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });
});
