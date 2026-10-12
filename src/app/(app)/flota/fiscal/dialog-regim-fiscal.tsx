"use client";

import { Scale } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { IntrareData } from "@/components/ui/intrare-data";
import {
  ETICHETE_EXCEPTIE,
  ETICHETE_REGIM_FISCAL,
  ETICHETE_TITLU,
  EXCEPTII_FISCALE,
  REGIMURI_FISCALE,
  TITLURI_FOLOSINTA,
  esteMasinaPersonala,
  type RegimFiscal,
  type TitluFolosinta,
} from "@/domain/fleet/fiscal";
import type { OptiuneAngajat } from "@/lib/queries/fleet";

import { adaugaRegimFiscal } from "../actions-fiscal";

/** Titlurile la care avantajul și decontul se judecă pe chirie (oglinda `vfr_chirie_ck`). */
const TITLURI_CU_CHIRIE: ReadonlySet<TitluFolosinta> = new Set([
  "inchiriat",
  "leasing_operational",
  "chirie_persoana_fizica",
]);

interface Proprietati {
  readonly vehiculId: string;
  readonly nrInmatriculare: string;
  /** Regimul pe care fișa îl impune singură (peste 3.500 kg / 9 locuri), sau `null`. */
  readonly regimSugerat: RegimFiscal | null;
  /** `AAAA-LL-ZZ`, ziua României. */
  readonly azi: string;
  readonly angajati: readonly OptiuneAngajat[];
}

/**
 * O perioadă nouă a regimului fiscal al vehiculului (0202). Nu se modifică o
 * perioadă existentă: corectura e ștergere + perioadă nouă, iar istoricul
 * rămâne în audit. Cheile trimise sunt EXACT cele din `regimFiscalNouSchema`.
 *
 * Câmpurile condiționate (categoria exceptată, proprietarul, chiria) apar doar
 * când regimul sau titlul le cer: ceea ce `vfr_exceptie_ck`, `vfr_proprietar_ck`
 * și `vfr_chirie_ck` ar refuza oricum în bază, aici nici nu se poate scrie.
 */
