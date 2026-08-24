"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { formatDateTime } from "@/lib/format/date";

import { comunicaAccidentLaItm, finalizeazaCercetare } from "../../actions";

/**
 * Comunicarea la ITM și finalizarea cercetării — două acțiuni distincte în
 * timp, deci două formulare.
 *
 * ── FUNDĂTURA CARE S-A ÎNCHIS ─────────────────────────────────────────────
 * Formularul de comunicare se randa doar cât timp `comunicatLaItm === null` și
 * DISPĂREA definitiv după prima salvare. Într-un registru legal asta înseamnă
 * că o oră tastată greșit — 14:20 în loc de 04:20, la un câmp
 * `datetime-local` — nu se mai putea corecta din aplicație deloc, iar numărul
 * procesului-verbal primit ulterior de la ITM nu se mai putea adăuga. Acțiunea
 * `ssm.accident.communicateItm` face de la bun început un UPDATE, deci putea
 * corecta; ecranul era cel care refuza.
 *
 * Acum rândul comunicat rămâne vizibil, cu ora lui, și are „Corectează" pentru
 * cine are `ssm:update`. Corectarea trece prin aceeași acțiune, deci lasă
 * aceeași urmă în `audit_logs` — nu e o portiță, e drumul obișnuit parcurs a
 * doua oară.
 *
 * ── DE CE SE RECALCULEAZĂ VALOAREA PENTRU `datetime-local` ────────────────
 * Coloana e `timestamptz`; controlul cere `AAAA-LL-ZZTHH:MM` în ora de perete.
 * Conversia se face cu `timeZone: "Europe/Bucharest"` fixat, nu cu ora
 * browserului: un responsabil aflat în altă țară ar fi văzut, altfel, altă oră
 * decât cea comunicată la ITM.
 */
const formatorLocal = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function pentruDatetimeLocal(iso: string): string {
  const parti = formatorLocal.formatToParts(new Date(iso));
  const ia = (tip: string): string => {
    const valoare = parti.find((p) => p.type === tip)?.value ?? "00";
    // Unele versiuni de ICU întorc „24" pentru miezul nopții.
    return tip === "hour" && valoare === "24" ? "00" : valoare;
  };
  return `${ia("year")}-${ia("month")}-${ia("day")}T${ia("hour")}:${ia("minute")}`;
}

export function FormularComunicareItm({
  id,
  comunicatLaItm,
  numarProcesVerbal,
  cercetareFinalizata,
  zileIncapacitate,
}: {
  readonly id: string;
  readonly comunicatLaItm: string | null;
  readonly numarProcesVerbal: string | null;
  readonly cercetareFinalizata: string | null;
  readonly zileIncapacitate: number;
}) {
  const router = useRouter();
  const [corecteaza, setCorecteaza] = useState(false);

  const laReusita = useCallback(() => {
    setCorecteaza(false);
    router.refresh();
  }, [router]);

  async function comunica(formular: FormData) {
    const numar = String(formular.get("numar_proces_verbal") ?? "").trim();
    return await comunicaAccidentLaItm({
      id,
      comunicat_la_itm_la: String(formular.get("comunicat_la_itm_la") ?? ""),
      numar_proces_verbal: numar.length > 0 ? numar : null,
    });
  }

  async function finalizeaza(formular: FormData) {
    const urmari = String(formular.get("urmari") ?? "").trim();
    return await finalizeazaCercetare({
      id,
      cercetare_finalizata_la: String(formular.get("cercetare_finalizata_la") ?? ""),
      urmari: urmari.length > 0 ? urmari : null,
      zile_incapacitate: Number(formular.get("zile_incapacitate") ?? 0),
    });
  }

  const arataComunicarea = comunicatLaItm === null || corecteaza;

  return (
    <div className="space-y-4">
      {comunicatLaItm !== null && !corecteaza ? (
        <div className="border-border rounded-panou text-corp flex flex-wrap items-center justify-between gap-3 border p-4">
          <p>
            Comunicat la ITM pe <strong>{formatDateTime(comunicatLaItm)}</strong>
            {numarProcesVerbal === null ? null : ` · proces-verbal ${numarProcesVerbal}`}
          </p>
          <Buton
            varianta="tertiar"
            onClick={() => {
              setCorecteaza(true);
            }}
          >
            Corectează
          </Buton>
        </div>
      ) : null}

      {arataComunicarea ? (
        <Formular
          actiune={comunica}
          laReusita={laReusita}
          mesajReusita={
            comunicatLaItm === null
              ? "Comunicarea la ITM a fost înregistrată."
              : "Comunicarea la ITM a fost corectată."
          }
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
        >
          {(stare) => (
            <>
              <p className="text-corp font-medium sm:col-span-2">
                {comunicatLaItm === null ? "Comunicare la ITM" : "Corectarea comunicării la ITM"}
              </p>

              <Camp
                nume="comunicat_la_itm_la"
                eticheta="Comunicat la"
                obligatoriu
                erori={stare.erori["comunicat_la_itm_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="datetime-local"
                    defaultValue={
                      stare.valoriTrimise["comunicat_la_itm_la"] ??
                      (comunicatLaItm === null ? "" : pentruDatetimeLocal(comunicatLaItm))
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="numar_proces_verbal"
                eticheta="Număr proces verbal (opțional)"
                erori={stare.erori["numar_proces_verbal"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    maxLength={64}
                    defaultValue={
                      stare.valoriTrimise["numar_proces_verbal"] ?? numarProcesVerbal ?? ""
                    }
                  />
                )}
              </Camp>

              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Buton
                  type="submit"
                  varianta="primar"
                  inCurs={stare.inCurs}
                  textInCurs="Se salvează…"
                >
                  {comunicatLaItm === null ? "Marchează comunicat" : "Salvează corectura"}
                </Buton>
                {comunicatLaItm === null ? null : (
                  <Buton
                    varianta="secundar"
                    disabled={stare.inCurs}
                    onClick={() => {
                      setCorecteaza(false);
                    }}
                  >
                    Renunță
                  </Buton>
                )}
              </div>
            </>
          )}
        </Formular>
      ) : null}

      {comunicatLaItm === null || cercetareFinalizata !== null ? null : (
        <Formular
          actiune={finalizeaza}
          laReusita={laReusita}
          mesajReusita="Cercetarea a fost finalizată."
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
        >
          {(stare) => (
            <>
              <p className="text-corp font-medium sm:col-span-2">Finalizarea cercetării</p>

              <Camp
                nume="cercetare_finalizata_la"
                eticheta="Cercetare finalizată la"
                obligatoriu
                erori={stare.erori["cercetare_finalizata_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={stare.valoriTrimise["cercetare_finalizata_la"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="zile_incapacitate"
                eticheta="Zile de incapacitate (corectate)"
                erori={stare.erori["zile_incapacitate"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min={0}
                    defaultValue={stare.valoriTrimise["zile_incapacitate"] ?? zileIncapacitate}
                  />
                )}
              </Camp>

              <Camp
                nume="urmari"
                eticheta="Urmări"
                fel="textarea"
                className="sm:col-span-2"
                erori={stare.erori["urmari"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={3}
                    maxLength={2000}
                    defaultValue={stare.valoriTrimise["urmari"] ?? ""}
                  />
                )}
              </Camp>

              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Buton
                  type="submit"
                  varianta="primar"
                  inCurs={stare.inCurs}
                  textInCurs="Se salvează…"
                >
                  Finalizează cercetarea
                </Buton>
              </div>
            </>
          )}
        </Formular>
      )}
    </div>
  );
}
