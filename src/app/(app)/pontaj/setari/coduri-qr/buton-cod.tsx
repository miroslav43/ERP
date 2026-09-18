// src/app/(app)/pontaj/setari/coduri-qr/buton-cod.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { QrCode } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { rotesteCodPontaj } from "@/app/(app)/puncte-lucru/actions";

/**
 * Butonul care face codul QR al unui punct de lucru, din fila de pontaj.
 *
 * ── DE CE NU-ȘI SCRIE PROPRIA ACȚIUNE ─────────────────────────────────────
 * `rotesteCodPontaj` e a modulului `puncte-lucru` și se importă ca atare —
 * tiparul e deja în depozit (`angajati/nou` cheamă `creeazaDepartament`).
 * Rescrisă aici, ar fi a doua implementare a aceleiași reguli: allow-list de
 * audit goală fiindcă e un secret, `.select()` după `.update()` fiindcă
 * politica refuză cu zero rânduri și fără eroare. A doua copie e exact locul
 * unde cele două se despart tăcut.
 *
 * ── DE CE SE REÎMPROSPĂTEAZĂ PAGINA, ÎN LOC SĂ ARATE CODUL PRIMIT ─────────
 * Acțiunea întoarce codul nou, și ar fi fost la îndemână să-l desenăm din
 * răspuns. Dar codul se desenează ca SVG pe SERVER, tocmai ca șirul să nu
 * traverseze granița; `router.refresh()` reface pagina cu poza nouă, pe
 * aceeași cale ca prima încărcare. Desenat din răspuns, ecranul ar fi avut o a
 * doua cale de randare, cu alt rezultat posibil.
 */
export function ButonCodQr({
  punctId,
  areCod,
}: {
  readonly punctId: string;
  /** Schimbă doar cuvintele: „Generează" pe gol, „un cod nou" peste unul viu. */
  readonly areCod: boolean;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  return (
    <span className="flex flex-col items-end gap-1">
      <Buton
        varianta={areCod ? "tertiar" : "secundar"}
        inCurs={inCurs}
        textInCurs="Se generează…"
        {...(areCod
          ? {
              title:
                "Codul QR de acum se anulează: afișele deja tipărite și lipite nu vor mai funcționa, trebuie retipărite.",
            }
          : {})}
        onClick={() => {
          setEroare(null);
          porneste(async () => {
            const rezultat = await rotesteCodPontaj({ id: punctId });
            if (!rezultat.ok) {
              setEroare(rezultat.error.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        <QrCode aria-hidden="true" className="size-3.5" />
        {areCod ? "Generează un cod nou" : "Generează codul QR"}
      </Buton>
      {eroare === null ? null : (
        <span role="alert" className="text-danger text-nota text-end">
          {eroare}
        </span>
      )}
    </span>
  );
}
