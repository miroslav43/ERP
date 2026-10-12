"use client";

import { useState, useTransition } from "react";
import { Mail, Printer, UserPlus } from "lucide-react";

import { invitaAngajatul } from "@/app/(app)/angajati/actions";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import { formatZiuaMomentului } from "@/lib/format/date";

/**
 * Invitarea unui angajat existent, cu fișa tipăribilă pentru cei fără e-mail.
 *
 * ── DE CE REZULTATUL NU SE POATE RANDA MAI TÂRZIU ───────────────────────────
 * Tokenul invitației există în clar o SINGURĂ dată, în răspunsul acțiunii — în
 * bază stă doar hash-ul lui. Deci fișa se tipărește ACUM sau deloc; o pagină
 * separată, deschisă peste cinci minute, n-ar avea de unde să ia linkul. De
 * aceea panoul rămâne pe ecran până la o navigare, cu un avertisment explicit.
 *
 * ── DE CE CODUL QR VINE GATA DESENAT DE PE SERVER ───────────────────────────
 * Acțiunea întoarce SVG-ul. Alternativa — o bibliotecă de QR în bundle-ul de
 * client — ar adăuga vreo 50 KB pe o pagină deschisă zilnic, pentru un buton
 * apăsat o dată în viața unui angajat.
 *
 * ── DE CE CONFIRMARE, ȘI CU ADRESA ÎN EA ────────────────────────────────────
 * Invitația se emitea la un singur clic (QA oct 2026, HR-034): un e-mail
 * plecat nu se mai retrage, iar pentru fișa fără adresă se creează un
 * utilizator sintetic pe loc. `adresaPrevazuta` e calculată pe server cu
 * aceeași regulă ca acțiunea (`alegeAdresaDeInvitatie`), ca omul să vadă
 * ÎNAINTE pe ce adresă pleacă și dacă va avea de tipărit o foaie.
 *
 * ── DE CE `formatZiuaMomentului`, NU `toLocaleDateString` ──────────────────
 * Expirarea e un `timestamptz`; formatată în fusul serverului (UTC) arăta
 * „15.10” pentru un link valabil până pe „16.10 00:05” ora României — și cu
 * riscul unui text diferit între server și browser la hidratare.
 */

type Rezultat = Readonly<{
  adresa: string;
  fel: "personala" | "serviciu" | "sintetica";
  emailTrimis: boolean;
  retrimisa: boolean;
  link: string;
  qr: string;
  expiraLa: string;
}>;

/** Invitația deja plecată, dacă mai e în așteptare. */
export type InvitatiePendinte = Readonly<{ adresa: string; expiraLa: string }>;

/** Pe ce adresă AR pleca invitația — decisă pe server, cu regula acțiunii. */
export type AdresaPrevazuta = Readonly<{
  adresa: string;
  fel: "personala" | "serviciu" | "sintetica";
}>;

function consecintaInvitatiei(adresa: AdresaPrevazuta, retrimitere: boolean): string {
  const emitere =
    adresa.fel === "sintetica"
      ? `Fișa n-are e-mail: se creează utilizatorul ${adresa.adresa} și o fișă de tipărit, care apare o singură dată pe ecran.`
      : `Se trimite un e-mail cu link de activare pe ${adresa.adresa}, valabil 7 zile.`;
  return retrimitere ? `${emitere} Linkul trimis anterior nu va mai funcționa.` : emitere;
}

