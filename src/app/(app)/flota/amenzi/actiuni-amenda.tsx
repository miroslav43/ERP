"use client";

import { Ban, CircleCheck, Gavel, Mail, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement, type ReactNode } from "react";

import { poateTrece, type StadiuAmenda } from "@/domain/fleet/amenzi";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { IntrareData } from "@/components/ui/intrare-data";
import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";

import {
  retrageDesemnarea,
  schimbaStadiulAmenzii,
  stergeAmenda,
  trimiteRaspuns,
} from "../actions-amenzi";

/**
 * O acțiune cu confirmare: butonul deschide o casetă, confirmarea execută,
 * eroarea ajunge în toast, reușita reîncarcă pagina. Un singur loc pentru cele
 * patru acțiuni fără câmpuri (retragere, plătită, contestată, ștergere).
 */
function ButonConfirmat({
  eticheta,
  pictograma,
  titlu,
  consecinta,
  etichetaConfirmare,
  distructiv,
  mesajReusita,
  executa,
  dupaReusita,
}: Readonly<{
  eticheta: string;
  pictograma: ReactNode;
  titlu: string;
  consecinta: string;
  etichetaConfirmare: string;
  distructiv?: boolean;
  mesajReusita: string;
  executa: () => Promise<ActionResult<unknown>>;
  dupaReusita?: "lista";
}>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await executa();
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: mesajReusita });
      if (dupaReusita === "lista") router.push("/flota/amenzi");
      else router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta={distructiv === true ? "distructiv" : "secundar"}
        onClick={() => {
          setDeschis(true);
        }}
      >
        {pictograma}
        {eticheta}
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={titlu}
        consecinta={consecinta}
        etichetaConfirmare={etichetaConfirmare}
        {...(distructiv === true ? { distructiv: true } : {})}
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}

