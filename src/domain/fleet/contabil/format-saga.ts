// src/domain/fleet/contabil/format-saga.ts
//
// Fișierele pentru Saga C, versiunea desktop (F12g). Saga WEB nu are importul.
//
//  1. `F_<CUI furnizor>_<nr>_<ZZ.LL.AAAA>.xml` — câte o intrare „bon de casă cu
//     cod fiscal” (`<FacturaTip>C</FacturaTip>`) per document CU CUI de
//     furnizor. `<ClientCIF>` = CIF-ul firmei, ca Saga s-o pună în „Intrări”.
//     Limitarea la 50% o aplică Saga, prin `<TipDeducere>N50</TipDeducere>`.
//  2. `P_<ZZ.LL.AAAA>.xml` — plățile acelor bonuri, pe contul de decontare
//     (implicita I-g9): fără ele, fiecare stație ar rămâne cu 401 deschis.
//  3. `NC_<de-la>_<până-la>.dbf` — articolele contabile ale restului.
//
// ── SURSE ───────────────────────────────────────────────────────────────────
// Manualul Saga C, „Import date” (https://manual.sagasoft.ro/sagac/topic-76-import-date.html,
// recitit pe 22 oct 2026): structura XML a facturilor și a plăților, numele
// fișierelor, „dacă fișierele … sunt arhivate, trebuie să le dezarhivați”.
// Structura DBF: copia manualului Saga C 3.0 de pe askit.ro, 22.04.2020
// (documentație secundară; importul DBF după actualizarea 598 e NECONFIRMAT, R10).
// Verificat pe documentație, NEÎNCERCAT într-un import real (decizia B4).
//
// ── PRESUPUNERI ⚠ (de reglat la acceptanță, D7) ─────────────────────────────
// Formatul datei din nume și din `<FacturaData>` (`FORMAT_DATA_SAGA`); al cui e
// „cod-fiscal” din numele fișierului (aici: al furnizorului); potrivirea lui
// `<ClientCIF>` fără `RO`; dacă Saga recalculează `Valoare = Pret × Cantitate`
// (prețul e rotunjit la 4 zecimale, deci se poate muta un ban); dacă
// sincronizarea „Nr.+data” ține cont de furnizor.
import type { DateString } from "@/lib/format/date";
import type { CampDbf, ValoareDbf } from "@/lib/unelte/dbf";

import type { LinieInclusa, RezultatExport } from "./articole";
import { numarDocument } from "./articole";
import type { ConfigurareExport, FirmaExport } from "./configurare";
import { dataRo, randuri, sumaCuPunct } from "./csv";
import { ETICHETE_CATEGORIE_CONTABILA } from "./linii";
import { inAscii } from "./text-ascii";

/** ⚠ Data din numele fișierelor și din `<FacturaData>`: presupusă `ZZ.LL.AAAA`. */
export const FORMAT_DATA_SAGA = (zi: DateString): string => dataRo(zi);

/** Câmpurile DBF ale articolelor contabile (askit.ro, 2020, ⚠). */
export const CAMPURI_NC: readonly CampDbf[] = [
  { nume: "NDP", tip: "C", lungime: 16 },
  { nume: "CONT_D", tip: "C", lungime: 20 },
  { nume: "CONT_C", tip: "C", lungime: 20 },
  { nume: "SUMA", tip: "N", lungime: 15, zecimale: 2 },
  { nume: "COD_VALUTA", tip: "C", lungime: 3 },
  { nume: "CURS", tip: "N", lungime: 15, zecimale: 4 },
  { nume: "SUMA_VAL", tip: "N", lungime: 14, zecimale: 2 },
  { nume: "DATA", tip: "D" },
  { nume: "EXPLICATIE", tip: "C", lungime: 48 },
  { nume: "GRUPA", tip: "C", lungime: 16 },
];

export interface FisierText {
  readonly nume: string;
  readonly continut: string;
}

export function numeFisierNc(deLa: DateString, panaLa: DateString): string {
  return `NC_${FORMAT_DATA_SAGA(deLa)}_${FORMAT_DATA_SAGA(panaLa)}.dbf`;
}

