"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LogIn, LogOut, QrCode } from "lucide-react";

import { confirmaZiuaStandard, pontezaIesirea, pontezaIntrarea } from "@/app/(app)/pontaj/actions";
import { Buton } from "@/components/ui/buton";
import { buton } from "@/components/ui/buton";
import { cn } from "@/lib/ui/cn";
import { formatDurata, minuteScurse, type StareCeas } from "@/domain/attendance/ceas";
import { cePoateFace, type ConfigPontareRapida } from "@/domain/attendance/pontare-rapida";

/**
 * Pontarea zilei de azi, dintr-o atingere, pe ecranul de start al portalului.
 *
 * ── CE E PE SERVER ȘI CE E AICI ─────────────────────────────────────────────
 * Tot ce se SCRIE vine de pe server: ora e ceasul serverului, orele se derivă
 * din setările organizației, fișa se rezolvă din sesiune. Componenta asta nu
 * trimite nicio cifră — acțiunile nici n-ar accepta-o.
 *
 * Singurul lucru pe care ceasul telefonului îl atinge e DURATA AFIȘATĂ, care se
 * împrospătează din minut în minut ca să nu înghețe la valoarea de la
 * încărcarea paginii. Un telefon cu ora greșită arată o durată greșită; nu poate
 * scrie o oră greșită. Împărțirea asta e deliberată și merită păstrată.
 *
 * ── DE CE APARE NUMELE FIRMEI PE BUTON ──────────────────────────────────────
 * Produsul e multi-tenant și portalul are comutator de firmă în meniul de cont.
 * Un buton care scrie în pontaj fără să spună UNDE scrie e un accident care
 * așteaptă primul angajat cu două locuri de muncă în același sistem.
 */
