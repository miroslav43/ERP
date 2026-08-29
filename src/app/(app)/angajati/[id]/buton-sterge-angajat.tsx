// src/app/(app)/angajati/[id]/buton-sterge-angajat.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { ConfirmareActiune, Dialog } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import { motiveleRefuzuluiStergerii, type PiediciStergere } from "@/domain/hr/stergere-angajat";

import { stergeAngajat } from "../actions";

/**
 * Ștergerea fișei, cu confirmare.
 *
 * ── DE CE BUTONUL RĂMÂNE APĂSABIL CÂND EXISTĂ PIEDICI ─────────────────────
 * Tiparul din `actiuni-functie.tsx` blochează butonul și pune motivul alături.
 * Merge acolo: motivul e unul singur („are N angajați alocați”) și încape pe o
 * linie sub buton. Aici motivele sunt până la trei, fiecare cu instrucțiunea
 * lui, iar butonul stă în antetul paginii, într-un rând orizontal unde n-are
 * unde să curgă un paragraf.
 *
 * Deci apăsarea deschide tot dialogul, doar că dialogul are DOUĂ fețe: lista de
 * refuzuri, sau confirmarea. Un buton mort cu tooltip ar fi ascuns exact
 * partea folositoare — ce anume are omul de făcut ca să poată șterge.
 *
 * ── DE CE `push`, NU `refresh` ────────────────────────────────────────────
 * După ștergere pagina asta nu mai există: `citesteAngajat` filtrează
 * `deleted_at is null`, deci un `router.refresh()` ar reîncărca fix ecranul de
 * „negăsit”. Omul se întoarce în listă, unde vede că fișa chiar a dispărut.
 */
export function ButonStergeAngajat({
  id,
  nume,
  marca,
  status,
  piedici,
}: {
  readonly id: string;
  readonly nume: string;
  readonly marca: string;
  readonly status: string;
  readonly piedici: PiediciStergere;
}) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  const motive = motiveleRefuzuluiStergerii(piedici);
  const blocat = motive.length > 0;

  function inchide(): void {
    setDeschis(false);
  }

  function sterge(): void {
    porneste(async () => {
      const rezultat = await stergeAngajat({ id });
      if (!rezultat.ok) {
        // Serverul renumără piedicile la fiecare apel: dacă între randare și
        // apăsare cineva a semnat un contract, refuzul sosește AICI, cu aceeași
        // propoziție pe care ar fi arătat-o dialogul.
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: `Fișa lui ${nume} a fost ștearsă.` });
      router.push("/angajati");
    });
  }

  return (
    <>
      <Buton
        varianta="distructiv"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
        Șterge fișa
        <span className="sr-only"> lui {nume}</span>
      </Buton>

      {blocat ? (
        <Dialog
          deschis={deschis}
          laInchidere={inchide}
          titlu="Fișa nu se poate șterge"
          descriere={`${nume} · marca ${marca}`}
          marime="mic"
          subsol={
            <Buton varianta="secundar" onClick={inchide}>
              Am înțeles
            </Buton>
          }
        >
          <Callout fel="eroare" titlu="Nu poți șterge fișa, pentru că:">
            <ul className="mt-1 list-disc space-y-1 ps-5">
              {motive.map((motiv) => (
                <li key={motiv}>{motiv}</li>
              ))}
            </ul>
          </Callout>
        </Dialog>
      ) : (
        <ConfirmareActiune
          deschis={deschis}
          laInchidere={inchide}
          titlu="Ștergeți fișa acestui angajat?"
          consecinta="Fișa dispare din listă, din căutare, din organigramă și din pontaj. Contractele și documentele rămân legate de ea, iar ștergerea se poate întoarce din baza de date — dar nu dintr-un buton al aplicației."
          cifre={[
            { eticheta: "Angajat", valoare: nume },
            { eticheta: "Marca", valoare: marca },
            { eticheta: "Status", valoare: status },
          ]}
          etichetaConfirmare="Șterge fișa"
          distructiv
          inCurs={inCurs}
          laConfirmare={sterge}
        />
      )}
    </>
  );
}
