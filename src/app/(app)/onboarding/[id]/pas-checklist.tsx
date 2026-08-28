"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { cn } from "@/lib/ui/cn";
import { formatDate, formatDateTime } from "@/lib/format/date";
import type {
  ChecklistItemStatus,
  ChecklistVerificare,
  ChecklistResponsabilTip,
} from "@/schemas/checklist";
import { CHECKLIST_ITEM_STATUS } from "@/schemas/checklist";

import { bifeazaPas } from "../actions";
import { CitireMaterial } from "./citire-material";
import { IncarcareDovada } from "./incarcare-dovada";
import {
  ETICHETE_RESPONSABIL_TIP,
  ETICHETE_ROL,
  ETICHETE_STATUS_ITEM,
  ETICHETE_TIP_DOVADA,
  TONURI_STATUS_ITEM,
} from "../etichete";

/**
 * Lista pașilor unei instanțe de checklist.
 *
 * ── CE ERA GREȘIT ─────────────────────────────────────────────────────────
 * Fiecare pas bifabil randa un formular COMPLET DESCHIS: un `<select>` de
 * stare, câmpul de dovadă, câmpul de observații și un buton „Salvează”. Un
 * checklist de integrare are între 10 și 20 de pași, deci ecranul era un perete
 * de 15 formulare simultane, iar gestul cel mai frecvent din tot modulul —
 * „am făcut pasul ăsta” — costa trei interacțiuni: deschide lista de stări,
 * alege „Bifat”, apasă „Salvează”.
 *
 * ── CUM E ACUM ────────────────────────────────────────────────────────────
 * Gestul frecvent are exact o interacțiune: o casetă de bifat care trimite
 * singură. Restul — starea „În lucru”, „Neaplicabil”, observațiile — stă sub
 * „Detalii”, închis, fiindcă se folosește rar.
 *
 * Excepția e pasul care CERE o dovadă: `bifeazaPas` respinge cu `invalidInput`
 * un „bifat” fără document justificativ sau fără semnătură. Acolo caseta nu
 * poate trimite nimic singură, deci deschide panoul și lasă omul să scrie
 * dovada — o interacțiune în plus impusă de regula bazei, nu de ecran. Dacă
 * dovada e deja înregistrată, caseta funcționează direct.
 */

export interface PasAfisat {
  readonly id: string;
  readonly ordine: number;
  readonly titlu: string;
  readonly descriere: string | null;
  // Legat de sursă, nu scris de mână: uniunea de aici a rămas în urmă la 0089,
  // care a adăugat `subiect`. Aceeași capcană ca la `verificare_automata`.
  readonly responsabil_tip: ChecklistResponsabilTip;
  readonly responsabil_rol: "super_admin" | "org_admin" | "manager" | "hr" | "employee" | null;
  readonly responsabil_employee_id: string | null;
  readonly termen: string | null;
  readonly obligatoriu: boolean;
  readonly tip_dovada: "niciuna" | "bifa" | "document" | "semnatura";
  /*
   * Tipul vine din `@/schemas/checklist`, nu scris de mână. Uniunea literală de
   * dinainte a rămas în urmă cu o valoare când 0076 a adăugat `curs_finalizat`,
   * iar `tsc` a prins-o doar pentru că era o INCOMPATIBILITATE, nu o lipsă: o
   * uniune mai largă atribuită uneia mai înguste. Legată de sursă, nu mai poate
   * rămâne în urmă deloc.
   */
  readonly verificare_automata: ChecklistVerificare | null;
  readonly status: ChecklistItemStatus;
  readonly bifat_de: string | null;
  readonly bifat_la: string | null;
  readonly bifat_automat: boolean;
  readonly dovada: string | null;
  readonly dovada_document_id: string | null;
  /** Dovada încărcată direct în pas (0092). */
  readonly dovada_fisier_nume: string | null;
  readonly dovada_fisier_marime_bytes: number | null;
  /** Materialul de citit (0093), cu versiunea curentă pentru livrare. */
  readonly material: Readonly<{
    readonly id: string;
    readonly titlu: string;
    readonly versiune_curenta_id: string | null;
  }> | null;
  readonly observatii: string | null;
}

interface Proprietati {
  readonly pasi: readonly PasAfisat[];
  /** Id-urile pașilor pe care viewerul curent are voie să-i bifeze — calculat pe server. */
  readonly idPasuriBifabile: readonly string[];
}

export function PasChecklist({ pasi, idPasuriBifabile }: Proprietati) {
  const bifabile = new Set(idPasuriBifabile);

  return (
    <ol className="space-y-2">
      {pasi.map((pas) => (
        <li key={pas.id} className="border-border rounded-panou border p-3">
          <PasRand pas={pas} poateBifa={bifabile.has(pas.id)} />
        </li>
      ))}
    </ol>
  );
}

