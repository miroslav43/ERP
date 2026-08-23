"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { clasaControl } from "@/components/ui/camp";
import { ConfirmareActiune, Dialog } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { decideCheltuiala, stergeCheltuiala } from "../actions";

/**
 * Decizia și ștergerea unei cheltuieli de pe fișa deplasării.
 *
 * ── DE CE E ECRANUL ĂSTA CAPĂTUL UNUI LANȚ RUPT ───────────────────────────
 * `decizieCheltuialaSchema` exista în `src/schemas/per-diem.ts` de la prima
 * livrare a modulului și NU era importat nicăieri: niciun ecran, nicio
 * acțiune. Consecința se vedea tocmai în decont, care însumează exclusiv
 * rândurile cu `aprobata = true` — deci arăta permanent „Nicio cheltuială
 * aprobată” și un total mai mic cu exact suma cheltuielilor reale.
 *
 * ── MOTIVUL RESPINGERII E OBLIGATORIU ─────────────────────────────────────
 * `trip_expenses.motiv_respingere` EXISTĂ în bază (spre deosebire de
 * `business_trips`, unde nu există și de aceea respingerea unei deplasări
 * rămâne fără text). Aici textul are unde să se scrie și e afișat pe fișă sub
 * rândul respins — omul care a înregistrat bonul află de ce nu i se decontează.
 */
export function ActiuniCheltuiala({
  id,
  aprobata,
  descriere,
  sumaLei,
  poateDecide,
  poateSterge,
}: {
  readonly id: string;
  readonly aprobata: boolean;
  readonly descriere: string;
  readonly sumaLei: string;
  readonly poateDecide: boolean;
  readonly poateSterge: boolean;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [dialogRespingere, setDialogRespingere] = useState(false);
  const [dialogStergere, setDialogStergere] = useState(false);
  const [motiv, setMotiv] = useState("");
  const [eroareMotiv, setEroareMotiv] = useState<string | null>(null);
  const idMotiv = useId();

  function aproba(): void {
    porneste(async () => {
      const rezultat = await decideCheltuiala({ id, decizie: "aproba", motiv_respingere: null });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      arataToast({ fel: "reusita", text: "Cheltuiala a fost aprobată și intră în decont." });
      router.refresh();
    });
  }

  function respinge(): void {
    if (motiv.trim().length === 0) {
      setEroareMotiv("Scrieți motivul respingerii — el ajunge pe fișă, la angajat.");
      return;
    }
    setEroareMotiv(null);
    porneste(async () => {
      const rezultat = await decideCheltuiala({
        id,
        decizie: "respinge",
        motiv_respingere: motiv.trim(),
      });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDialogRespingere(false);
      setMotiv("");
      arataToast({ fel: "reusita", text: "Cheltuiala a fost respinsă, cu motivul scris." });
      router.refresh();
    });
  }

  function sterge(): void {
    porneste(async () => {
      const rezultat = await stergeCheltuiala({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDialogStergere(false);
      arataToast({ fel: "reusita", text: "Cheltuiala a fost ștearsă." });
      router.refresh();
    });
  }

  if (!poateDecide && !poateSterge) return null;

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {poateDecide && !aprobata ? (
        <Buton
          varianta="tertiar"
          marime="iconita"
          aria-label={`Aprobă cheltuiala ${descriere}`}
          inCurs={inCurs}
          onClick={aproba}
        >
          <Check aria-hidden="true" className="size-4" />
        </Buton>
      ) : null}

      {poateDecide ? (
        <Buton
          varianta="tertiar"
          marime="iconita"
          aria-label={`Respinge cheltuiala ${descriere}`}
          onClick={() => {
            setDialogRespingere(true);
          }}
        >
          <X aria-hidden="true" className="size-4" />
        </Buton>
      ) : null}

      {poateSterge && !aprobata ? (
        <Buton
          varianta="tertiar"
          marime="iconita"
          aria-label={`Șterge cheltuiala ${descriere}`}
          onClick={() => {
            setDialogStergere(true);
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Buton>
      ) : null}

      <Dialog
        deschis={dialogRespingere}
        laInchidere={() => {
          setDialogRespingere(false);
        }}
        titlu="Respingeți cheltuiala?"
        descriere={`${descriere} · ${sumaLei}. Motivul apare pe fișa deplasării, sub rândul respins.`}
        marime="mic"
        subsol={
          <>
            <Buton
              varianta="secundar"
              onClick={() => {
                setDialogRespingere(false);
              }}
            >
              Renunță
            </Buton>
            <Buton
              varianta="distructiv"
              inCurs={inCurs}
              textInCurs="Se respinge…"
              onClick={respinge}
            >
              Respinge cheltuiala
            </Buton>
          </>
        }
      >
        <label htmlFor={idMotiv} className="text-foreground text-corp mb-1 block font-medium">
          Motivul respingerii{" "}
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id={idMotiv}
          rows={3}
          maxLength={500}
          value={motiv}
          onChange={(e) => {
            setMotiv(e.target.value);
            if (eroareMotiv !== null) setEroareMotiv(null);
          }}
          aria-invalid={eroareMotiv === null ? undefined : true}
          aria-describedby={eroareMotiv === null ? undefined : `${idMotiv}-eroare`}
          className={clasaControl({ fel: "textarea" })}
        />
        {eroareMotiv === null ? null : (
          <p id={`${idMotiv}-eroare`} role="alert" className="text-danger text-nota mt-1">
            {eroareMotiv}
          </p>
        )}
      </Dialog>

      <ConfirmareActiune
        deschis={dialogStergere}
        laInchidere={() => {
          setDialogStergere(false);
        }}
        titlu="Ștergeți cheltuiala?"
        consecinta="Rândul dispare din fișă și din decont. O cheltuială deja aprobată nu se poate șterge — i se respinge întâi aprobarea."
        cifre={[
          { eticheta: "Cheltuiala", valoare: descriere },
          { eticheta: "Valoare", valoare: sumaLei },
        ]}
        etichetaConfirmare="Șterge cheltuiala"
        distructiv
        inCurs={inCurs}
        laConfirmare={sterge}
      />
    </div>
  );
}
