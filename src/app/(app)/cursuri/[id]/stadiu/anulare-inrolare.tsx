"use client";

// src/app/(app)/cursuri/[id]/stadiu/anulare-inrolare.tsx
//
// `anuleazaInrolare` exista de la prima livrare fără niciun apelant, deci
// insigna „Anulat" din tabelul de alături era o stare de neatins din interfață:
// singura cale către ea era triggerul `cursuri_angajat_inactiv`, adică plecarea
// omului din firmă. Un curs atribuit din greșeală rămânea restanță pe viață în
// lista angajatului și în matricea de conformitate.
//
// ── DE CE DIALOG CU CÂMP, NU `ConfirmareActiune` ────────────────────────────
// Baza CERE un motiv: `cursuri_protejeaza_inrolarea` ridică P0001 pe un motiv
// gol, iar schema cere minimum 5 caractere. Un dialog de tip „sunteți sigur?"
// n-are unde să-l primească, iar refuzul ar veni de la server, după clic.
//
// ── DE CE NU PE ÎNROLĂRILE PARCURSE ─────────────────────────────────────────
// Anularea unei înrolări finalizate ar șterge din listă o parcurgere care CHIAR
// a avut loc și pentru care există o dovadă imutabilă (`cursuri_dovada`).
// Baza n-o interzice; ecranul n-o oferă.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Dialog } from "@/components/ui/dialog";
import { clasaControl } from "@/components/ui/camp";
import { arataToast } from "@/components/ui/toast";
import type { CursStatus } from "@/schemas/cursuri";

import { anuleazaInrolare } from "../../actions";

/** Stările din care anularea are sens. */
const ANULABILE: readonly CursStatus[] = ["neinceput", "in_curs", "expirat"];

interface Proprietati {
  readonly inrolareId: string;
  readonly numeAngajat: string;
  readonly status: CursStatus;
}

export function AnulareInrolare({ inrolareId, numeAngajat, status }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [motiv, setMotiv] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  if (!ANULABILE.includes(status)) return null;

  const preaScurt = motiv.trim().length < 5;

  function trimite(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await anuleazaInrolare({ id: inrolareId, motiv: motiv.trim() });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      setMotiv("");
      arataToast({ fel: "reusita", text: "Înrolarea a fost anulată." });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Anulează înrolarea lui ${numeAngajat}`}
        title="Anulează înrolarea"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Ban className="size-4" aria-hidden="true" />
      </Buton>

      <Dialog
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={`Anulați înrolarea lui ${numeAngajat}?`}
        descriere="Cursul dispare din lista persoanei și nu mai apare ca restanță. Nu se poate redeschide — dacă e nevoie, cursul se atribuie din nou."
        subsol={
          <>
            <Buton
              varianta="distructiv"
              disabled={preaScurt || inCurs}
              inCurs={inCurs}
              textInCurs="Se anulează…"
              onClick={trimite}
            >
              Anulează înrolarea
            </Buton>
            <Buton
              varianta="tertiar"
              disabled={inCurs}
              onClick={() => {
                setDeschis(false);
              }}
            >
              Renunță
            </Buton>
          </>
        }
      >
        <div className="space-y-2">
          <label htmlFor={`motiv-${inrolareId}`} className="text-corp block font-medium">
            Motivul anulării
          </label>
          <textarea
            id={`motiv-${inrolareId}`}
            rows={3}
            maxLength={500}
            value={motiv}
            placeholder="Ex.: atribuit din greșeală, a schimbat funcția"
            className={clasaControl()}
            onChange={(e) => {
              setMotiv(e.target.value);
            }}
          />
          {/* Motivul intră în jurnalul de audit și se vede în fișa persoanei —
              deci se cere aici, nu se inventează la server. */}
          <p className="text-muted-foreground text-nota">
            {preaScurt
              ? "Scrieți cel puțin cinci caractere. Motivul rămâne în jurnal."
              : "Motivul rămâne în jurnal, lângă cine a anulat și când."}
          </p>
          {eroare === null ? null : (
            <p role="alert" className="text-danger text-nota">
              {eroare}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