export function InvitatieAngajat({
  employeeId,
  numeAngajat,
  numeFirma,
  pendinte,
  adresaPrevazuta,
}: {
  readonly employeeId: string;
  readonly numeAngajat: string;
  readonly numeFirma: string;
  readonly pendinte: InvitatiePendinte | null;
  readonly adresaPrevazuta: AdresaPrevazuta;
}) {
  const [rezultat, setRezultat] = useState<Rezultat | null>(null);
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  function invita(): void {
    porneste(async () => {
      const raspuns = await invitaAngajatul({ id: employeeId });
      if (!raspuns.ok) {
        // Caseta rămâne deschisă: refuzul se citește cu adresa în față.
        arataToast({ fel: "eroare", text: raspuns.error.message });
        return;
      }
      setDeschis(false);
      setRezultat(raspuns.data);
    });
  }

  if (rezultat === null) {
    const retrimitere = pendinte !== null;
    return (
      <div className="space-y-2">
        <Buton
          varianta="secundar"
          onClick={() => {
            setDeschis(true);
          }}
        >
          <UserPlus aria-hidden="true" className="size-4" />
          {retrimitere ? "Retrimite invitația" : "Invită în aplicație"}
        </Buton>
        {pendinte === null ? (
          <p className="text-muted-foreground text-nota">
            Dacă fișa n-are e-mail, se creează un nume de utilizator și o fișă de tipărit.
          </p>
        ) : (
          /*
           * Starea invitației plecate deja, scrisă înainte de apăsare.
           *
           * Fără ea, singurul semn că invitația există era un refuz DUPĂ apăsare
           * — „Există deja o invitație în așteptare pentru această adresă." —
           * dintr-un buton care se numea „Invită în aplicație". Acum butonul
           * spune ce face, iar rândul de sub el spune de ce.
           */
          <p className="text-muted-foreground text-nota">
            Invitație trimisă pe <strong className="font-medium">{pendinte.adresa}</strong>, încă
            neacceptată, valabilă până pe {formatZiuaMomentului(pendinte.expiraLa)}. Retrimiterea
            emite un link nou; cel vechi nu mai funcționează.
          </p>
        )}
        <ConfirmareActiune
          deschis={deschis}
          laInchidere={() => {
            setDeschis(false);
          }}
          titlu={retrimitere ? "Retrimiteți invitația?" : `Invitați ${numeAngajat} în aplicație?`}
          consecinta={consecintaInvitatiei(adresaPrevazuta, retrimitere)}
          etichetaConfirmare={retrimitere ? "Retrimite" : "Invită"}
          inCurs={inCurs}
          laConfirmare={invita}
        />
      </div>
    );
  }

  const expira = formatZiuaMomentului(rezultat.expiraLa);

  return (
    <div className="space-y-3">
      {rezultat.fel === "sintetica" ? (
        <Callout fel="atentie" titlu="Tipăriți fișa acum" className="print:hidden">
          Angajatul n-are adresă de e-mail, deci nu i s-a trimis niciun mesaj. Linkul de mai jos
          apare o singură dată — dacă închideți pagina fără să tipăriți, invitația trebuie refăcută.
        </Callout>
      ) : (
        <Callout
          fel={rezultat.emailTrimis ? "informativ" : "atentie"}
          titlu={
            rezultat.emailTrimis
              ? rezultat.retrimisa
                ? "Invitația a fost retrimisă"
                : "Invitația a plecat"
              : "E-mailul nu a putut fi trimis"
          }
          className="print:hidden"
        >
          <span className="flex items-center gap-1.5">
            <Mail aria-hidden="true" className="size-4 shrink-0" />
            {rezultat.adresa}
          </span>
          {/* Tokenul vechi a murit în clipa retrimiterii — în bază stă un singur
              hash per invitație. Cine tipărise fișa dinainte trebuie s-o
              tipărească din nou, altfel omul scanează un cod mort. */}
          {rezultat.retrimisa ? " Linkul trimis anterior nu mai este valabil." : null}
          {rezultat.emailTrimis ? null : " Tipăriți fișa de mai jos sau copiați linkul."}
        </Callout>
      )}

      {/* Fișa propriu-zisă. Alb pe negru și fără chrome la tipărire: hârtia se dă
          în mână unui om, nu se citește de la trei metri ca afișul de pontare. */}
      <div className="border-border rounded-panou space-y-4 border bg-white p-6 text-black">
        <div>
          <p className="text-lg font-semibold">Acces în aplicație</p>
          <p className="text-sm">
            {numeAngajat} · {numeFirma}
          </p>
        </div>

        <div
          aria-label="Cod QR cu linkul de activare"
          className="mx-auto w-full max-w-[14rem] [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: rezultat.qr }}
        />

        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Scanați codul cu camera telefonului sau deschideți adresa de mai jos.</li>
          <li>Alegeți-vă o parolă. Atât.</li>
          <li>
            Pe viitor vă autentificați cu <strong className="break-all">{rezultat.adresa}</strong>{" "}
            și parola aleasă.
          </li>
        </ol>

        <div className="space-y-1 text-xs">
          <p className="break-all">{rezultat.link}</p>
          <p>Linkul expiră pe {expira}.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Buton
          varianta="primar"
          onClick={() => {
            window.print();
          }}
        >
          <Printer aria-hidden="true" className="size-4" />
          Tipărește fișa
        </Buton>
        <Buton
          varianta="secundar"
          onClick={() => {
            void navigator.clipboard.writeText(rezultat.link);
          }}
        >
          Copiază linkul
        </Buton>
      </div>
    </div>
  );
}
