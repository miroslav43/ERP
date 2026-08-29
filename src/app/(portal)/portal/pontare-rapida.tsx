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
  mod,
  intervalPropus,
  numeFirma,
  cereCod,
  lunaDeschisa,
  cod = null,
}: {
  readonly stare: StareCeas;
  readonly mod: string;
  readonly intervalPropus: { readonly inceput: string; readonly sfarsit: string } | null;
  readonly numeFirma: string;
  readonly cereCod: boolean;
  readonly lunaDeschisa: boolean;
  /**
   * Codul de pe afișul scanat. `null` pe ecranul de start; nenul pe
   * `/portal/ponteaza/[cod]`, unde omul tocmai a scanat.
   *
   * NU e o dovadă în sine: acțiunea îl rezolvă din nou pe server, cu filtru pe
   * organizație. Aici e doar transportat.
   */
  readonly cod?: string | null;
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

  if (stare.fel === "alta_sursa") return null;

  // Luna închisă: refuzul se dă AICI, nu după drumul la server. Ecranul de start
  // n-a citit niciodată perioada, deci oferea „Completează ziua” și pe o lună
  // blocată — o atingere aruncată, urmată de o eroare fără vină.
  if (!lunaDeschisa) {
    return (
      <p className="text-muted-foreground text-corp mt-2">
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
  if (cereCod && cod === null) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-muted-foreground text-corp">
          Firma cere scanarea codului de la punctul de lucru.
        </p>
        <Link href="/portal/ponteaza" className={cn(buton({ varianta: "primar" }), "w-full")}>
          <QrCode aria-hidden="true" className="size-4" />
          Cum se scanează
        </Link>
      </div>
    );
  }

  const poateCeas = mod === "ceas" || mod === "ambele";
  const poateConfirma = (mod === "confirmare" || mod === "ambele") && intervalPropus !== null;

  return (
    <div className="mt-3 space-y-3">
      {stare.fel === "in_curs" ? (
        <>
          <p className="text-foreground text-corp">
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
            className="w-full"
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
        <p className="text-muted-foreground text-corp">
          Ziua e pontată:{" "}
          <span className="text-foreground tabular-nums">
            {stare.oraInceput}–{stare.oraSfarsit}
          </span>
        </p>
      ) : (
        <>
          {poateCeas ? (
            <Buton
              varianta="primar"
              className="w-full"
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
              className="w-full"
              inCurs={inCurs}
              textInCurs="Se înregistrează…"
              onClick={() => {
                ruleaza(() => confirmaZiuaStandard({ cod_punct_lucru: cod }));
              }}
            >
              Pontez {intervalPropus.inceput}–{intervalPropus.sfarsit}
            </Buton>
          ) : null}
          <p className="text-muted-foreground text-nota">la {numeFirma}</p>
        </>
      )}

      {eroare === null ? null : (
        <p
          role="alert"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-3"
        >
          {eroare}
        </p>
      )}
    </div>
  );
}
