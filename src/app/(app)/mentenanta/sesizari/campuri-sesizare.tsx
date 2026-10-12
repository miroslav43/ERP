"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp, clasaBifa } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import { URGENTE_SESIZARE } from "@/schemas/maintenance";

import { cautaEchipament, type EchipamentCautat } from "../actions";
import { ETICHETE_URGENTA_SESIZARE } from "../etichete";

const PRAG_CAUTARE = 300;

export interface ProprietatiCampuriSesizare<TData> {
  readonly stare: StareFormular<TData>;
  readonly idc: (sufix: string) => string;
  /** Echipamentul rezolvat pe SERVER din `?echipament=` (autocolantul QR), sau `null`. */
  readonly echipamentPrefill: EchipamentCautat | null;
  /** `?echipament=` a existat, dar n-a dus la niciun echipament activ. */
  readonly prefillEsuat: boolean;
  /** `/mentenanta/sesizari` sau `/portal/sesizari` — pentru linkul din avertismentul de duplicat. */
  readonly radacinaSesizari: string;
}

/**
 * Câmpurile sesizării de defecțiune — aceleași în aplicație și în portal.
 *
 * ── ECHIPAMENTUL SE CAUTĂ, NU SE ALEGE DINTR-O LISTĂ ─────────────────────────
 * Un `employee` are `maintenance:read = own`, iar `equipment` are coloana de
 * scope `null` — adică cere `team`. El NU poate enumera parcul (capcana #27),
 * deci nu există un `<select>` de alimentat. Căutarea trece prin acțiunea
 * `cautaEchipament` (client admin, filtrat pe organizație, maximum 10 rânduri),
 * cu debounce; alegerea ajunge în formular printr-un `<input type="hidden">`.
 *
 * ── PREFILL-UL DIN QR SE REZOLVĂ PE SERVER ───────────────────────────────────
 * Pagina citește echipamentul (aceeași acțiune, chemată din Server Component)
 * și îl dă gata rezolvat — caseta se deschide cu utilajul în ea. Ramura de
 * eșec rămâne explicită: un autocolant vechi, un utilaj casat sau un id stricat
 * dau o bandă de atenție, nu un ecran de căutare gol.
 *
 * ── DUPLICATUL SE ANUNȚĂ ─────────────────────────────────────────────────────
 * Fiecare rezultat vine cu `sesizare_deschisa`; la alegere, banda spune
 * „există deja SZ-… deschisă” cu link. Trimiterea rămâne posibilă — pot fi două
 * defecte diferite pe același utilaj.
 *
 * ── LISTA DE REZULTATE E ÎN FLUX, NU ABSOLUTĂ ────────────────────────────────
 * Caseta are corpul `overflow-y-auto`; un derulant poziționat absolut ar fi
 * fost tăiat sau ar fi cerut derulare în fantă. În flux, lista împinge câmpurile
 * de dedesubt cât timp se caută și dispare la alegere.
 */
