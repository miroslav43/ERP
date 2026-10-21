"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { decideDeplasare, deconteazaDeplasare } from "../actions";
import type { RezumatDecizie } from "../rezumat-decizie";
import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

type Decizie = "aprobata" | "respinsa";

/**
 * Decizia unui aprobator asupra unei deplasări.
 *
 * `motiv_respingere` nu există ca și coloană pe `business_trips` (spre
 * deosebire de `leave_requests`/`trip_sheets`) — respingerea e o simplă
 * tranziție de stare, fără text de motivare persistat.
 *
 * Aprobarea și respingerea trec printr-o casetă de confirmare care arată CE se
 * decide — omul, intervalul, avansul — iar reușita se anunță (QA oct 2026:
 * MGR-018, FLX-009). Până aici „Aprobă” se executa la primul clic și rândul
 * dispărea din listă fără niciun mesaj. `rezumat` vine gata formatat de pe
 * server: toate valorile sunt deja în `RandDeplasare`, zero interogări în plus.
 */
export function DecizieDeplasare({
  id,
  status,
  rezumat,
}: {
  readonly id: string;
  readonly status: "in_aprobare" | "aprobata";
  readonly rezumat: RezumatDecizie;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [deConfirmat, setDeConfirmat] = useState<Decizie | null>(null);

  function decide(): void {
    const decizie = deConfirmat;
    if (decizie === null) return;
    porneste(async () => {
      const rezultat = await decideDeplasare({ id, decizie });
      if (!rezultat.ok) {
        // Caseta rămâne deschisă: refuzul se citește cu decizia în față.
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeConfirmat(null);
      arataToast({
        fel: "reusita",
        text:
          decizie === "aprobata" ? "Deplasarea a fost aprobată." : "Deplasarea a fost respinsă.",
      });
      router.refresh();
    });
  }

  function deconteaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await deconteazaDeplasare({ id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  const respinge = deConfirmat === "respinsa";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {status === "in_aprobare" ? (
          <>
            <Buton
              varianta="primar"
              disabled={inCurs}
              onClick={() => {
                setDeConfirmat("aprobata");
              }}
            >
              Aprobă
            </Buton>
            <Buton
              varianta="secundar"
              disabled={inCurs}
              onClick={() => {
                setDeConfirmat("respinsa");
              }}
            >
              Respinge
            </Buton>
          </>
        ) : (
          <Buton varianta="primar" inCurs={inCurs} textInCurs="Se marchează…" onClick={deconteaza}>
            Marchează decontată
          </Buton>
        )}
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota max-w-sm">
          {eroare}
        </p>
      )}

      <ConfirmareActiune
        deschis={deConfirmat !== null}
        laInchidere={() => {
          setDeConfirmat(null);
        }}
        titlu={respinge ? "Respingeți deplasarea?" : "Aprobați deplasarea?"}
        consecinta={
          respinge
            ? "Deplasarea se întoarce la angajat pentru corecturi; o poate retrimite."
            : "Angajatul este anunțat în portal. Decontul se depune după întoarcere, din aceeași deplasare."
        }
        cifre={[
          { eticheta: "Angajat", valoare: rezumat.angajat },
          { eticheta: "Interval", valoare: rezumat.interval },
          { eticheta: "Avans", valoare: rezumat.avans },
        ]}
        etichetaConfirmare={respinge ? "Respinge deplasarea" : "Aprobă deplasarea"}
        distructiv={respinge}
        inCurs={inCurs}
        laConfirmare={decide}
      />
    </div>
  );
}