export function DialogRegimFiscal({
  vehiculId,
  nrInmatriculare,
  regimSugerat,
  azi,
  angajati,
}: Proprietati): ReactElement {
  const [regim, setRegim] = useState<RegimFiscal>(regimSugerat ?? "limitat_50");
  const [titlu, setTitlu] = useState<TitluFolosinta>("proprietate");

  const personala = esteMasinaPersonala(titlu);

  async function trimite(date: FormData) {
    return adaugaRegimFiscal({
      vehicle_id: vehiculId,
      valabil_de_la: String(date.get("valabil_de_la") ?? ""),
      regim,
      exceptie: regim === "exceptat_categorie" ? String(date.get("exceptie") ?? "") : "",
      motiv: String(date.get("motiv") ?? ""),
      titlu_folosinta: titlu,
      proprietar_employee_id: personala ? String(date.get("proprietar_employee_id") ?? "") : "",
      chirie_lunara: TITLURI_CU_CHIRIE.has(titlu) ? String(date.get("chirie_lunara") ?? "") : "",
      contract_numar: String(date.get("contract_numar") ?? ""),
      contract_data: String(date.get("contract_data") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Regim fiscal nou",
        varianta: "secundar",
        pictograma: <Scale aria-hidden="true" className="size-4" />,
      }}
      titlu={`Regim fiscal nou — ${nrInmatriculare}`}
      descriere="Regimul se aplică de la data aleasă și până la următoarea perioadă. Foile de parcurs din trecut se judecă după regimul din ziua lor."
      marime="mare"
      actiune={trimite}
      mesajReusita="Regimul fiscal a fost adăugat."
      etichetaTrimite="Adaugă regimul"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="valabil_de_la"
            id={idc("valabil_de_la")}
            eticheta="Se aplică de la"
            obligatoriu
            erori={stare.erori["valabil_de_la"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["valabil_de_la"] ?? azi} />}
          </Camp>
          <Camp
            nume="regim"
            id={idc("regim")}
            eticheta="Regim de deducere"
            fel="select"
            obligatoriu
            erori={stare.erori["regim"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                value={regim}
                onChange={(eveniment) => {
                  setRegim(eveniment.target.value as RegimFiscal);
                }}
              >
                {REGIMURI_FISCALE.map((r) => (
                  <option key={r} value={r}>
                    {ETICHETE_REGIM_FISCAL[r]}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          {regim === "exceptat_categorie" ? (
            <Camp
              nume="exceptie"
              id={idc("exceptie")}
              eticheta="Categoria exceptată"
              fel="select"
              obligatoriu
              className="sm:col-span-2"
              ajutor="Codul fiscal, art. 25 alin. (3) lit. l) pct. 1–5."
              erori={stare.erori["exceptie"] ?? []}
            >
              {(a) => (
                <select {...a} defaultValue={stare.valoriTrimise["exceptie"] ?? ""}>
                  <option value="" disabled>
                    Alegeți categoria
                  </option>
                  {EXCEPTII_FISCALE.map((e) => (
                    <option key={e} value={e}>
                      {ETICHETE_EXCEPTIE[e]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          ) : null}

          <Camp
            nume="motiv"
            id={idc("motiv")}
            eticheta="Motivul încadrării"
            fel="textarea"
            obligatoriu
            className="sm:col-span-2"
            ajutor="Cum folosiți mașina și de ce regimul ales e cel potrivit: rămâne în istoric, pentru control."
            erori={stare.erori["motiv"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={1000}
                rows={3}
                defaultValue={stare.valoriTrimise["motiv"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="titlu_folosinta"
            id={idc("titlu_folosinta")}
            eticheta="Al cui e vehiculul"
            fel="select"
            className="sm:col-span-2"
            erori={stare.erori["titlu_folosinta"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                value={titlu}
                onChange={(eveniment) => {
                  setTitlu(eveniment.target.value as TitluFolosinta);
                }}
              >
                {TITLURI_FOLOSINTA.map((t) => (
                  <option key={t} value={t}>
                    {ETICHETE_TITLU[t]}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          {personala ? (
            <Camp
              nume="proprietar_employee_id"
              id={idc("proprietar_employee_id")}
              eticheta="Proprietarul mașinii"
              fel="select"
              obligatoriu
              className="sm:col-span-2"
              ajutor="Mașina personală folosită în interes de serviciu: comodat sau chirie, cu decont pe baza foii de parcurs. Tratamentul fiscal se confirmă cu contabilul."
              erori={stare.erori["proprietar_employee_id"] ?? []}
            >
              {(a) => (
                <select {...a} defaultValue={stare.valoriTrimise["proprietar_employee_id"] ?? ""}>
                  <option value="" disabled>
                    Alegeți angajatul
                  </option>
                  {angajati.map((ang) => (
                    <option key={ang.id} value={ang.id}>
                      {ang.full_name}
                      {ang.marca === null ? "" : ` (${ang.marca})`}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          ) : null}

          {TITLURI_CU_CHIRIE.has(titlu) ? (
            <Camp
              nume="chirie_lunara"
              id={idc("chirie_lunara")}
              eticheta="Chiria lunară (lei)"
              ajutor="Pentru vehiculul închiriat, avantajul în natură se evaluează la nivelul chiriei."
              erori={stare.erori["chirie_lunara"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={stare.valoriTrimise["chirie_lunara"] ?? ""}
                />
              )}
            </Camp>
          ) : null}

          <Camp
            nume="contract_numar"
            id={idc("contract_numar")}
            eticheta="Contract (număr)"
            erori={stare.erori["contract_numar"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={60}
                defaultValue={stare.valoriTrimise["contract_numar"] ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="contract_data"
            id={idc("contract_data")}
            eticheta="Contract (data)"
            erori={stare.erori["contract_data"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["contract_data"] ?? ""} />}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
