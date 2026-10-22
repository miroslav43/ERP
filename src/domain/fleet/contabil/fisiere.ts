// src/domain/fleet/contabil/fisiere.ts
//
// Ce iese, pe fiecare format al exportului contabil al flotei (F12g): un CSV
// sau lista de fișiere a unei arhive ZIP. Pur: arhiva o face ruta, cu `jszip`.
//
// Arhivele Saga și WinMentor sunt doar ambalajul descărcării. Saga caută
// fișierele după nume și NU citește din arhivă („dacă fișierele … sunt
// arhivate, trebuie să le dezarhivați”), de aceea fiecare arhivă are și un
// `CITESTE-MA.txt` cu pașii, plus `de-verificat.csv` cu ce n-a intrat în note.
import type { DateString } from "@/lib/format/date";
import { scrieDbf } from "@/lib/unelte/dbf";

import type { RezultatExport } from "./articole";
import type { ConfigurareExport, FirmaExport } from "./configurare";
import { randuri, type OptiuniCsv } from "./csv";
import { articoleCsv, deVerificatCsv, jurnalCsv } from "./format-jurnal";
import {
  articoleSagaDbf,
  CAMPURI_NC,
  facturiSagaXml,
  imparteSaga,
  numeFisierNc,
} from "./format-saga";
import { NUME_NOTE_WM, NUME_PARTENERI_WM, noteWinMentor } from "./format-winmentor";
import type { FormatExport } from "./formate";

export interface FisierExport {
  readonly nume: string;
  readonly continut: string | Uint8Array;
}

export type IesireExport =
  | { readonly fel: "csv"; readonly nume: string; readonly continut: string }
  | { readonly fel: "zip"; readonly nume: string; readonly fisiere: readonly FisierExport[] };

export interface ParametriIesire {
  /** `AAAA-LL`. */
  readonly luna: string;
  readonly deLa: DateString;
  readonly panaLa: DateString;
  /** Ziua generării: data de actualizare din antetul DBF. */
  readonly azi: DateString;
  readonly configurare: ConfigurareExport;
  readonly firma: FirmaExport;
  readonly csv: OptiuniCsv;
  readonly partenerDupaCui: boolean;
}

/** Eticheta obligatorie a formatelor de import (decizia B4). */
export const ETICHETA_NEINCERCAT =
  "Verificat pe documentatia producatorului, NEINCERCAT inca intr-un import real.";

function citesteMa(program: "saga" | "winmentor", luna: string): string {
  const comune = [
    `Export pentru contabilitate - parc auto, luna ${luna} (Administrativo).`,
    "",
    ETICHETA_NEINCERCAT,
    "Fisierele sunt o PROPUNERE: verificati conturile la primul import, intr-o baza de test.",
    "Dezarhivati arhiva inainte de import: programul cauta fisierele dupa nume.",
    "de-verificat.csv: costurile care NU au intrat in fisierele de import, cu motivul, plus avertismentele.",
    "",
  ];
  const specifice =
    program === "saga"
      ? [
          "Saga C (versiunea desktop), Import date din fisiere XML:",
          "  F_<CUI>_<numar>_<data>.xml  - bonurile cu CUI de furnizor, ca intrari (bon de casa cu cod fiscal).",
          "  P_<data>.xml                - platile acestor bonuri, pe contul de decontare.",
          "  NC_<de-la>_<pana-la>.dbf    - articolele contabile ale celorlalte costuri.",
          "Sincronizarea dupa Nr.+data evita dublarea la un al doilea import al aceleiasi luni.",
        ]
      : [
          "WinMentor, Import date din alte aplicatii:",
          `  ${NUME_NOTE_WM}  - notele contabile (TipDocument=NOTA CONTABILA).`,
          `  ${NUME_PARTENERI_WM}       - partenerii noi (doar daca vreo nota are partener).`,
          "Identificarea partenerilor dupa cod fiscal trebuie setata la fel in Constante generale.",
        ];
  return randuri([...comune, ...specifice]);
}

export function iesireExport(
  format: FormatExport,
  rezultat: RezultatExport,
  p: ParametriIesire,
): IesireExport {
  if (format === "jurnal_csv") {
    return {
      fel: "csv",
      nume: `jurnal-costuri-flota-${p.luna}.csv`,
      continut: jurnalCsv(rezultat, p.configurare, p.csv),
    };
  }
  if (format === "articole_csv") {
    return {
      fel: "csv",
      nume: `articole-contabile-flota-${p.luna}.csv`,
      continut: articoleCsv(rezultat, p.csv),
    };
  }

  const [an = 0, lunaNr = 0] = p.luna.split("-").map(Number);
  if (format === "winmentor") {
    const wm = noteWinMentor(rezultat, { an, luna: lunaNr, partenerDupaCui: p.partenerDupaCui });
    const fisiere: FisierExport[] = [{ nume: NUME_NOTE_WM, continut: wm.note }];
    if (wm.parteneri !== null) fisiere.push({ nume: NUME_PARTENERI_WM, continut: wm.parteneri });
    fisiere.push(
      { nume: "de-verificat.csv", continut: deVerificatCsv(rezultat, p.csv) },
      { nume: "CITESTE-MA.txt", continut: citesteMa("winmentor", p.luna) },
    );
    return { fel: "zip", nume: `winmentor-flota-${p.luna}.zip`, fisiere };
  }

  const { xml, dbf } = imparteSaga(rezultat, p.firma);
  const saga = facturiSagaXml(xml, p.firma, p.configurare);
  const avertismente = [...rezultat.avertismente];
  if (!p.firma.platitorTva) {
    avertismente.push(
      "Firma nu e plătitoare de TVA: toate costurile merg în articole contabile (DBF), nu ca intrări XML.",
    );
  }
  avertismente.push(...saga.avertismente);
  const fisiere: FisierExport[] = [...saga.facturi, ...saga.plati];
  const randuriDbf = articoleSagaDbf(dbf);
  if (randuriDbf.length > 0) {
    fisiere.push({
      nume: numeFisierNc(p.deLa, p.panaLa),
      continut: scrieDbf(CAMPURI_NC, randuriDbf, p.azi),
    });
  }
  fisiere.push(
    { nume: "de-verificat.csv", continut: deVerificatCsv({ ...rezultat, avertismente }, p.csv) },
    { nume: "CITESTE-MA.txt", continut: citesteMa("saga", p.luna) },
  );
  return { fel: "zip", nume: `saga-flota-${p.luna}.zip`, fisiere };
}
