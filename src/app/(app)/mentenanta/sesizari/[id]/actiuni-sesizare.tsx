"use client";

import { Check, Search, Wrench, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";
import { tranzitiiPermise, type TranzitieSesizare } from "@/domain/maintenance/sesizari";
import type { StatusSesizare } from "@/schemas/maintenance";

import { rezolvaSesizare, trieazaSesizare } from "../../actions";
import { ETICHETE_STATUS_SESIZARE } from "../../etichete";
import { CampuriInterventie, type OptiuneInterventie } from "../../interventii/campuri-interventie";
import { valoriInterventie } from "../../interventii/valori-interventie";

/**
 * Triajul și rezolvarea unei sesizări — fiecare gest în caseta lui.
 *
 * ── CE ÎNLOCUIEȘTE ───────────────────────────────────────────────────────
 * Un rând de patru butoane afișate oricând, inclusiv cel al stării curente,
 * care schimbau starea la un clic, fără confirmare; un panou de respingere cu
 * `<input>` liber; și un panou de rezolvare pe `<form action>` necontrolat
 * (React 19 îl reseta la eroare) cu cinci câmpuri din treisprezece, restul
 * fixate pe `null`. „Renunță" rămânea activ cât cererea era în zbor.
 *
 * ── CE E ACUM ────────────────────────────────────────────────────────────
 * Butoanele vin din `tranzitiiPermise` (`domain/maintenance/sesizari.ts`):
 * starea curentă nu e ofertă. Schimbările de stare trec prin `ConfirmareActiune`
 * cu propoziția de consecință; respingerea prin `FormularDialog` cu motivul pe
 * `Camp` (eroarea serverului ajunge pe câmp); rezolvarea prin `FormularDialog`
 * cu TOATE câmpurile intervenției, pre-completată cu azi / corectivă / reușită.
 * Toate trei refuză închiderea cât o trimitere e în zbor și dau toast.
 */
interface Proprietati {
  readonly sesizareId: string;
  readonly status: StatusSesizare;
  readonly angajati: readonly OptiuneInterventie[];
  /** Ziua României, ISO — data implicită a intervenției care rezolvă. */
  readonly azi: string;
}

const CONSECINTA: Readonly<Record<"in_analiza" | "in_lucru", string>> = {
  in_analiza:
    "Sesizarea trece în „În analiză”: așa apare în coada de triaj și pe ecranul celui care a raportat-o. Se poate schimba oricând, până la rezolvare sau respingere.",
  in_lucru:
    "Sesizarea trece în „În lucru”: cineva s-a apucat de ea. Raportorul vede starea nouă; rezolvarea se înregistrează tot de aici, cu intervenția făcută.",
};

function ButonTranzitie({
  sesizareId,
  tinta,
  pictograma,
}: {
  readonly sesizareId: string;
  readonly tinta: "in_analiza" | "in_lucru";
  readonly pictograma: ReactElement;
}): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  function confirma(): void {
    porneste(async () => {
      const rezultat = await trieazaSesizare({
        id: sesizareId,
        status: tinta,
        motiv_respingere: null,
      });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({
        fel: "reusita",
        text: `Sesizarea e acum „${ETICHETE_STATUS_SESIZARE[tinta]}”.`,
      });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="secundar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        {pictograma}
        {ETICHETE_STATUS_SESIZARE[tinta]}
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={`Treceți sesizarea în „${ETICHETE_STATUS_SESIZARE[tinta]}”?`}
        consecinta={CONSECINTA[tinta]}
        etichetaConfirmare={`Trece în „${ETICHETE_STATUS_SESIZARE[tinta]}”`}
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}

export function ActiuniSesizare({ sesizareId, status, angajati, azi }: Proprietati): ReactElement {
  const router = useRouter();
  const tranzitii: readonly TranzitieSesizare[] = tranzitiiPermise(status, {
    poateGestiona: true,
  });

  async function respinge(date: FormData) {
    return trieazaSesizare({
      id: sesizareId,
      status: "respins",
      motiv_respingere: String(date.get("motiv_respingere") ?? "").trim(),
    });
  }

  async function rezolva(date: FormData) {
    return rezolvaSesizare({ id: sesizareId, ...valoriInterventie(date) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tranzitii.includes("in_analiza") ? (
        <ButonTranzitie
          sesizareId={sesizareId}
          tinta="in_analiza"
          pictograma={<Search aria-hidden="true" className="size-4" />}
        />
      ) : null}
      {tranzitii.includes("in_lucru") ? (
        <ButonTranzitie
          sesizareId={sesizareId}
          tinta="in_lucru"
          pictograma={<Wrench aria-hidden="true" className="size-4" />}
        />
      ) : null}

      {tranzitii.includes("rezolvat") ? (
        <FormularDialog
          declansator={{
            eticheta: "Rezolvă",
            varianta: "primar",
            pictograma: <Check aria-hidden="true" className="size-4" />,
          }}
          titlu="Rezolvați sesizarea"
          descriere="Rezolvarea înregistrează intervenția care a remediat defecțiunea și închide sesizarea. Data e azi, tipul „corectivă” și rezultatul „reușită” — schimbați-le dacă a fost altfel."
          marime="mare"
          actiune={rezolva}
          mesajReusita="Sesizarea a fost rezolvată, iar intervenția e în registru."
          etichetaTrimite="Confirmă rezolvarea"
          textInCurs="Se salvează…"
          laReusita={() => {
            router.refresh();
          }}
        >
          {(stare, idc) => (
            <CampuriInterventie
              stare={stare}
              idc={idc}
              angajati={angajati}
              tipImplicit="corectiva"
              dataImplicita={azi}
            />
          )}
        </FormularDialog>
      ) : null}

      {tranzitii.includes("respins") ? (
        <FormularDialog
          declansator={{
            eticheta: "Respinge",
            varianta: "distructiv",
            pictograma: <X aria-hidden="true" className="size-4" />,
          }}
          titlu="Respingeți sesizarea?"
          descriere="Respingerea e definitivă: sesizarea nu se mai redeschide, iar cel care a raportat-o vede motivul pe ecranul lui. O defecțiune reală se raportează din nou, cu detaliile cerute aici."
          marime="mediu"
          actiune={respinge}
          mesajReusita="Sesizarea a fost respinsă."
          etichetaTrimite="Respinge sesizarea"
          variantaTrimite="distructiv"
          textInCurs="Se respinge…"
        >
          {(stare, idc) => (
            <Camp
              nume="motiv_respingere"
              id={idc("motiv")}
              eticheta="Motivul respingerii"
              obligatoriu
              fel="textarea"
              ajutor="Cel puțin 5 caractere. Se arată raportorului — spuneți-i ce să verifice sau unde să raporteze."
              erori={stare.erori["motiv_respingere"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  maxLength={500}
                  defaultValue={
                    stare.data === null ? (stare.valoriTrimise["motiv_respingere"] ?? "") : ""
                  }
                />
              )}
            </Camp>
          )}
        </FormularDialog>
      ) : null}
    </div>
  );
}