/** Escaparea XML pe `& < > " '`, după transliterarea în ASCII (L7). */
export function textXml(text: string): string {
  return inAscii(text)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

/** Doar caracterele sigure într-un nume de fișier (Windows inclus). */
function bucataNume(text: string): string {
  return inAscii(text).replace(/[^A-Za-z0-9.-]+/gu, "-");
}

/** Ce merge în XML (intrare cu furnizor) și ce merge în DBF (articole). */
export function imparteSaga(
  rezultat: RezultatExport,
  firma: FirmaExport,
): { readonly xml: readonly LinieInclusa[]; readonly dbf: readonly LinieInclusa[] } {
  const xml: LinieInclusa[] = [];
  const dbf: LinieInclusa[] = [];
  for (const inclusa of rezultat.incluse) {
    // Firma neplătitoare: manualul nu spune cum tratează Saga TVA-ul unei
    // intrări la o firmă neplătitoare ⚠, deci totul merge în articole.
    if (firma.platitorTva && inclusa.linie.cuiFurnizor !== null && inclusa.regim !== null) {
      xml.push(inclusa);
    } else dbf.push(inclusa);
  }
  return { xml, dbf };
}

function cantitate(inclusa: LinieInclusa): { um: string; cantitate: number } {
  const { linie } = inclusa;
  if (linie.categorie === "combustibil" && linie.litri !== null && linie.litri > 0) {
    return { um: "L", cantitate: linie.litri };
  }
  return { um: "buc", cantitate: 1 };
}

function facturaXml(inclusa: LinieInclusa, firma: FirmaExport, cont: string): string {
  const { linie } = inclusa;
  const data = FORMAT_DATA_SAGA(linie.data);
  const { um, cantitate: cant } = cantitate(inclusa);
  const pret = (inclusa.bazaBani / 100 / cant).toFixed(4);
  const tva = inclusa.tvaDeductibilBani + inclusa.tvaNedeductibilBani;
  const descriere = `${linie.detaliu ?? ETICHETE_CATEGORIE_CONTABILA[linie.categorie]} ${linie.vehicul.nr ?? "vehicul necunoscut"}`;
  const linii = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Facturi>",
    "  <Factura>",
    "    <Antet>",
    `      <FurnizorNume>${textXml(linie.furnizor ?? linie.cuiFurnizor ?? "")}</FurnizorNume>`,
    `      <FurnizorCIF>${textXml(linie.cuiFurnizor ?? "")}</FurnizorCIF>`,
    `      <ClientNume>${textXml(firma.denumire)}</ClientNume>`,
    `      <ClientCIF>${textXml(firma.cui)}</ClientCIF>`,
    `      <FacturaNumar>${textXml(numarDocument(linie))}</FacturaNumar>`,
    `      <FacturaData>${data}</FacturaData>`,
    `      <FacturaScadenta>${data}</FacturaScadenta>`,
    "      <FacturaTaxareInversa>Nu</FacturaTaxareInversa>",
    "      <FacturaTVAIncasare>Nu</FacturaTVAIncasare>",
    "      <FacturaTip>C</FacturaTip>",
    "    </Antet>",
    "    <Detalii>",
    "      <Continut>",
    "        <Linie>",
    "          <LinieNrCrt>1</LinieNrCrt>",
    `          <Descriere>${textXml(descriere)}</Descriere>`,
    `          <UM>${um}</UM>`,
    `          <Cantitate>${cant.toFixed(2)}</Cantitate>`,
    `          <Pret>${pret}</Pret>`,
    `          <Valoare>${sumaCuPunct(inclusa.bazaBani)}</Valoare>`,
    `          <ProcTVA>${String(inclusa.cotaProcent ?? 0)}</ProcTVA>`,
    `          <TVA>${sumaCuPunct(tva)}</TVA>`,
    `          <Cont>${textXml(cont)}</Cont>`,
  ];
  if (inclusa.regim === "limitat_50") linii.push("          <TipDeducere>N50</TipDeducere>");
  linii.push(
    "        </Linie>",
    "      </Continut>",
    "    </Detalii>",
    `    <FacturaID>${linie.id}</FacturaID>`,
    "  </Factura>",
    "</Facturi>",
  );
  return randuri(linii);
}

