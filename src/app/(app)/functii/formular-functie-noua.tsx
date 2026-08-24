// src/app/(app)/functii/formular-functie-noua.tsx
"use client";

import { Plus } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Dialog } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";

import { CampuriFunctie, VALORI_GOALE } from "./campuri-functie";
import { creeazaFunctie } from "./actions";

/**
 * Funcție nouă, într-un dialog.
 *
 * ── DE CE NU MAI CREȘTE ÎN PAGINĂ ─────────────────────────────────────────
 * Formularul se deschidea inline, sub antet, și împingea nomenclatorul în jos:
 * cine voia să vadă ce coduri interne sunt deja luate — exact întrebarea de
 * dinaintea completării câmpului „Cod intern” — trebuia să închidă formularul,
 * să se uite, și să-l redeschidă gol. `dialog.tsx` numărase deja ~15 formulare
 * de felul ăsta în aplicație; ăsta era unul dintre ele.
 *
 * ── CE PĂSTREAZĂ DIN VARIANTA VECHE ───────────────────────────────────────
 * Cu `<form action={fn}>` și câmpuri necontrolate, React 19 RESETEAZĂ
 * formularul după ce acțiunea se încheie — inclusiv când a eșuat. Aici asta
 * însemna că un cod COR inexistent (singura validare care chiar respinge des:
 * `codCorOptional` cere ca cele șase cifre să EXISTE în Clasificarea
 * Ocupațiilor) golea și codul intern, și denumirea, și nivelul de studii, și
 * descrierea. `valoriTrimise` le pune înapoi ca `defaultValue`, iar
 * `stare.erori` duce fiecare mesaj lângă câmpul lui.
 *
 * Dialogul NU se închide la refuz — s-ar pierde exact ce a scris omul, cu un
 * gest în plus față de resetul de dinainte. Se închide doar din `laReusita`.
 */

/** Cheile obiectului sunt EXACT cele din `creeazaFunctieSchema`. */
async function trimite(date: FormData) {
  return creeazaFunctie({
    cod: String(date.get("cod") ?? ""),
    denumire: String(date.get("denumire") ?? ""),
    cod_cor: String(date.get("cod_cor") ?? ""),
    nivel_studii: String(date.get("nivel_studii") ?? ""),
    descriere: String(date.get("descriere") ?? ""),
  });
}

export function FormularFunctieNoua() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în lista de dependențe a efectului din
  // `Formular`. O funcție nouă la fiecare randare ar reporni efectul după
  // succes, deci notificarea ar apărea de două ori.
  const laReusita = useCallback((): void => {
    setDeschis(false);
    router.refresh();
  }, [router]);

  const inchide = useCallback((): void => {
    setDeschis(false);
  }, []);

  return (
    <>
      <Buton
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Plus aria-hidden="true" className="size-4" />
        Funcție nouă
      </Buton>

      {/* Dialogul se randează doar cât e deschis: altfel `CautaCor` ar ține
          nomenclatorul de 4422 de ocupații filtrat în memorie de la prima
          randare a paginii, pentru un formular pe care poate nimeni nu-l
          deschide. Montarea îl golește și de valorile rămase dintr-o încercare
          anterioară. */}
      {deschis ? (
        <Dialog
          deschis
          laInchidere={inchide}
          titlu="Funcție nouă"
          descriere="Codul COR e cel din Clasificarea Ocupațiilor din România. Fără el, funcția nu poate ajunge pe un contract."
          marime="mare"
        >
          {/* Butoanele stau ÎN formular, nu în `subsol`-ul dialogului.
              Subsolul e frate cu `<form>` în DOM, deci un buton pus acolo
              n-ar putea nici să trimită, nici să citească `stare.inCurs` —
              adică s-ar pierde „Se creează…”, singurul semn că apăsarea a fost
              înregistrată. `BaraActiuni` face aceeași treabă din interior:
              `aliniere="final"` e documentat exact ca footer de dialog, iar
              `lipitaPeTelefon` o ține la îndemână sub `md`, peste
              `env(safe-area-inset-bottom)`. */}
          <Formular actiune={trimite} laReusita={laReusita} mesajReusita="Funcția a fost creată.">
            {(stare) => (
              <>
                <CampuriFunctie stare={stare} idc={idc} initiale={VALORI_GOALE} cuCodIntern />
                <BaraActiuni aliniere="final" separata lipitaPeTelefon>
                  <Buton varianta="secundar" onClick={inchide} disabled={stare.inCurs}>
                    Renunță
                  </Buton>
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se creează…"
                  >
                    Creează funcția
                  </Buton>
                </BaraActiuni>
              </>
            )}
          </Formular>
        </Dialog>
      ) : null}
    </>
  );
}