/** Răspunsul către autoritate a plecat: data și, opțional, numărul de ieșire. */
export function DialogRaspuns({
  amendaId,
  azi,
}: Readonly<{ amendaId: string; azi: string }>): ReactElement {
  async function trimite(date: FormData) {
    return trimiteRaspuns({
      id: amendaId,
      raspuns_trimis_la: String(date.get("raspuns_trimis_la") ?? ""),
      raspuns_numar: String(date.get("raspuns_numar") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Marchează răspunsul trimis",
        varianta: "secundar",
        pictograma: <Mail aria-hidden="true" className="size-4" />,
      }}
      titlu="Răspunsul a plecat către autoritate"
      descriere="După ce marcați răspunsul trimis, șoferul desemnat, vehiculul și momentul faptei nu se mai pot schimba, iar termenul iese din scadențe."
      actiune={trimite}
      mesajReusita="Răspunsul a fost marcat ca trimis."
      etichetaTrimite="Marchează trimis"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="raspuns_trimis_la"
            id={idc("raspuns_trimis_la")}
            eticheta="Trimis la data de"
            obligatoriu
            erori={stare.erori["raspuns_trimis_la"] ?? []}
          >
            {(a) => (
              <IntrareData {...a} implicit={stare.valoriTrimise["raspuns_trimis_la"] ?? azi} />
            )}
          </Camp>
          <Camp
            nume="raspuns_numar"
            id={idc("raspuns_numar")}
            eticheta="Număr de înregistrare (ieșire)"
            erori={stare.erori["raspuns_numar"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={60}
                defaultValue={stare.valoriTrimise["raspuns_numar"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}

/** Anularea amenzii, cu motiv obligatoriu (o amendă în lucru nu se șterge). */
export function DialogAnulare({
  amendaId,
  numarPv,
}: Readonly<{ amendaId: string; numarPv: string }>): ReactElement {
  async function trimite(date: FormData) {
    return schimbaStadiulAmenzii({
      id: amendaId,
      stadiu: "anulata",
      motiv: String(date.get("motiv") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Anulează amenda",
        varianta: "secundar",
        pictograma: <Ban aria-hidden="true" className="size-4" />,
      }}
      titlu={`Anularea amenzii ${numarPv}`}
      descriere="Folosiți anularea când autoritatea a desființat procesul-verbal sau amenda a fost introdusă greșit după ce a intrat în lucru. Amenda anulată nu se mai modifică."
      actiune={trimite}
      mesajReusita="Amenda a fost anulată."
      etichetaTrimite="Anulează amenda"
      variantaTrimite="distructiv"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <Camp
          nume="motiv"
          id={idc("motiv")}
          eticheta="Motivul anulării"
          fel="textarea"
          obligatoriu
          erori={stare.erori["motiv"] ?? []}
        >
          {(a) => (
            <textarea
              {...a}
              maxLength={500}
              rows={3}
              defaultValue={stare.valoriTrimise["motiv"] ?? ""}
            />
          )}
        </Camp>
      )}
    </FormularDialog>
  );
}

/**
 * Butoanele stadiului: doar tranzițiile pe care baza le acceptă din stadiul
 * curent (aceeași matrice, `poateTrece`). Răspunsul trimis și desemnarea au
 * casetele lor.
 */
export function ButoaneStadiuAmenda({
  amendaId,
  numarPv,
  stadiu,
}: Readonly<{ amendaId: string; numarPv: string; stadiu: StadiuAmenda }>): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {stadiu === "sofer_desemnat" ? (
        <ButonConfirmat
          eticheta="Retrage desemnarea"
          pictograma={<Undo2 aria-hidden="true" className="size-4" />}
          titlu="Retrageți desemnarea?"
          consecinta="Amenda se întoarce în stadiul „primită”, fără șofer desemnat. Termenul de răspuns curge mai departe."
          etichetaConfirmare="Retrage desemnarea"
          mesajReusita="Desemnarea a fost retrasă."
          executa={() => retrageDesemnarea({ id: amendaId })}
        />
      ) : null}
      {poateTrece(stadiu, "contestata") ? (
        <ButonConfirmat
          eticheta="Marchează contestată"
          pictograma={<Gavel aria-hidden="true" className="size-4" />}
          titlu="Amenda a fost contestată?"
          consecinta="Marcați contestată amenda împotriva căreia s-a formulat plângere. Termenul de răspuns către autoritate rămâne în scadențe până trimiteți răspunsul."
          etichetaConfirmare="Marchează contestată"
          mesajReusita="Amenda a fost marcată contestată."
          executa={() => schimbaStadiulAmenzii({ id: amendaId, stadiu: "contestata" })}
        />
      ) : null}
      {poateTrece(stadiu, "platita") ? (
        <ButonConfirmat
          eticheta="Marchează plătită"
          pictograma={<CircleCheck aria-hidden="true" className="size-4" />}
          titlu="Amenda a fost plătită?"
          consecinta={`Amenda ${numarPv} se închide: după ce o marcați plătită, nu se mai modifică. Aplicația nu înregistrează plata și nu reține nimic din salariu.`}
          etichetaConfirmare="Marchează plătită"
          mesajReusita="Amenda a fost marcată plătită."
          executa={() => schimbaStadiulAmenzii({ id: amendaId, stadiu: "platita" })}
        />
      ) : null}
      {poateTrece(stadiu, "anulata") ? (
        <DialogAnulare amendaId={amendaId} numarPv={numarPv} />
      ) : null}
      {stadiu === "primita" ? (
        <ButonConfirmat
          eticheta="Șterge"
          pictograma={<Trash2 aria-hidden="true" className="size-4" />}
          titlu="Ștergeți amenda?"
          consecinta="Ștergeți doar o amendă introdusă din greșeală, încă neatinsă. Una aflată în lucru se anulează, cu motiv."
          etichetaConfirmare="Șterge amenda"
          distructiv
          mesajReusita="Amenda a fost ștearsă."
          dupaReusita="lista"
          executa={() => stergeAmenda({ id: amendaId })}
        />
      ) : null}
    </div>
  );
}
