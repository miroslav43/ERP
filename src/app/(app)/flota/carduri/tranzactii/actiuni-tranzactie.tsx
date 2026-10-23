"use client";

import { Ban, Link2, RefreshCw, RotateCcw, Undo2 } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { CandidatAlimentare } from "@/lib/queries/fleet-carduri";

import { ButonConfirmat } from "../buton-confirmat";
import { anuleazaImport } from "../import/actions";
import {
  ignoraTranzactie,
  leagaTranzactie,
  reactiveazaTranzactie,
  repotrivesteTranzactii,
} from "./actions";

const ORA = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  hour: "2-digit",
  minute: "2-digit",
});
const LITRI = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

/** Legarea manuală de o alimentare declarată pe foaia aceluiași vehicul, din aceeași zi. */
export function DialogLeaga({
  tranzactieId,
  descriere,
  candidati,
}: Readonly<{
  tranzactieId: string;
  descriere: string;
  candidati: readonly CandidatAlimentare[];
}>): ReactElement {
  async function trimite(date: FormData) {
    return leagaTranzactie({
      id: tranzactieId,
      fuel_entry_id: String(date.get("fuel_entry_id") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: <Link2 aria-hidden="true" className="size-4" />,
        marime: "iconita",
        varianta: "secundar",
        "aria-label": `Leagă tranzacția ${descriere} de o alimentare`,
      }}
      titlu="Leagă de o alimentare declarată"
      descriere={`Tranzacția ${descriere}. Se pot alege doar alimentările nelegate de pe foaia aceluiași vehicul, din aceeași zi.`}
      actiune={trimite}
      mesajReusita="Tranzacția a fost legată de alimentare."
      etichetaTrimite="Leagă"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <Camp
          nume="fuel_entry_id"
          id={idc("fuel_entry_id")}
          eticheta="Alimentarea de pe foaie"
          fel="select"
          obligatoriu
          erori={stare.erori["fuel_entry_id"] ?? []}
        >
          {(a) => (
            <select {...a} defaultValue={stare.valoriTrimise["fuel_entry_id"] ?? ""}>
              <option value="" disabled>
                Alegeți alimentarea
              </option>
              {candidati.map((c) => (
                <option key={c.id} value={c.id}>
                  {ORA.format(new Date(c.alimentatLa))} — {LITRI.format(c.litri)} L,{" "}
                  {LITRI.format(c.cost)} lei
                  {c.numarBon === null ? "" : `, bon ${c.numarBon}`}
                </option>
              ))}
            </select>
          )}
        </Camp>
      )}
    </FormularDialog>
  );
}

/** Ignorarea motivată: nota e obligatorie, iar baza o cere și ea. */
export function DialogIgnora({
  tranzactieId,
  descriere,
}: Readonly<{ tranzactieId: string; descriere: string }>): ReactElement {
  async function trimite(date: FormData) {
    return ignoraTranzactie({
      id: tranzactieId,
      nota: String(date.get("nota") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: <Ban aria-hidden="true" className="size-4" />,
        marime: "iconita",
        varianta: "secundar",
        "aria-label": `Ignoră tranzacția ${descriere}`,
      }}
      titlu="Ignoră tranzacția"
      descriere={`Tranzacția ${descriere} iese din nepotriviri. Scrieți de ce: nota rămâne pe tranzacție, pentru cine verifică extrasul mai târziu.`}
      actiune={trimite}
      mesajReusita="Tranzacția a fost ignorată."
      etichetaTrimite="Ignoră"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <Camp
          nume="nota"
          id={idc("nota")}
          eticheta="Motivul"
          fel="textarea"
          obligatoriu
          ajutor="De exemplu: „Alimentare decontată separat” sau „Card folosit pentru generator”."
          erori={stare.erori["nota"] ?? []}
        >
          {(a) => (
            <textarea
              {...a}
              rows={3}
              maxLength={1000}
              defaultValue={stare.valoriTrimise["nota"] ?? ""}
            />
          )}
        </Camp>
      )}
    </FormularDialog>
  );
}

/**
 * „Reactivează”: tranzacția ignorată din greșeală revine în potrivire. Nota
 * ignorării se golește, iar tranzacția se repotrivește pe loc.
 */
export function ButonReactiveaza({
  tranzactieId,
  descriere,
}: Readonly<{ tranzactieId: string; descriere: string }>): ReactElement {
  return (
    <ButonConfirmat
      pictograma={<RotateCcw aria-hidden="true" className="size-4" />}
      ariaLabel={`Reactivează tranzacția ${descriere}`}
      titlu="Reactivați tranzacția?"
      consecinta={`Tranzacția ${descriere} revine între cele de verificat și se compară din nou cu foile și alimentările de acum. Nota cu motivul ignorării se șterge.`}
      etichetaConfirmare="Reactivează"
      mesajReusita={(r) =>
        r.stare === "ignorata"
          ? "Tranzacția e un storno din extras și rămâne ignorată."
          : "Tranzacția a fost reactivată și potrivită din nou."
      }
      executa={() => reactiveazaTranzactie({ id: tranzactieId })}
    />
  );
}

/** Recalcularea potrivirilor lunii, după ce șoferii și-au completat foile. */
export function ButonRepotriveste({
  luna,
  eticheta,
}: Readonly<{ luna: string; eticheta: string }>): ReactElement {
  return (
    <ButonConfirmat
      eticheta="Repotrivește luna"
      pictograma={<RefreshCw aria-hidden="true" className="size-4" />}
      titlu={`Repotriviți tranzacțiile din ${eticheta}?`}
      consecinta="Tranzacțiile nepotrivite se compară din nou cu foile și alimentările de acum. Cele potrivite și cele ignorate rămân neatinse, inclusiv legăturile făcute de mână."
      etichetaConfirmare="Repotrivește"
      mesajReusita={(r) =>
        r.schimbate === 0
          ? `Am verificat ${String(r.verificate)} tranzacții: nimic nou de potrivit.`
          : `Am verificat ${String(r.verificate)} tranzacții; ${String(r.schimbate)} și-au schimbat starea.`
      }
      executa={() => repotrivesteTranzactii({ luna })}
    />
  );
}

/** Anularea unui import greșit: tranzacțiile lui, apoi lotul. Reimportul corectat trece după. */
export function ButonAnuleazaImport({
  importId,
  fisier,
}: Readonly<{ importId: string; fisier: string }>): ReactElement {
  return (
    <ButonConfirmat
      pictograma={<Undo2 aria-hidden="true" className="size-4" />}
      ariaLabel={`Anulează importul ${fisier}`}
      titlu={`Anulați importul „${fisier}”?`}
      consecinta="Toate tranzacțiile acestui import se șterg (logic), iar legăturile lor cu alimentările se desfac. Alimentările de pe foi nu se ating. După anulare, puteți importa din nou fișierul corectat."
      etichetaConfirmare="Anulează importul"
      distructiv
      mesajReusita={(r) => `Importul a fost anulat (${String(r.tranzactii)} tranzacții).`}
      executa={() => anuleazaImport({ id: importId })}
    />
  );
}