function responsabilText(pas: PasAfisat): string {
  if (pas.responsabil_tip === "manager_direct") return ETICHETE_RESPONSABIL_TIP.manager_direct;
  if (pas.responsabil_tip === "rol" && pas.responsabil_rol !== null) {
    return `${ETICHETE_RESPONSABIL_TIP.rol}: ${ETICHETE_ROL[pas.responsabil_rol]}`;
  }
  if (pas.responsabil_tip === "angajat") return ETICHETE_RESPONSABIL_TIP.angajat;
  return ETICHETE_RESPONSABIL_TIP[pas.responsabil_tip];
}

/** Pasul cere o dovadă pe care baza o verifică, și ea încă nu e înregistrată. */
function dovadaLipseste(pas: PasAfisat): boolean {
  // Un pas de citire se bifează prin CONFIRMARE, nu direct: triggerul din 0093
  // îl trece pe „bifat" când apare rândul imutabil. Caseta deschide panoul,
  // unde stă butonul care chiar funcționează.
  if (pas.material !== null) return true;
  // Oglinda triggerului din 0092: un fișier încărcat în pas satisface cerința
  // la fel de bine ca un rând din dosarul de personal.
  if (pas.tip_dovada === "document") {
    return pas.dovada_document_id === null && pas.dovada_fisier_nume === null;
  }
  if (pas.tip_dovada === "semnatura") return (pas.dovada ?? "").trim().length === 0;
  return false;
}