export function CampuriSesizare<TData>({
  stare,
  idc,
  echipamentPrefill,
  prefillEsuat,
  radacinaSesizari,
}: ProprietatiCampuriSesizare<TData>): ReactElement {
  const trimise: Readonly<Record<string, string>> = stare.data === null ? stare.valoriTrimise : {};
  const sATrimis = Object.keys(trimise).length > 0;

  const [selectat, setSelectat] = useState<EchipamentCautat | null>(echipamentPrefill);
  const [interogare, setInterogare] = useState("");
  const [rezultate, setRezultate] = useState<readonly EchipamentCautat[]>([]);
  /** `null` cât timp nu s-a căutat nimic încă; altfel termenul deja căutat. */
  const [termenCautat, setTermenCautat] = useState<string | null>(null);
  const [arataPrefillEsuat, setArataPrefillEsuat] = useState(prefillEsuat);
  const [inCautare, porniCautare] = useTransition();

  useEffect(() => {
    if (selectat !== null || interogare.trim().length < 2) return;
    const temporizator = setTimeout(() => {
      porniCautare(async () => {
        const termen = interogare.trim();
        const rezultat = await cautaEchipament({ q: termen });
        setRezultate(rezultat.ok ? rezultat.data : []);
        // Se reține TERMENUL căutat, nu doar un boolean: mesajul de zero
        // rezultate trebuie să citeze ce s-a căutat, iar `interogare` se poate
        // fi schimbat deja între pornirea căutării și întoarcerea ei.
        setTermenCautat(termen);
      });
    }, PRAG_CAUTARE);
    return () => {
      clearTimeout(temporizator);
    };
  }, [interogare, selectat]);

  const eroriEchipament = stare.erori["equipment_id"] ?? [];
  const idCauta = idc("cauta");
  const idEroareEchipament = idc("cauta-eroare");
  const duplicat = selectat?.sesizare_deschisa ?? null;

  return (
    <div className="space-y-5">
      {arataPrefillEsuat ? (
        <Callout fel="atentie" titlu="Codul QR scanat nu a dus la niciun echipament activ">
          Autocolantul poate fi vechi, iar utilajul scos din evidență sau casat. Căutați-l mai jos
          după cod, sau anunțați șeful de tură.
        </Callout>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={idCauta} className="text-corp block font-medium">
          Echipament <span aria-hidden="true">*</span>
          <span className="sr-only">(obligatoriu)</span>
        </label>
        <input type="hidden" name="equipment_id" value={selectat?.id ?? ""} />

        {selectat !== null ? (
          <div className="border-foreground/60 rounded-control text-corp flex items-center justify-between gap-3 border px-3 py-2">
            <span className="min-w-0">
              <strong>{selectat.cod}</strong> — {selectat.denumire}
              {selectat.locatie !== null ? (
                <span className="text-muted-foreground"> · {selectat.locatie}</span>
              ) : null}
            </span>
            <Buton
              varianta="link"
              className="text-nota shrink-0"
              onClick={() => {
                setSelectat(null);
                setInterogare("");
                setRezultate([]);
                setTermenCautat(null);
              }}
            >
              Schimbă
            </Buton>
          </div>
        ) : (
          <>
            <input
              id={idCauta}
              type="search"
              value={interogare}
              onChange={(e) => {
                setInterogare(e.target.value);
              }}
              placeholder="Căutați după cod sau denumire (minimum 2 caractere)"
              autoComplete="off"
              aria-invalid={eroriEchipament.length > 0 ? true : undefined}
              aria-describedby={eroriEchipament.length > 0 ? idEroareEchipament : undefined}
              className="border-foreground/60 rounded-control text-corp w-full border px-3 py-2"
            />
            <div aria-live="polite">
              {inCautare ? <p className="text-muted-foreground text-nota">Se caută…</p> : null}
              {!inCautare &&
              termenCautat !== null &&
              termenCautat === interogare.trim() &&
              interogare.trim().length >= 2 &&
              rezultate.length === 0 ? (
                <p className="text-foreground text-nota">
                  Niciun echipament pentru „{termenCautat}”. Verificați codul de pe plăcuță sau
                  scanați codul QR de pe utilaj.
                </p>
              ) : null}
            </div>
            {rezultate.length > 0 ? (
              <ul
                role="listbox"
                aria-label="Rezultate căutare echipament"
                className="border-foreground/60 bg-background rounded-control max-h-64 w-full overflow-y-auto border"
              >
                {rezultate.map((echipament) => (
                  <li key={echipament.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setSelectat(echipament);
                        setRezultate([]);
                        // Banda de QR eșuat și-a făcut treaba: omul a găsit
                        // utilajul de mână. Lăsată pe ecran, ar contrazice
                        // cardul de confirmare de deasupra ei.
                        setArataPrefillEsuat(false);
                      }}
                      className="hover:bg-surface text-corp block w-full px-3 py-2 text-left"
                    >
                      <strong>{echipament.cod}</strong> — {echipament.denumire}
                      {echipament.locatie !== null ? (
                        <span className="text-muted-foreground"> · {echipament.locatie}</span>
                      ) : null}
                      {echipament.sesizare_deschisa !== null ? (
                        <span className="text-muted-foreground text-nota block">
                          Are deja o sesizare deschisă: {echipament.sesizare_deschisa.numar}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
        {eroriEchipament.length > 0 ? (
          <p id={idEroareEchipament} role="alert" className="text-danger text-nota">
            {eroriEchipament[0]}
          </p>
        ) : null}
      </div>

      {duplicat !== null ? (
        <Callout
          fel="atentie"
          titlu={`Există deja o sesizare deschisă pe acest echipament: ${duplicat.numar}`}
        >
          Dacă e aceeași defecțiune,{" "}
          {duplicat.vizibila ? (
            <>
              deschideți{" "}
              <Link
                href={`${radacinaSesizari}/${duplicat.id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                sesizarea existentă
              </Link>{" "}
              și adăugați acolo un comentariu sau o fotografie.
            </>
          ) : (
            "anunțați-l pe cel care a raportat-o sau pe tehnicianul care lucrează la ea."
          )}{" "}
          Dacă e altă problemă, trimiteți oricum — la triaj se pot lega.
        </Callout>
      ) : null}

      <Camp
        nume="descriere"
        id={idc("descriere")}
        eticheta="Ce s-a defectat?"
        obligatoriu
        ajutor="Ce ați observat: zgomot, scurgere, oprire neașteptată, mesaj de eroare. Cel puțin 10 caractere."
        fel="textarea"
        erori={stare.erori["descriere"] ?? []}
      >
        {(a) => (
          <textarea {...a} rows={4} maxLength={2000} defaultValue={trimise["descriere"] ?? ""} />
        )}
      </Camp>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Camp
          nume="urgenta"
          id={idc("urgenta")}
          eticheta="Urgență"
          fel="select"
          erori={stare.erori["urgenta"] ?? []}
        >
          {(a) => (
            <select {...a} defaultValue={trimise["urgenta"] ?? "medie"}>
              {URGENTE_SESIZARE.map((u) => (
                <option key={u} value={u}>
                  {ETICHETE_URGENTA_SESIZARE[u]}
                </option>
              ))}
            </select>
          )}
        </Camp>

        {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA controlului,
            iar la o casetă de bifat eticheta stă după. O bifă nebifată lipsește din
            `FormData`, deci după un refuz se recitește din restul cheilor. */}
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id={idc("opreste")}
            name="opreste_functionarea"
            type="checkbox"
            className={clasaBifa}
            defaultChecked={sATrimis ? trimise["opreste_functionarea"] === "on" : false}
          />
          <label htmlFor={idc("opreste")} className="text-corp">
            Defecțiunea oprește funcționarea echipamentului
          </label>
        </div>
      </div>
    </div>
  );
}
