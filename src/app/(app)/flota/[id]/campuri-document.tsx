"use client";

import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import type { DocumentVehicul, TipDocument } from "@/lib/queries/fleet";

/**
 * Câmpurile unui document de vehicul, scrise o singură dată.
 *
 * Le folosesc două formulare care nu seamănă deloc între ele: panoul din pagină
 * care ADAUGĂ sau reînnoiește, și caseta care CORECTEAZĂ un rând existent.
 * Duplicate, cele două ar fi divergent la primul câmp adăugat — iar divergența
 * s-ar vedea ca „la adăugare pot pune observații, la corectare nu”.
 *
 * ── CE NU E AICI ─────────────────────────────────────────────────────────────
 * `numar` — seria poliței sau numărul procesului-verbal. Nu se căuta după el, nu
 * intra în niciun raport și nu ajungea în `expirables`; coloana din tabel era
 * goală la aproape toate rândurile. A rămas în bază cu valorile deja scrise.
 *
 * `este_curent` — câmp CALCULAT de `internal.flota_sincronizeaza_grup`. Curent e
 * documentul cu `expira_la` maxim, nu ultimul introdus, tocmai ca o poliță
 * înregistrată retroactiv să nu dea afară polița validă. Trimis de client, ar fi
 * ignorat tăcut de trigger.
 *
 * ── `idc`, NU `nume` ─────────────────────────────────────────────────────────
 * `Camp` derivă `id` din `nume`, deci pe fișa unui vehicul cu cinci documente ar
 * exista cinci `camp-emitent`. Eticheta celui de-al doilea formular ar muta
 * focusul în primul. Fiecare apelant își dă propriul prefix, din `useId()`.
 */
export interface ProprietatiCampuriDocument<TData> {
  readonly stare: StareFormular<TData>;
  readonly idc: (sufix: string) => string;
  readonly tipuri: readonly TipDocument[];
  /**
   * Documentul care se corectează. Absent la adăugare.
   *
   * Numit `documentul`, nu `document`: al doilea ar umbri obiectul global cu
   * același nume în tot corpul componentei — o capcană care nu se vede până
   * când cineva adaugă un `document.querySelector` și primește o eroare care
   * arată spre altceva.
   */
  readonly documentul?: DocumentVehicul | undefined;
  /** Tipul preselectat la adăugare, când se pornește de pe un rând anume. */
  readonly tipImplicit?: string | undefined;
}

export function CampuriDocument<TData>({
  stare,
  idc,
  tipuri,
  documentul,
  tipImplicit,
}: ProprietatiCampuriDocument<TData>): ReactElement {
  const trimis = stare.valoriTrimise;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Camp
        nume="document_type_id"
        id={idc("document_type_id")}
        eticheta="Tip document"
        fel="select"
        obligatoriu
        erori={stare.erori["document_type_id"] ?? []}
      >
        {(a) => (
          <select
            {...a}
            defaultValue={
              trimis["document_type_id"] ?? documentul?.document_type_id ?? tipImplicit ?? ""
            }
          >
            {/*
              Opțiunea goală NU e decor. Fără ea, `defaultValue=""` nu se
              potrivește cu nimic din listă, iar browserul selectează PRIMA
              opțiune — care, după `.order("ordine")`, e mereu ITP (`ordine 10`
              în seed-ul din 0012). Cine adăuga o poliță RCA fără să deschidă
              lista o scria ca ITP, `flota_sincronizeaza_grup` o făcea
              `este_curent` pe grupul ITP, iar `sync_expirable` îi muta scadența
              în `expirables`: fișa vehiculului arăta un ITP valabil care nu
              există, cu RCA rămas pe rândul roșu. `z.uuid()` nu se plângea
              niciodată — primise un UUID perfect valid.
            */}
            <option value="">Alegeți tipul documentului</option>
            {tipuri.map((tip) => (
              <option key={tip.id} value={tip.id}>
                {tip.denumire}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="emitent"
        id={idc("emitent")}
        eticheta="Emitent"
        ajutor="Cine a eliberat documentul — asigurătorul, stația de ITP."
        erori={stare.erori["emitent"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={120}
            defaultValue={trimis["emitent"] ?? documentul?.emitent ?? ""}
          />
        )}
      </Camp>

      <Camp nume="cost" id={idc("cost")} eticheta="Cost (lei)" erori={stare.erori["cost"] ?? []}>
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              trimis["cost"] ?? (documentul?.cost === null ? "" : String(documentul?.cost ?? ""))
            }
          />
        )}
      </Camp>

      <Camp
        nume="valabil_de_la"
        id={idc("valabil_de_la")}
        eticheta="Valabil de la"
        erori={stare.erori["valabil_de_la"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="date"
            defaultValue={trimis["valabil_de_la"] ?? documentul?.valabil_de_la ?? ""}
          />
        )}
      </Camp>

      {/* Data de expirare e cea care aprinde semaforul: fără ea, documentul
          rămâne pentru totdeauna „în regulă”, iar tipul obligatoriu apare ca
          „Lipsește”. De aceea ajutorul o spune, în loc s-o marcheze obligatorie
          — baza chiar acceptă documente fără expirare (`cere_expirare`). */}
      <Camp
        nume="expira_la"
        id={idc("expira_la")}
        eticheta="Expiră la"
        ajutor="Fără ea, documentul nu intră în semaforul de scadențe."
        erori={stare.erori["expira_la"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="date"
            defaultValue={trimis["expira_la"] ?? documentul?.expira_la ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="observatii"
        id={idc("observatii")}
        eticheta="Observații"
        fel="textarea"
        className="sm:col-span-2 lg:col-span-3"
        erori={stare.erori["observatii"] ?? []}
      >
        {(a) => (
          <textarea
            {...a}
            maxLength={1000}
            rows={2}
            defaultValue={trimis["observatii"] ?? documentul?.observatii ?? ""}
          />
        )}
      </Camp>
    </div>
  );
}
