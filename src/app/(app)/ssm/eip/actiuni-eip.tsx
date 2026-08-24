"use client";

import { useState, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { formatDate } from "@/lib/format/date";

import { confirmaPrimireaEip, marcheazaEipReturnat } from "../actions";
import { DialogPortat } from "../dialog-portat";
import { useActiuneRand } from "../use-actiune-rand";

/**
 * Cele două acțiuni de rând ale registrului EIP.
 *
 * ── DE CE EXISTĂ FIȘIERUL ─────────────────────────────────────────────────
 * `ppe_issuances.returnat_la` și `ppe_issuances.semnatura_confirmata` erau
 * citite de `eip()` (intră amândouă în `COLOANE_EIP`) și randate în listă, dar
 * nicio acțiune nu le scria: `ssm.ppe.issue` trimite `semnatura_confirmata:
 * false` și nu atinge `returnat_la`. Coloana „Returnat" arăta „—" pe TOATE
 * rândurile, la infinit, iar confirmarea de primire — semnătura de pe bonul de
 * EIP, singura dovadă că echipamentul a ajuns la om — nu putea deveni
 * niciodată adevărată.
 *
 * ── DE CE ACȚIUNE DE RÂND, NU O PAGINĂ DE EDITARE ─────────────────────────
 * Amândouă sunt evenimente de o singură dată, la o singură coloană, făcute de
 * obicei pentru mai multe rânduri unul după altul (schimbul returnează la
 * sfârșitul turei). O navigare per rând ar fi costat două ecrane pentru o bifă.
 *
 * ── DE CE SE POT DA ÎNAPOI ────────────────────────────────────────────────
 * Returnarea cere data reală de pe bon, nu „azi" implicit, și se poate șterge;
 * confirmarea se poate retrage. O bifă pusă pe rândul greșit într-un registru
 * de protecția muncii nu se repară din SQL.
 */

export function ConfirmarePrimireEip({
  id,
  confirmata,
}: {
  readonly id: string;
  readonly confirmata: boolean;
}): ReactElement {
  const { inCurs, ruleaza } = useActiuneRand();

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge ton={confirmata ? "succes" : "ciorna"}>{confirmata ? "Semnat" : "Nesemnat"}</Badge>
      <Buton
        varianta="tertiar"
        inCurs={inCurs}
        textInCurs="Se salvează…"
        onClick={() => {
          ruleaza(
            async () => await confirmaPrimireaEip({ id, confirmata: !confirmata }),
            confirmata ? "Confirmarea de primire a fost retrasă." : "Primirea a fost confirmată.",
          );
        }}
      >
        {confirmata ? "Retrage" : "Marchează semnat"}
      </Buton>
    </span>
  );
}

export function ReturnareEip({
  id,
  returnatLa,
  azi,
}: {
  readonly id: string;
  readonly returnatLa: string | null;
  /** Ziua curentă la București, calculată pe server — browserul poate fi pe alt fus. */
  readonly azi: string;
}): ReactElement {
  const [deschis, setDeschis] = useState(false);
  const [data, setData] = useState(returnatLa ?? azi);
  const { inCurs, ruleaza } = useActiuneRand();

  function inchide(): void {
    setDeschis(false);
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {returnatLa === null ? (
        <span className="text-muted-foreground">În folosință</span>
      ) : (
        <span>{formatDate(returnatLa)}</span>
      )}
      <Buton
        varianta="tertiar"
        onClick={() => {
          setData(returnatLa ?? azi);
          setDeschis(true);
        }}
      >
        {returnatLa === null ? "Marchează returnat" : "Corectează"}
      </Buton>

      <DialogPortat
        deschis={deschis}
        laInchidere={inchide}
        titlu="Returnarea echipamentului"
        descriere="Se scrie data reală de pe bon, nu ziua în care se face înregistrarea."
        marime="mic"
        subsol={
          <>
            <Buton varianta="secundar" disabled={inCurs} onClick={inchide}>
              Renunță
            </Buton>
            {returnatLa === null ? null : (
              <Buton
                varianta="distructiv"
                inCurs={inCurs}
                textInCurs="Se salvează…"
                onClick={() => {
                  ruleaza(
                    async () => await marcheazaEipReturnat({ id, returnat_la: null }),
                    "Returnarea a fost ștearsă — echipamentul e din nou în folosință.",
                    inchide,
                  );
                }}
              >
                Șterge returnarea
              </Buton>
            )}
            <Buton
              varianta="primar"
              inCurs={inCurs}
              textInCurs="Se salvează…"
              disabled={data === ""}
              onClick={() => {
                ruleaza(
                  async () => await marcheazaEipReturnat({ id, returnat_la: data }),
                  "Returnarea a fost înregistrată.",
                  inchide,
                );
              }}
            >
              Salvează
            </Buton>
          </>
        }
      >
        <Camp nume="returnat_la" eticheta="Returnat la" obligatoriu>
          {(a) => (
            <input
              {...a}
              type="date"
              max={azi}
              value={data}
              onChange={(e) => {
                setData(e.target.value);
              }}
            />
          )}
        </Camp>
      </DialogPortat>
    </span>
  );
}