export function PontareRapida({
  stare,
  pontare,
  intervalPropus,
  numeFirma,
  lunaDeschisa,
  cod = null,
  inversat = false,
}: {
  readonly stare: StareCeas;
  /**
   * Configurația firmei, cu implicitele deja aplicate de `configPontareRapida`.
   *
   * Un singur obiect în locul perechii `mod` + `cereCod`: cele două se citeau
   * din aceeași sursă și se recompuneau în trei pagini, iar regula „ce butoane
   * se desenează" ajunsese scrisă de patru ori. Aici se pune o singură
   * întrebare, lui `cePoateFace`.
   */
  readonly pontare: ConfigPontareRapida;
  readonly intervalPropus: { readonly inceput: string; readonly sfarsit: string } | null;
  readonly numeFirma: string;
  readonly lunaDeschisa: boolean;
  /**
   * Codul de pe afișul scanat. `null` pe ecranul de start; nenul pe
   * `/portal/ponteaza/[cod]`, unde omul tocmai a scanat.
   *
   * NU e o dovadă în sine: acțiunea îl rezolvă din nou pe server, cu filtru pe
   * organizație. Aici e doar transportat.
   */
  readonly cod?: string | null;
  /**
   * Componenta stă pe un card `bg-primary`, nu pe fundalul obișnuit.
   *
   * Nu e o temă și nu e o variantă nouă de buton: e aceeași inversare pe care o
   * face de mult cardul de sold de concediu din `page.tsx` — pe navy, un
   * `varianta="primar"` (tot navy) dispare în fundal. Aici trebuie declarată,
   * fiindcă butoanele sunt înăuntru, nu în cardul care le poartă.
   *
   * Implicit `false`, deci `/portal/ceas` și `/portal/ponteaza/[cod]` — care
   * randează pe fundal obișnuit — rămân neatinse.
   */
  readonly inversat?: boolean;
}) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const oraInceput = stare.fel === "in_curs" ? stare.oraInceput : null;
  const [minute, setMinute] = useState<number | null>(
    stare.fel === "in_curs" ? stare.minute : null,
  );

  /*
   * Ceasul viu. `setState` stă în callback-ul intervalului, nu în corpul
   * efectului — un `setState` sincron acolo ar declanșa o randare în cascadă
   * imediat după hidratare (`react-hooks/set-state-in-effect`).
   *
   * Prima valoare vine de la server, deci randarea de pe server și hidratarea
   * coincid; abia de la primul minut încolo ceasul devine al telefonului.
   */
  useEffect(() => {
    if (oraInceput === null) return;
    const ceas = setInterval(() => {
      const acum = new Date();
      const hh = String(acum.getHours()).padStart(2, "0");
      const mm = String(acum.getMinutes()).padStart(2, "0");
      setMinute(minuteScurse(oraInceput, `${hh}:${mm}`));
    }, 30_000);
    return () => {
      clearInterval(ceas);
    };
  }, [oraInceput]);

  function ruleaza(actiune: () => Promise<{ ok: boolean; error?: { message: string } }>): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await actiune();
      if (!rezultat.ok) {
        setEroare(rezultat.error?.message ?? "Pontarea nu a reușit.");
        return;
      }
      router.refresh();
    });
  }

  /*
   * `areAfis: false` nu e o presupunere, ci o consecință de RLS: politica
   * `puncte_lucru_select` (0030) cere `departments:read`, pe care rolul
   * `employee` nu-l are, deci portalul NU poate ști dacă firma are afiș tipărit.
   *
   * Și nici nu-i trebuie. Cu `optional`, afișul se scanează din aplicația de
   * cameră a telefonului, direct de pe perete — nu prin ecranul ăsta. Un îndemn
   * „scanați afișul" desenat aici ar apărea la fiecare firmă neconfigurată,
   * fiindcă `optional` e implicitul, și ar arăta spre un perete gol.
   * `oferaScanare` rămâne pentru ecranul de setări, unde afișele CHIAR se pot
   * citi.
   */
  const posibilitati = cePoateFace(pontare, false);

  if (stare.fel === "alta_sursa") return null;

  /*
   * Cele patru inversări. Se calculează o dată, ca să nu se strecoare un
   * `text-muted-foreground` rămas neinversat pe navy — culoarea aia are 3,1:1
   * pe crem și sub 2:1 pe primar, adică text pe care nu-l vede nimeni.
   *
   * `cn` face merge semantic, nu concatenare: `bg-primary-foreground` scris
   * după baza `bg-primary` chiar o ÎNLOCUIEȘTE. Fără tailwind-merge, ambele ar
   * ajunge în atribut și câștigătoarea ar fi decisă de ordinea din foaia de
   * stil, nu de a noastră.
   */
  const clasaPrimar = inversat
    ? "bg-primary-foreground text-primary hover:bg-primary-foreground"
    : "";
  const clasaSecundar = inversat
    ? "border-primary-foreground/60 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
    : "";
  const clasaSecundara = inversat ? "text-primary-foreground/80" : "text-muted-foreground";
  const clasaText = inversat ? "text-primary-foreground" : "text-foreground";

  // Luna închisă: refuzul se dă AICI, nu după drumul la server. Ecranul de start
  // n-a citit niciodată perioada, deci oferea „Completează ziua” și pe o lună
  // blocată — o atingere aruncată, urmată de o eroare fără vină.
  if (!lunaDeschisa) {
    return (
      <p className={cn("text-corp mt-2", clasaSecundara)}>
        Luna nu este deschisă pentru pontaj. Pentru o corectură, întrebați responsabilul de pontaj.
      </p>
    );
  }

  /*
   * Cu verificare prin cod QR, butonul NU scrie: trimite la scanare. Codul se
   * rezolvă pe server, iar afișul e la intrarea în punctul de lucru — asta e
   * toată ideea. Telefoanele scanează codul din aplicația de cameră, deci nu e
   * nevoie de niciun scaner în aplicație.
   */
  if (posibilitati.cereScanare && cod === null) {
    return (
      <div className="mt-3 space-y-2">
        <p className={cn("text-corp", clasaSecundara)}>
          Firma cere scanarea codului de la punctul de lucru.
        </p>
        <Link
          href="/portal/ponteaza"
          className={cn(buton({ varianta: "primar" }), "w-full", clasaPrimar)}
        >
          <QrCode aria-hidden="true" className="size-4" />
          Cum se scanează
        </Link>
      </div>
    );
  }

  const poateCeas = posibilitati.poateCeas;
  const poateConfirma = posibilitati.poateConfirma && intervalPropus !== null;

  return (
    <div className="mt-3 space-y-3">
      {stare.fel === "in_curs" ? (
        <>
          <p className={cn("text-corp", clasaText)}>
            Sunteți pontat de la{" "}
            <span className="text-titlu font-semibold tabular-nums">{stare.oraInceput}</span>
            {minute === null ? null : (
              <>
                {" · "}
                <span className="tabular-nums">{formatDurata(minute)}</span>
              </>
            )}
          </p>
          <Buton
            varianta="primar"
            className={cn("w-full", clasaPrimar)}
            inCurs={inCurs}
            textInCurs="Se înregistrează…"
            onClick={() => {
              ruleaza(() => pontezaIesirea({ cod_punct_lucru: cod }));
            }}
          >
            <LogOut aria-hidden="true" className="size-4" />
            Am ieșit
          </Buton>
        </>
      ) : stare.fel === "incheiata" ? (
        <p className={cn("text-corp", clasaSecundara)}>
          Ziua e pontată:{" "}
          <span className={cn("tabular-nums", clasaText)}>
            {stare.oraInceput}–{stare.oraSfarsit}
          </span>
        </p>
      ) : (
        <>
          {poateCeas ? (
            <Buton
              varianta="primar"
              className={cn("w-full", clasaPrimar)}
              inCurs={inCurs}
              textInCurs="Se înregistrează…"
              onClick={() => {
                ruleaza(() => pontezaIntrarea({ cod_punct_lucru: cod }));
              }}
            >
              <LogIn aria-hidden="true" className="size-4" />
              Am intrat
            </Buton>
          ) : null}
          {poateConfirma && intervalPropus !== null ? (
            <Buton
              varianta={poateCeas ? "secundar" : "primar"}
              className={cn("w-full", poateCeas ? clasaSecundar : clasaPrimar)}
              inCurs={inCurs}
              textInCurs="Se înregistrează…"
              onClick={() => {
                ruleaza(() => confirmaZiuaStandard({ cod_punct_lucru: cod }));
              }}
            >
              Pontez {intervalPropus.inceput}–{intervalPropus.sfarsit}
            </Buton>
          ) : null}
          <p className={cn("text-nota", clasaSecundara)}>la {numeFirma}</p>
        </>
      )}

      {eroare === null ? null : (
        /*
         * Pe fundal plin, caseta de eroare se OPACIZEAZĂ: `bg-danger/10` peste
         * navy e o pată invizibilă, iar `text-foreground` (aproape negru) pe ea
         * nu se citește deloc. Inversat, mesajul stă pe crem — același contrast
         * ca oriunde altundeva în aplicație.
         */
        <p
          role="alert"
          className={cn(
            "rounded-control text-corp border p-3",
            inversat
              ? "border-danger bg-primary-foreground text-danger"
              : "border-danger/40 bg-danger/10 text-foreground",
          )}
        >
          {eroare}
        </p>
      )}
    </div>
  );
}
