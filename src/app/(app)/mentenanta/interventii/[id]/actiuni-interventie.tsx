"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";

import { actualizeazaInterventie, anuleazaInterventie } from "../actions";
import { CampuriInterventie, type OptiuneInterventie } from "../campuri-interventie";
import { valoriInterventie } from "../valori-interventie";

/**
 * Bara fișei intervenției: Corectează și Anulează. Pagina n-o randează fără
 * `maintenance:update`/team.
 *
 * Anularea spune consecința, nu „Sigur?”: planul legat revine la execuția
 * anterioară, oprirea planificată iese din jurnal, iar o intervenție care a
 * rezolvat o sesizare se anulează abia după redeschiderea ei — refuzul vine din
 * bază (P0001, cu numărul sesizării) și apare ca notificare.
 */
export function ActiuniInterventie({
  id,
  numar,
  denumirePlan,
  existenta,
  costPieseDinLinii,
  angajati,
}: Readonly<{
  id: string;
  numar: string;
  /** Planul legat, dacă există — consecința anulării îl numește. */
  denumirePlan: string | null;
  /** Valorile curente, ca text (forma din `FormData`), pentru caseta de corectare. */
  existenta: Readonly<Record<string, string>>;
  costPieseDinLinii: boolean;
  angajati: readonly OptiuneInterventie[];
}>): ReactElement {
  const router = useRouter();
  const [confirmare, setConfirmare] = useState(false);
  const [inCurs, porneste] = useTransition();

  const corecteaza = useCallback(
    async (formular: FormData) =>
      await actualizeazaInterventie({ ...valoriInterventie(formular), id }),
    [id],
  );

  function anuleaza(): void {
    porneste(async () => {
      const rezultat = await anuleazaInterventie({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setConfirmare(false);
      arataToast({ fel: "reusita", text: `Intervenția ${numar} a fost anulată.` });
      router.push("/mentenanta/interventii");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FormularDialog
        declansator={{
          eticheta: "Corectează",
          varianta: "secundar",
          pictograma: <Pencil aria-hidden="true" className="size-4" />,
        }}
        titlu={`Corectați intervenția ${numar}`}
        descriere="Planul, echipamentul și sesizarea rămân cele de la înregistrare. O dată sau o citire corectată mută și scadența planului."
        marime="lucru"
        actiune={corecteaza}
        mesajReusita="Intervenția a fost corectată."
        etichetaTrimite="Salvează corectura"
        textInCurs="Se salvează…"
      >
        {(stare, idc) => (
          <CampuriInterventie
            stare={stare}
            idc={idc}
            angajati={angajati}
            existenta={existenta}
            costPieseDinLinii={costPieseDinLinii}
          />
        )}
      </FormularDialog>

      <Buton
        varianta="distructiv"
        onClick={() => {
          setConfirmare(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
        Anulează
      </Buton>
      <ConfirmareActiune
        deschis={confirmare}
        laInchidere={() => {
          setConfirmare(false);
        }}
        titlu={`Anulați intervenția ${numar}?`}
        consecinta={
          denumirePlan === null
            ? "Intervenția iese din liste și din costuri, iar oprirea ei iese din jurnal. Rândul din registrul de documente rămâne, ca orice document înregistrat."
            : `Planul „${denumirePlan}” revine la scadența anterioară. Intervenția iese din liste și din costuri; rândul din registrul de documente rămâne.`
        }
        etichetaConfirmare="Anulează intervenția"
        distructiv
        inCurs={inCurs}
        laConfirmare={anuleaza}
      />
    </div>
  );
}
