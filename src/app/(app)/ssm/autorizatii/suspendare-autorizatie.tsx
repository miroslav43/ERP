"use client";

import { useState, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";

import { schimbaSuspendareaAutorizatiei } from "../actions";
import { DialogPortat } from "../dialog-portat";
import { useActiuneRand } from "../use-actiune-rand";

/**
 * Suspendarea unei autorizații nominale și ridicarea ei.
 *
 * ── DE CE E O FUNDĂTURĂ ÎNCHISĂ, NU O FUNCȚIE NOUĂ ────────────────────────
 * `personnel_authorizations.suspendata_la` se citea deja și se randa deja în
 * listă („Suspendată 12.05.2026"), dar formularul de adăugare trimite mereu
 * `null` și nicio altă acțiune nu atingea coloana. Starea era vizibilă și
 * imposibil de atins.
 *
 * Miza nu e cosmetică: `app.iscir_valid` (0011) cere `a.suspendata_la is null`
 * ca să accepte desemnarea unui angajat ca responsabil pe un echipament ISCIR.
 * Cât timp coloana nu se putea scrie, interdicția de lucru nu se putea pune din
 * aplicație — doar din SQL.
 *
 * ── DE CE UN DIALOG CU DATĂ, NU UN BUTON SIMPLU ───────────────────────────
 * Suspendarea se decide de obicei într-o zi și se operează în alta. Data e
 * `date` în bază, deci „azi" implicit ar fi scris tăcut altceva decât realitatea
 * din decizie. Ridicarea, în schimb, e o singură apăsare: `null` n-are dată.
 */
export function SuspendareAutorizatie({
  id,
  suspendataLa,
  azi,
}: {
  readonly id: string;
  readonly suspendataLa: string | null;
  /** Ziua curentă la București, calculată pe server — browserul poate fi pe alt fus. */
  readonly azi: string;
}): ReactElement {
  const [deschis, setDeschis] = useState(false);
  const [data, setData] = useState(suspendataLa ?? azi);
  const { inCurs, ruleaza } = useActiuneRand();

  function inchide(): void {
    setDeschis(false);
  }

  if (suspendataLa !== null) {
    return (
      <Buton
        varianta="tertiar"
        inCurs={inCurs}
        textInCurs="Se salvează…"
        onClick={() => {
          ruleaza(
            async () => await schimbaSuspendareaAutorizatiei({ id, suspendata_la: null }),
            "Suspendarea a fost ridicată — autorizația e din nou activă.",
          );
        }}
      >
        Ridică suspendarea
      </Buton>
    );
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        onClick={() => {
          setData(azi);
          setDeschis(true);
        }}
      >
        Suspendă
      </Buton>

      <DialogPortat
        deschis={deschis}
        laInchidere={inchide}
        titlu="Suspendarea autorizației"
        descriere="Cât timp e suspendată, autorizația nu mai poate susține nicio desemnare pe echipamente ISCIR. Se poate ridica oricând."
        marime="mic"
        subsol={
          <>
            <Buton varianta="secundar" disabled={inCurs} onClick={inchide}>
              Renunță
            </Buton>
            <Buton
              varianta="distructiv"
              inCurs={inCurs}
              textInCurs="Se salvează…"
              disabled={data === ""}
              onClick={() => {
                ruleaza(
                  async () => await schimbaSuspendareaAutorizatiei({ id, suspendata_la: data }),
                  "Autorizația a fost suspendată.",
                  inchide,
                );
              }}
            >
              Suspendă autorizația
            </Buton>
          </>
        }
      >
        <Camp nume="suspendata_la" eticheta="Suspendată începând de la" obligatoriu>
          {(a) => (
            <input
              {...a}
              type="date"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
              }}
            />
          )}
        </Camp>
      </DialogPortat>
    </>
  );
}
