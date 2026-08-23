"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";

import {
  aprobaPerioada,
  calculeazaPerioada,
  inchidePerioada,
  redeschidePerioada,
  trimiteFluturasii,
} from "../actions";

interface Proprietati {
  readonly id: string;
  readonly status: string;
  readonly poateCalcula: boolean;
  readonly poateModifica: boolean;
  readonly poateAproba: boolean;
  readonly poateExporta: boolean;
  /**
   * De ce nu se poate calcula acum, dacă nu se poate. Serverul refuză oricum
   * (angajați fără contract, citire trunchiată), dar refuzul vine DUPĂ clic,
   * într-un mesaj de eroare; motivul scris lângă buton îl arată înainte.
   */
  readonly blocajCalcul?: string | null;
  /** Cifrele arătate în confirmări: câți oameni și cât se plătește. */
  readonly rezumat: Readonly<{
    perioada: string;
    angajati: number;
    totalNet: string;
    totalBrut: string;
  }>;
}

/** Care dintre acțiunile cu urmări așteaptă confirmare. */
type ActiuneDeConfirmat = "aproba" | "inchide" | "trimite" | "redeschide";

/**
 * Un singur buton vizibil per stare, ca să nu existe cale de a apăsa
 * „Aprobă” pe o ciornă necalculată — gardat oricum de trigger, dar butonul
 * ascuns evită round-trip-ul inutil și mesajul confuz.
 */