function PasRand({ pas, poateBifa }: { readonly pas: PasAfisat; readonly poateBifa: boolean }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [detalii, setDetalii] = useState(false);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // Starea afișată o ia înaintea serverului: caseta se colorează la clic, nu
  // după drumul dus-întors. Se suprascrie doar în urma unui răspuns POZITIV;
  // la refuz se șterge, deci ecranul revine la ce spune baza.
  const [suprascriere, setSuprascriere] = useState<ChecklistItemStatus | null>(null);
  const status = suprascriere ?? pas.status;

  const laReusita = useCallback((): void => {
    setDetalii(false);
    setSuprascriere(null);
    router.refresh();
  }, [router]);

  /** Comutarea dintr-un clic. Cheile sunt EXACT cele din `bifeazaPasSchema`. */
  function comuta(bifeaza: boolean): void {
    // Un pas care cere dovadă și n-o are: `bifeazaPas` l-ar respinge cu
    // „Acest pas cere un document justificativ.”. Nu-l trimitem ca să primim
    // un refuz previzibil — deschidem panoul unde dovada se poate scrie.
    if (bifeaza && dovadaLipseste(pas)) {
      setDetalii(true);
      return;
    }
    setEroare(null);
    const nou: ChecklistItemStatus = bifeaza ? "bifat" : "de_facut";
    setSuprascriere(nou);
    porneste(async () => {
      const rezultat = await bifeazaPas({
        id: pas.id,
        status: nou,
        // Dovada și observațiile se trimit ÎNAPOI neschimbate: `bifeazaPas`
        // scrie toate patru coloanele la fiecare apel, deci a le omite aici ar
        // șterge tăcut semnătura sau observația scrisă de altcineva.
        dovada: pas.dovada,
        dovada_document_id: pas.dovada_document_id,
        observatii: pas.observatii,
      });
      if (!rezultat.ok) {
        setSuprascriere(null);
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  /** Panoul „Detalii”. Cheile sunt EXACT cele din `bifeazaPasSchema`. */
  async function trimiteDetalii(date: FormData) {
    const dovadaSemn = String(date.get("dovada") ?? "").trim();
    const dovadaDoc = String(date.get("dovada_document_id") ?? "").trim();
    const observatii = String(date.get("observatii") ?? "").trim();
    return bifeazaPas({
      id: pas.id,
      status: String(date.get("status") ?? pas.status) as ChecklistItemStatus,
      // Câmpul care NU e randat pentru felul curent de dovadă se trimite ÎNAPOI
      // NESCHIMBAT, exact ca în `comuta()`. Cu `null` acolo, salvarea unei simple
      // observații pe un pas cu dovadă „document" ștergea semnătura scrisă de
      // altcineva — `bifeazaPas` scrie toate patru coloanele la fiecare apel.
      dovada:
        pas.tip_dovada === "semnatura" ? (dovadaSemn.length === 0 ? null : dovadaSemn) : pas.dovada,
      dovada_document_id:
        pas.tip_dovada === "document"
          ? dovadaDoc.length === 0
            ? null
            : dovadaDoc
          : pas.dovada_document_id,
      observatii: observatii.length === 0 ? null : observatii,
    });
  }

  const automat = pas.verificare_automata !== null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        {/* Caseta e ținta principală. `pointer-coarse:size-6` o duce peste
            pragul de atingere pe telefon fără s-o îngroașe pe desktop. */}
        {poateBifa && !automat ? (
          inCurs ? (
            <Loader2
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-4 shrink-0 animate-spin pointer-coarse:size-6"
            />
          ) : (
            <input
              id={idc("bifa")}
              type="checkbox"
              checked={status === "bifat"}
              disabled={status === "neaplicabil"}
              onChange={(eveniment) => {
                comuta(eveniment.target.checked);
              }}
              className={cn(clasaBifa, "mt-0.5 pointer-coarse:size-6")}
            />
          )
        ) : null}

        <div className="min-w-0 flex-1">
          <label
            htmlFor={poateBifa && !automat ? idc("bifa") : undefined}
            className={cn("font-medium", poateBifa && !automat ? "cursor-pointer" : null)}
          >
            {pas.ordine}. {pas.titlu}
            {pas.obligatoriu ? (
              <span className="text-muted-foreground text-nota ml-1">(obligatoriu)</span>
            ) : null}
          </label>
          {pas.descriere === null ? null : (
            <p className="text-muted-foreground text-corp mt-0.5">{pas.descriere}</p>
          )}
          <p className="text-muted-foreground text-nota mt-1">
            Responsabil: {responsabilText(pas)}
            {pas.termen === null ? "" : ` · Termen: ${formatDate(pas.termen)}`}
            {pas.tip_dovada === "niciuna" || pas.tip_dovada === "bifa"
              ? ""
              : ` · ${ETICHETE_TIP_DOVADA[pas.tip_dovada]}`}
            {pas.bifat_la === null
              ? ""
              : ` · Bifat${pas.bifat_automat ? " automat" : ""} la ${formatDateTime(pas.bifat_la)}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge ton={TONURI_STATUS_ITEM[status]}>{ETICHETE_STATUS_ITEM[status]}</Badge>
          {poateBifa && !automat ? (
            <Buton
              varianta="tertiar"
              aria-expanded={detalii}
              aria-controls={idc("detalii")}
              onClick={() => {
                setDetalii((v) => !v);
              }}
            >
              <ChevronDown
                aria-hidden="true"
                className={detalii ? "size-3.5 rotate-180" : "size-3.5"}
              />
              Detalii
            </Buton>
          ) : null}
        </div>
      </div>

      {automat ? (
        <p className="bg-surface text-muted-foreground rounded-control text-nota p-2">
          Se bifează automat de sistem, pe baza altui modul.
          {pas.observatii === null ? "" : ` ${pas.observatii}`}
        </p>
      ) : null}

      {!automat && !poateBifa && pas.observatii !== null ? (
        <p className="text-muted-foreground text-nota">Observații: {pas.observatii}</p>
      ) : null}

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota">
          {eroare}
        </p>
      )}

      {poateBifa && !automat && detalii ? (
        <div id={idc("detalii")}>
          <Formular
            actiune={trimiteDetalii}
            laReusita={laReusita}
            mesajReusita="Pasul a fost salvat."
            className="bg-surface rounded-control grid gap-3 p-3 sm:grid-cols-2"
          >
            {(stare) => (
              <>
                <Camp
                  nume="status"
                  id={idc("status")}
                  eticheta="Stare"
                  fel="select"
                  erori={stare.erori["status"] ?? []}
                >
                  {(a) => (
                    <select {...a} defaultValue={stare.valoriTrimise["status"] ?? pas.status}>
                      {CHECKLIST_ITEM_STATUS.map((s) => (
                        <option key={s} value={s}>
                          {ETICHETE_STATUS_ITEM[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </Camp>

                {pas.material === null ? null : (
                  <CitireMaterial
                    pasId={pas.id}
                    titlu={pas.material.titlu}
                    versiuneId={pas.material.versiune_curenta_id}
                    confirmat={pas.status === "bifat"}
                    poateConfirma={poateBifa}
                  />
                )}

                {pas.tip_dovada === "document" ? (
                  <IncarcareDovada
                    pasId={pas.id}
                    numeFisier={pas.dovada_fisier_nume}
                    marimeBytes={pas.dovada_fisier_marime_bytes}
                    poateScrie={poateBifa}
                  />
                ) : null}

                {pas.tip_dovada === "semnatura" ? (
                  <Camp
                    nume="dovada"
                    id={idc("dovada")}
                    eticheta={ETICHETE_TIP_DOVADA.semnatura}
                    ajutor="Numele persoanei care a semnat."
                    erori={stare.erori["dovada"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="text"
                        maxLength={200}
                        defaultValue={stare.valoriTrimise["dovada"] ?? pas.dovada ?? ""}
                      />
                    )}
                  </Camp>
                ) : null}

                <Camp
                  nume="observatii"
                  id={idc("observatii")}
                  eticheta="Observații"
                  fel="textarea"
                  className="sm:col-span-2"
                  erori={stare.erori["observatii"] ?? []}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      maxLength={1000}
                      rows={2}
                      defaultValue={stare.valoriTrimise["observatii"] ?? pas.observatii ?? ""}
                    />
                  )}
                </Camp>

                <div className="flex items-center gap-3 sm:col-span-2">
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se salvează…"
                  >
                    Salvează
                  </Buton>
                  <Buton
                    varianta="link"
                    disabled={stare.inCurs}
                    onClick={() => {
                      setDetalii(false);
                    }}
                  >
                    Renunță
                  </Buton>
                </div>
              </>
            )}
          </Formular>
        </div>
      ) : null}
    </div>
  );
}