export interface RezultatSagaXml {
  readonly facturi: readonly FisierText[];
  readonly plati: readonly FisierText[];
  readonly avertismente: readonly string[];
}

/** Intrările XML (câte una per fișier) și plățile lor, grupate pe zi. */
export function facturiSagaXml(
  incluse: readonly LinieInclusa[],
  firma: FirmaExport,
  configurare: ConfigurareExport,
): RezultatSagaXml {
  const facturi: FisierText[] = [];
  const avertismente: string[] = [];
  const folosite = new Map<string, number>();
  for (const inclusa of incluse) {
    const { linie } = inclusa;
    const baza = `F_${bucataNume(linie.cuiFurnizor ?? "")}_${bucataNume(numarDocument(linie))}_${FORMAT_DATA_SAGA(linie.data)}`;
    const cheie = baza.toLowerCase();
    const k = (folosite.get(cheie) ?? 0) + 1;
    folosite.set(cheie, k);
    if (k === 2) {
      avertismente.push(
        `Două bonuri cu același CUI, număr și dată (${baza}.xml): al doilea primește sufixul _2. Saga le poate lua drept dublură la sincronizarea „Nr.+data”.`,
      );
    }
    facturi.push({
      nume: k === 1 ? `${baza}.xml` : `${baza}_${String(k)}.xml`,
      continut: facturaXml(inclusa, firma, configurare.conturi[linie.categorie]),
    });
  }

  if (incluse.length === 0) return { facturi, plati: [], avertismente };
  if (!configurare.contDecontare.startsWith("5")) {
    avertismente.push(
      `Contul de decontare ${configurare.contDecontare} nu e din clasa 5: plățile bonurilor din XML nu s-au generat, iar furnizorii rămân cu sold până la plata înregistrată de mână.`,
    );
    return { facturi, plati: [], avertismente };
  }

  const peZile = new Map<string, LinieInclusa[]>();
  for (const inclusa of incluse) {
    const zi = peZile.get(inclusa.linie.data) ?? [];
    zi.push(inclusa);
    peZile.set(inclusa.linie.data, zi);
  }
  const plati: FisierText[] = [];
  for (const [zi, inZi] of [...peZile].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const linii = ['<?xml version="1.0" encoding="UTF-8"?>', "<Plati>"];
    for (const { linie } of inZi) {
      const numar = numarDocument(linie);
      linii.push(
        "  <Linie>",
        `    <Data>${FORMAT_DATA_SAGA(zi)}</Data>`,
        `    <Numar>${textXml(numar)}</Numar>`,
        `    <Suma>${sumaCuPunct(linie.totalBani)}</Suma>`,
        `    <Cont>${textXml(configurare.contDecontare)}</Cont>`,
        `    <Explicatie>${textXml(`Plata bon ${numar} ${linie.furnizor ?? ""}`)}</Explicatie>`,
        `    <FacturaID>${linie.id}</FacturaID>`,
        `    <FacturaNumar>${textXml(numar)}</FacturaNumar>`,
        `    <CodFiscal>${textXml(linie.cuiFurnizor ?? "")}</CodFiscal>`,
        "  </Linie>",
      );
    }
    linii.push("</Plati>");
    plati.push({ nume: `P_${FORMAT_DATA_SAGA(zi)}.xml`, continut: randuri(linii) });
  }
  return { facturi, plati, avertismente };
}

/** Rândurile DBF ale articolelor: câte unul per articol contabil. */
export function articoleSagaDbf(incluse: readonly LinieInclusa[]): ValoareDbf[][] {
  const rezultat: ValoareDbf[][] = [];
  for (const { articole } of incluse) {
    for (const a of articole) {
      rezultat.push([
        a.numarDocument,
        a.contDebit,
        a.contCredit,
        a.sumaBani / 100,
        null,
        0,
        0,
        a.data,
        inAscii(a.explicatie, 48),
        null,
      ]);
    }
  }
  return rezultat;
}