export function ActiuniPerioada({
  id,
  status,
  poateCalcula,
  poateModifica,
  poateAproba,
  poateExporta,
  blocajCalcul = null,
  rezumat,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [raportTrimitere, setRaportTrimitere] = useState<string | null>(null);
  /*
   * Cele trei acțiuni ireversibile ale ecranului. Produsul avea ZERO confirmări
   * pentru douăzeci de acțiuni ireversibile, iar astea trei sunt cele mai
   * costisitoare din tot modulul:
   *   · aprobarea închide intrările pentru modificare;
   *   · închiderea lunii nu se mai poate desface;
   *   · trimiterea fluturașilor pleacă prin e-mail către fiecare angajat, iar
   *     un e-mail plecat nu se retrage. Aceasta cere și TASTAREA lunii, nu doar
   *     un clic: e singura din cele trei care iese din sistem.
   */
  const [deConfirmat, setDeConfirmat] = useState<ActiuneDeConfirmat | null>(null);

  /**
   * Trimiterea fluturașilor nu folosește `ruleaza`: are un rezultat de raportat
   * — câți au plecat, câți n-au adresă, câți au eșuat. Un „gata” fără cifre ar
   * ascunde exact cazul care contează, cel al angajatului rămas fără fluturaș.
   */
  function trimite(): void {
    setEroare(null);
    setRaportTrimitere(null);
    porneste(async () => {
      const rezultat = await trimiteFluturasii({ id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      const { trimise, faraAdresa, esuate } = rezultat.data;
      const parti = [`${String(trimise)} trimise`];
      if (faraAdresa > 0) parti.push(`${String(faraAdresa)} fără adresă de e-mail`);
      if (esuate > 0) parti.push(`${String(esuate)} eșuate`);
      setRaportTrimitere(`Fluturași: ${parti.join(", ")}.`);
      router.refresh();
    });
  }

  function ruleaza(actiune: () => Promise<{ ok: boolean; error?: { message: string } }>): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await actiune();
      if (!rezultat.ok) {
        setEroare(rezultat.error?.message ?? "A apărut o eroare.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "draft" && poateCalcula ? (
        <>
          <Buton
            varianta="primar"
            inCurs={inCurs}
            textInCurs="Se calculează…"
            disabled={blocajCalcul !== null}
            onClick={() => {
              ruleaza(() => calculeazaPerioada({ id }));
            }}
          >
            Calculează
          </Buton>
          {blocajCalcul === null ? null : (
            <p className="text-muted-foreground text-corp">{blocajCalcul}</p>
          )}
        </>
      ) : null}

      {status === "calculat" && poateModifica ? (
        <Buton
          varianta="secundar"
          inCurs={inCurs}
          textInCurs="Se redeschide…"
          onClick={() => {
            setDeConfirmat("redeschide");
          }}
        >
          Redeschide pentru corecții
        </Buton>
      ) : null}

      {status === "calculat" && poateAproba ? (
        <Buton
          varianta="primar"
          inCurs={inCurs}
          textInCurs="Se aprobă…"
          onClick={() => {
            setDeConfirmat("aproba");
          }}
        >
          Aprobă
        </Buton>
      ) : null}

      {status === "aprobat" && poateAproba ? (
        <Buton
          varianta="secundar"
          inCurs={inCurs}
          textInCurs="Se închide…"
          onClick={() => {
            setDeConfirmat("inchide");
          }}
        >
          Închide perioada
        </Buton>
      ) : null}

      {(status === "aprobat" || status === "inchis") && poateExporta ? (
        <Buton
          varianta="secundar"
          inCurs={inCurs}
          textInCurs="Se trimit…"
          onClick={() => {
            setDeConfirmat("trimite");
          }}
        >
          Trimite fluturașii pe e-mail
        </Buton>
      ) : null}

      {raportTrimitere === null ? null : (
        <p aria-live="polite" className="text-muted-foreground text-corp w-full">
          {raportTrimitere}
        </p>
      )}

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-corp w-full">
          {eroare}
        </p>
      )}

      <ConfirmareActiune
        deschis={deConfirmat === "redeschide"}
        laInchidere={() => {
          setDeConfirmat(null);
        }}
        titlu="Redeschideți perioada pentru corecții?"
        consecinta="Perioada se întoarce în ciornă: primele și reținerile se pot corecta, iar aprobarea rămâne blocată până la un nou calcul. Fluturașii deja scriși rămân în bază, dar ies din ecran până la recalculare, când se REGENEREAZĂ integral — orice verificare făcută pe ei se reia."
        cifre={[
          { eticheta: "Perioada", valoare: rezumat.perioada },
          { eticheta: "Fluturași care se regenerează", valoare: String(rezumat.angajati) },
        ]}
        etichetaConfirmare="Redeschide perioada"
        inCurs={inCurs}
        laConfirmare={() => {
          setDeConfirmat(null);
          ruleaza(() => redeschidePerioada({ id }));
        }}
      />

      <ConfirmareActiune
        deschis={deConfirmat === "aproba"}
        laInchidere={() => {
          setDeConfirmat(null);
        }}
        titlu="Aprobați statul de plată?"
        consecinta="După aprobare, intrările nu se mai pot modifica și perioada nu se mai poate recalcula. Corecțiile cer o perioadă nouă."
        cifre={[
          { eticheta: "Perioada", valoare: rezumat.perioada },
          { eticheta: "Angajați", valoare: String(rezumat.angajati) },
          { eticheta: "Total net", valoare: rezumat.totalNet },
        ]}
        etichetaConfirmare="Aprobă statul"
        inCurs={inCurs}
        laConfirmare={() => {
          setDeConfirmat(null);
          ruleaza(() => aprobaPerioada({ id }));
        }}
      />

      <ConfirmareActiune
        deschis={deConfirmat === "inchide"}
        laInchidere={() => {
          setDeConfirmat(null);
        }}
        titlu="Închideți luna?"
        consecinta="Luna închisă nu se mai poate redeschide. Pontajul, primele și reținerile ei rămân fixate așa cum sunt acum."
        cifre={[
          { eticheta: "Perioada", valoare: rezumat.perioada },
          { eticheta: "Angajați", valoare: String(rezumat.angajati) },
          { eticheta: "Total brut", valoare: rezumat.totalBrut },
        ]}
        etichetaConfirmare="Închide luna"
        distructiv
        inCurs={inCurs}
        laConfirmare={() => {
          setDeConfirmat(null);
          ruleaza(() => inchidePerioada({ id }));
        }}
      />

      <ConfirmareActiune
        deschis={deConfirmat === "trimite"}
        laInchidere={() => {
          setDeConfirmat(null);
        }}
        titlu="Trimiteți fluturașii pe e-mail?"
        consecinta="Fiecare angajat cu adresă de e-mail primește fluturașul lui. Un e-mail plecat nu se mai poate retrage, iar retrimiterea nu îl șterge pe cel de dinainte."
        cifre={[
          { eticheta: "Perioada", valoare: rezumat.perioada },
          { eticheta: "Destinatari", valoare: String(rezumat.angajati) },
        ]}
        etichetaConfirmare="Trimite fluturașii"
        // Singura dintre cele trei care iese din sistem: cere tastarea lunii,
        // nu doar un clic. Un dublu-clic pe „Trimite" nu poate declanșa asta.
        cereTastare={rezumat.perioada}
        inCurs={inCurs}
        laConfirmare={() => {
          setDeConfirmat(null);
          trimite();
        }}
      />
    </div>
  );
}
