"use client";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { formatDateTime } from "@/lib/format/date";

import { comunicaAccidentLaItm, finalizeazaCercetare } from "../../actions";

/**
 * Comunicarea la ITM și finalizarea cercetării — două acțiuni distincte în
 * timp, deci două casete.
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
 * ── DE CE CASETE, ȘI DE CE STAREA A DISPĂRUT ──────────────────────────────
 * Ambele formulare se desfăceau în fișa accidentului, iar comunicarea stătea
 * deschisă permanent până la prima salvare. Corectarea avea nevoie de o stare
 * proprie (`corecteaza`) tocmai ca să comute între rândul de rezumat și
 * formular; într-o casetă, comutarea o face deschiderea, deci starea nu mai are
 * ce păzi și a dispărut cu totul.
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
  const comunicat = comunicatLaItm !== null;

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

  return (
    <div className="space-y-4">
      <div className="border-border rounded-panou text-corp flex flex-wrap items-center justify-between gap-3 border p-4">
        {comunicat ? (
          <p>
            Comunicat la ITM pe <strong>{formatDateTime(comunicatLaItm)}</strong>
            {numarProcesVerbal === null ? null : ` · proces-verbal ${numarProcesVerbal}`}
          </p>
        ) : (
          <p className="text-muted-foreground">Accidentul nu a fost încă comunicat la ITM.</p>
        )}

        <FormularDialog
          declansator={{
            eticheta: comunicat ? "Corectează" : "Marchează comunicat",
            varianta: comunicat ? "tertiar" : "primar",
          }}
          titlu={comunicat ? "Corectarea comunicării la ITM" : "Comunicare la ITM"}
          descriere={
            comunicat
              ? "Corectarea trece prin aceeași acțiune ca prima înregistrare, deci lasă aceeași urmă în jurnalul de audit."
              : "Ora se scrie în ora de perete a României, nu în cea a browserului. Numărul procesului-verbal poate fi completat mai târziu, prin „Corectează”."
          }
          marime="mare"
          actiune={comunica}
          mesajReusita={
            comunicat
              ? "Comunicarea la ITM a fost corectată."
              : "Comunicarea la ITM a fost înregistrată."
          }
          etichetaTrimite={comunicat ? "Salvează corectura" : "Marchează comunicat"}
          textInCurs="Se salvează…"
        >
          {(stare, idc) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="comunicat_la_itm_la"
                id={idc("comunicat_la_itm_la")}
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
                id={idc("numar_proces_verbal")}
                eticheta="Număr proces verbal"
                ajutor="Poate lipsi acum și poate fi adăugat când vine de la ITM."
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
            </div>
          )}
        </FormularDialog>
      </div>

      {/* Finalizarea cercetării nu se poate face înaintea comunicării, și nu
          se mai poate face a doua oară — de aceea butonul ei apare doar în
          fereastra dintre cele două stări. */}
      {comunicat && cercetareFinalizata === null ? (
        <FormularDialog
          declansator={{ eticheta: "Finalizează cercetarea", varianta: "primar" }}
          titlu="Finalizarea cercetării"
          descriere="Zilele de incapacitate se pot corecta aici: cifra din declarația inițială e o estimare, iar cea de la finalul cercetării e cea care rămâne în registru."
          marime="mare"
          actiune={finalizeaza}
          mesajReusita="Cercetarea a fost finalizată."
          etichetaTrimite="Finalizează cercetarea"
          textInCurs="Se salvează…"
        >
          {(stare, idc) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="cercetare_finalizata_la"
                id={idc("cercetare_finalizata_la")}
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
                id={idc("zile_incapacitate")}
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
                id={idc("urmari")}
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
            </div>
          )}
        </FormularDialog>
      ) : null}
    </div>
  );
}
