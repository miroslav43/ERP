// src/app/(app)/mentenanta/interventii/document-interventie.ts
//
// Procesul-verbal (sau buletinul, factura) urcat ÎNAINTE de înregistrarea
// intervenției — M6, cazul 34. Folosit de cele trei casete care creează o
// intervenție: fișa echipamentului, „Execută” de pe plan, lista de intervenții.
//
// ── DE CE ÎNAINTE ȘI NU DUPĂ ───────────────────────────────────────────────
// O verificare legală nu se înregistrează fără PV. Dacă PV-ul ar urca după,
// intervenția ar exista o clipă fără el — iar o încărcare eșuată ar lăsa-o așa
// definitiv. Calea fișierului poartă id-ul intervenției, generat AICI
// (`crypto.randomUUID()`); baza tratează un id încă nefolosit ca rezervare
// (`app.mentenanta_poate_fisier`, 0192), iar acțiunea scrie intervenția cu
// exact acel id și leagă rândul atașamentului.
//
// ── REÎNCERCAREA ───────────────────────────────────────────────────────────
// Caseta nu se închide la refuz. Dacă omul corectează descrierea și retrimite
// ACELAȘI fișier, documentul nu se urcă a doua oară: se refolosesc id-ul și
// calea din prima încercare. Un fișier schimbat pornește o rezervare nouă.
// După reușită, rezervarea se uită — caseta următoare are alt id.

import { useCallback, useRef } from "react";

import type { ActionResult } from "@/lib/actions/types";
import { urcaPeUrlSemnat } from "@/lib/storage/urca-semnat";
import {
  TIPURI_ATASAMENT_INTERVENTIE,
  type AtasamentInterventieInput,
  type TipAtasamentInterventie,
} from "@/schemas/maintenance";

import { pregatesteFisier } from "../sesizari/actions";
import { documentDinFormular, tipDocumentDinFormular } from "./valori-interventie";

type Rezervare = Readonly<{
  fisier: File;
  id: string;
  atasament: AtasamentInterventieInput;
}>;

export type DocumentPregatit =
  | Readonly<{ ok: true; id: string | null; atasament: AtasamentInterventieInput | null }>
  | Readonly<{ ok: false; rezultat: ActionResult<never> }>;

/** Refuz local, în forma pe care o înțelege `Formular` (eroarea lângă câmpul de fișier). */
function refuz(mesaj: string): DocumentPregatit {
  return {
    ok: false,
    rezultat: {
      ok: false,
      error: {
        code: "VALIDARE",
        message: mesaj,
        fieldErrors: { document: [mesaj] },
        requestId: "",
      },
    },
  };
}

function tipAles(formular: FormData): TipAtasamentInterventie {
  const tip = tipDocumentDinFormular(formular);
  return (TIPURI_ATASAMENT_INTERVENTIE as readonly string[]).includes(tip)
    ? (tip as TipAtasamentInterventie)
    : "pv";
}

/**
 * Același fișier, ales din nou: React 19 golește formularul după o trimitere
 * refuzată, deci omul alege fișierul încă o dată și primește alt obiect `File`.
 * Identitatea se judecă după nume, mărime și data modificării.
 */
function acelasiFisier(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

export function useDocumentInterventie(): Readonly<{
  pregateste: (formular: FormData) => Promise<DocumentPregatit>;
  uita: () => void;
}> {
  const rezervare = useRef<Rezervare | null>(null);

  const pregateste = useCallback(async (formular: FormData): Promise<DocumentPregatit> => {
    const fisier = documentDinFormular(formular);
    if (fisier === null) return { ok: true, id: null, atasament: null };
    const tip = tipAles(formular);

    const anterioara = rezervare.current;
    if (anterioara !== null && acelasiFisier(anterioara.fisier, fisier)) {
      return { ok: true, id: anterioara.id, atasament: { ...anterioara.atasament, tip } };
    }

    const id = crypto.randomUUID();
    const pregatire = await pregatesteFisier({
      entity_type: "intervention",
      entity_id: id,
      numeFisier: fisier.name,
      dimensiune: fisier.size,
      mime: fisier.type === "" ? "application/octet-stream" : fisier.type,
    });
    if (!pregatire.ok) return { ok: false, rezultat: pregatire };
    const urcat = await urcaPeUrlSemnat(pregatire.data.urlSemnat, fisier);
    if (!urcat) {
      return refuz("Documentul nu s-a putut urca. Verificați conexiunea și încercați din nou.");
    }
    const atasament: AtasamentInterventieInput = {
      cale: pregatire.data.cale,
      denumire: fisier.name.slice(0, 200),
      tip,
    };
    rezervare.current = { fisier, id, atasament };
    return { ok: true, id, atasament };
  }, []);

  const uita = useCallback(() => {
    rezervare.current = null;
  }, []);

  return { pregateste, uita };
}
